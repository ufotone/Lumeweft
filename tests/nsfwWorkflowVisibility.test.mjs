import assert from 'node:assert/strict'
import test from 'node:test'

import {
  NSFW_WORKFLOW_VISIBILITY_STORAGE_KEY,
  ensureNsfwPrefix,
  getShowNsfwWorkflows,
  isNsfwWorkflow,
  setShowNsfwWorkflows,
} from '../src/services/nsfwWorkflowVisibility.mjs'

function makeStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('NSFW workflows are visible by default and the preference can be disabled', () => {
  const storage = makeStorage()
  assert.equal(getShowNsfwWorkflows(storage), true)
  assert.equal(setShowNsfwWorkflows(false, storage, null), false)
  assert.equal(storage.getItem(NSFW_WORKFLOW_VISIBILITY_STORAGE_KEY), 'false')
  assert.equal(getShowNsfwWorkflows(storage), false)
})

test('recognizes explicit, prefixed, template, workflow, and resource NSFW metadata', () => {
  assert.equal(isNsfwWorkflow({ nsfw: true }), true)
  assert.equal(isNsfwWorkflow({ title: '[NSFW] saved recipe' }), true)
  assert.equal(isNsfwWorkflow({ templateId: 'nsfw-minimax-h3-naughty-times' }), true)
  assert.equal(isNsfwWorkflow({ workflowId: 'minimax-h3-aftermidnight-r2v' }), true)
  assert.equal(isNsfwWorkflow({ resources: [{ filename: 'PinkFluffyBunny_rank64.safetensors' }] }), true)
  assert.equal(isNsfwWorkflow({ workflowId: 'wan22-i2v', title: 'Regular generation' }), false)
})

test('adds the NSFW title marker exactly once', () => {
  assert.equal(ensureNsfwPrefix('H3 actor'), '[NSFW] H3 actor')
  assert.equal(ensureNsfwPrefix('[NSFW] H3 actor'), '[NSFW] H3 actor')
})
