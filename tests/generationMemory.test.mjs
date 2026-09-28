import test from 'node:test'
import assert from 'node:assert/strict'
import { GenerationMemoryManager, MEMORY_DEFAULTS, isQueueIdle, normalizeMemorySettings, underMemoryPressure } from '../src/services/generationMemoryPolicy.mjs'
function setup() {
  const calls = []
  const state = { now: 0, queue: { queue_running: [], queue_pending: [] }, settings: { ...MEMORY_DEFAULTS }, stats: {} }
  const manager = new GenerationMemoryManager({ now: () => state.now, settings: () => state.settings, queue: async () => state.queue, stats: async () => state.stats, free: async () => { calls.push('free'); return true }, settle: async () => true, trim: () => calls.push('trim'), sleep: async () => { calls.push('sleep'); return true }, wake: async () => calls.push('wake') })
  return { manager, state, calls }
}
const graph = name => ({ '1': { inputs: { unet_name: `${name}.gguf` } } })
test('unknown and queued servers never authorize cleanup', async () => {
  for (const queue of [null, {}, { queue_running: ['job'], queue_pending: [] }, { queue_running: [], queue_pending: ['job'] }]) {
    const { manager, state, calls } = setup(); state.queue = queue; state.now = 100000
    assert.equal(isQueueIdle(queue), false); await manager.tick(true); assert.deepEqual(calls, [])
  }
})
test('same models stay warm; changing models frees once before submitting', async () => {
  const { manager, calls } = setup()
  await manager.submit(graph('image'), async () => calls.push('image'))
  await manager.submit(graph('image'), async () => { await manager.wake(); calls.push('image') })
  await manager.submit(graph('video'), async () => calls.push('video'))
  assert.deepEqual(calls, ['image', 'image', 'trim', 'free', 'video'])
})
test('idle cleanup runs once; RAM pressure triggers without waiting for idle', async () => {
  const { manager, state, calls } = setup()
  state.stats = { ramFree: 1024 ** 3 }; await manager.tick(); await manager.tick()
  assert.equal(calls.filter(x => x === 'free').length, 1)
  manager.activity(); state.stats = {}; state.now = 61000; await manager.tick()
  assert.equal(calls.filter(x => x === 'free').length, 2)
})
test('success aliases count once and interval is prompt count', async () => {
  const { manager, state, calls } = setup(); state.settings.everyN = 2
  manager.completed('a'); manager.completed('a'); assert.equal(manager.count, 1)
  manager.completed('b'); await manager.tick(); assert.equal(manager.count, 0)
  assert.ok(calls.includes('free'))
})
test('deep idle is opt-in and next submission resumes before work', async () => {
  const { manager, state, calls } = setup(); state.now = 1000000
  await manager.tick(); assert.equal(manager.sleeping, false)
  state.settings.deepIdleMinutes = 1; await manager.tick(); assert.equal(manager.sleeping, true)
  await manager.submit(graph('image'), async () => calls.push('submit'))
  assert.deepEqual(calls.slice(-3), ['sleep', 'wake', 'submit'])
})
test('cleanup and submissions are serialized', async () => {
  const { manager, state, calls } = setup(); state.now = 61000
  let finish; manager.io.settle = () => new Promise(resolve => { finish = resolve })
  const cleanup = manager.tick(); const work = manager.submit(graph('image'), async () => calls.push('submit'))
  await new Promise(resolve => setImmediate(resolve)); assert.ok(!calls.includes('submit'))
  finish(true); await Promise.all([cleanup, work]); assert.equal(calls.at(-1), 'submit')
})
test('disabled management preserves manual cleanup and failed free can retry', async () => {
  const { manager, state, calls } = setup(); state.settings.enabled = false; state.now = 61000
  await manager.tick(); assert.deepEqual(calls, [])
  manager.io.free = async () => false; await manager.tick(true); assert.equal(manager.released, false)
  manager.io.free = async () => true; await manager.tick(true); assert.equal(manager.released, true)
})
test('invalid limits normalize and unavailable telemetry is not zero memory', () => {
  assert.equal(normalizeMemorySettings({ everyN: -3 }).everyN, 0)
  assert.equal(underMemoryPressure({}, MEMORY_DEFAULTS), false)
  assert.equal(underMemoryPressure({ devices: [{ type: 'cuda', vram_free: 100 }] }, MEMORY_DEFAULTS), true)
})
test('preparing and importing a pipeline protects idle and manual cleanup', async () => {
  const { manager, state, calls } = setup()
  await manager.withActivity(async () => {
    state.now = 1000000
    state.settings.deepIdleMinutes = 1
    await manager.tick(true)
    assert.deepEqual(calls, [])
    // Explicit stage transitions still release models within a pipeline.
    await manager.submit(graph('image'), async () => {})
    await manager.submit(graph('video'), async () => {})
    assert.ok(calls.includes('free'))
  })
  assert.equal(manager.activeRuns, 0)
})
test('long external work can hold an idempotent memory activity lease', async () => {
  const { manager, state, calls } = setup()
  const endActivity = manager.beginActivity()
  state.now = 1000000
  state.settings.deepIdleMinutes = 1
  await manager.tick(true)
  assert.deepEqual(calls, [])
  assert.equal(manager.activeRuns, 1)

  endActivity()
  endActivity()
  assert.equal(manager.activeRuns, 0)
  state.now += 61000
  await manager.tick(true)
  assert.ok(calls.includes('free'))
})
test('failed pipeline and failed resume preserve lifecycle state', async () => {
  const { manager } = setup()
  await assert.rejects(manager.withActivity(async () => { throw new Error('failed') }))
  assert.equal(manager.activeRuns, 0)
  manager.sleeping = true
  manager.io.wake = async () => { throw new Error('resume failed') }
  let submitted = false
  await assert.rejects(manager.submit(graph('image'), async () => { submitted = true }))
  assert.equal(submitted, false)
  assert.equal(manager.sleeping, true)
})
