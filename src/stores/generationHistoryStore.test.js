import test from 'node:test'
import assert from 'node:assert/strict'
import useGenerationHistoryStore, { normalizeGenerationHistory } from './generationHistoryStore.js'

test('normalizes an older project with no generation history', () => {
  assert.deepEqual(normalizeGenerationHistory(null), { schemaVersion: 2, records: [] })
})

test('appends immutable generation versions and switches the active version', () => {
  const store = useGenerationHistoryStore.getState()
  store.clear()
  const record = store.createRecord({ title: 'Shot 1', timelineId: 'timeline-1', clipId: 'clip-1' })
  const first = useGenerationHistoryStore.getState().appendVersion(record.id, {
    workflowId: 'ltx23-i2v',
    promptId: 'prompt-1',
    prompt: 'first',
    outputAssetIds: ['asset-1'],
    uiWorkflow: { nodes: [{ id: 1, type: 'KSampler' }], links: [] },
  })
  const second = useGenerationHistoryStore.getState().appendVersion(record.id, {
    workflowId: 'ltx23-i2v',
    prompt: 'second',
    outputAssetIds: ['asset-2'],
  })

  const saved = useGenerationHistoryStore.getState().getProjectData()
  assert.equal(saved.records[0].versions.length, 2)
  assert.equal(saved.records[0].versions[0].prompt, 'first')
  assert.equal(saved.records[0].versions[0].promptId, 'prompt-1')
  assert.deepEqual(saved.records[0].versions[0].uiWorkflow, { nodes: [{ id: 1, type: 'KSampler' }], links: [] })
  assert.equal(saved.records[0].activeVersionId, second.id)
  assert.equal(useGenerationHistoryStore.getState().setActiveVersion(record.id, first.id), true)
  assert.equal(useGenerationHistoryStore.getState().records[0].activeVersionId, first.id)
})

test('deletes one version and promotes the newest remaining version', () => {
  const store = useGenerationHistoryStore.getState()
  store.clear()
  const record = store.createRecord({ title: 'Shot 2' })
  const first = useGenerationHistoryStore.getState().appendVersion(record.id, { prompt: 'first' })
  const second = useGenerationHistoryStore.getState().appendVersion(record.id, { prompt: 'second' })

  assert.equal(useGenerationHistoryStore.getState().removeVersion(record.id, second.id), true)
  const remaining = useGenerationHistoryStore.getState().records[0]
  assert.deepEqual(remaining.versions.map((version) => version.id), [first.id])
  assert.equal(remaining.activeVersionId, first.id)
})

test('removes the record when its last version is deleted', () => {
  const store = useGenerationHistoryStore.getState()
  store.clear()
  const record = store.createRecord({ title: 'Shot 3' })
  const version = useGenerationHistoryStore.getState().appendVersion(record.id, { prompt: 'only' })

  assert.equal(useGenerationHistoryStore.getState().removeVersion(record.id, version.id), true)
  assert.equal(useGenerationHistoryStore.getState().records.length, 0)
})

test('deletes an entire generation record', () => {
  const store = useGenerationHistoryStore.getState()
  store.clear()
  const first = store.createRecord({ title: 'Keep' })
  const second = useGenerationHistoryStore.getState().createRecord({ title: 'Delete' })

  assert.equal(useGenerationHistoryStore.getState().removeRecord(second.id), true)
  assert.deepEqual(useGenerationHistoryStore.getState().records.map((record) => record.id), [first.id])
})

test('deletes multiple selected generation records in one update', () => {
  const store = useGenerationHistoryStore.getState()
  store.clear()
  const first = store.createRecord({ title: 'First' })
  const second = useGenerationHistoryStore.getState().createRecord({ title: 'Second' })
  const third = useGenerationHistoryStore.getState().createRecord({ title: 'Third' })

  assert.equal(useGenerationHistoryStore.getState().removeRecords([first.id, third.id, 'missing']), 2)
  assert.deepEqual(useGenerationHistoryStore.getState().records.map((record) => record.id), [second.id])
})

test('marks new NSFW history records and versions with a title prefix', () => {
  const store = useGenerationHistoryStore.getState()
  store.clear()
  const record = store.createRecord({ title: 'H3 scene', nsfw: true })
  const version = useGenerationHistoryStore.getState().appendVersion(record.id, {
    workflowLabel: 'H3 workflow',
    nsfw: true,
  })

  const saved = useGenerationHistoryStore.getState().records[0]
  assert.equal(saved.nsfw, true)
  assert.equal(saved.title, '[NSFW] H3 scene')
  assert.equal(version.nsfw, true)
  assert.equal(version.workflowLabel, '[NSFW] H3 workflow')
})
