export const MEMORY_DEFAULTS = Object.freeze({ enabled: true, idleSeconds: 60, everyN: 20, deepIdleMinutes: 0, minFreeRamGB: 4, minFreeVramGB: 2 })
export function normalizeMemorySettings(value = {}) {
  const number = (key, min, max) => Number.isFinite(Number(value[key])) ? Math.min(max, Math.max(min, Number(value[key]))) : MEMORY_DEFAULTS[key]
  return { enabled: value.enabled !== false, idleSeconds: number('idleSeconds', 10, 3600), everyN: Math.round(number('everyN', 0, 1000)), deepIdleMinutes: number('deepIdleMinutes', 0, 240), minFreeRamGB: number('minFreeRamGB', 0, 64), minFreeVramGB: number('minFreeVramGB', 0, 32) }
}
export function isQueueIdle(queue) {
  // Unknown/offline is never evidence that it is safe to clean up.
  return Array.isArray(queue?.queue_running) && Array.isArray(queue?.queue_pending) && queue.queue_running.length === 0 && queue.queue_pending.length === 0
}
export function modelSignature(workflow) {
  const names = new Set()
  for (const node of Object.values(workflow || {})) {
    for (const value of Object.values(node?.inputs || {})) {
      if (typeof value === 'string' && /\.(safetensors|gguf|ckpt|pt|pth|bin)$/i.test(value)) names.add(value)
    }
  }
  return [...names].sort().join('|')
}
export function underMemoryPressure(stats, settings) {
  const gb = 1024 ** 3
  const ram = Number(stats?.system?.ram_free ?? stats?.ramFree)
  const gpu = stats?.devices || []
  return (Number.isFinite(ram) && ram < settings.minFreeRamGB * gb) || gpu.some(device => device.type !== 'cpu' && device.vram_free != null && Number.isFinite(Number(device.vram_free)) && Number(device.vram_free) < settings.minFreeVramGB * gb)
}

// All cleanup and application submissions share this gate. Transport injection
// keeps lifecycle rules testable without Electron, React or an actual GPU.
export class GenerationMemoryManager {
  constructor(io) {
    this.io = io
    this.tail = Promise.resolve()
    this.lastActivity = io.now()
    this.lastSignature = ''
    this.count = 0
    this.released = false
    this.sleeping = false
    this.status = 'idle'
    this.seen = new Set()
    this.activeRuns = 0
  }
  exclusive(action) {
    const result = this.tail.then(action)
    this.tail = result.catch(() => {})
    return result
  }
  notify(status) { this.status = status; this.io.notify?.({ status, sleeping: this.sleeping, count: this.count }) }
  activity() { this.lastActivity = this.io.now(); this.released = false }
  completed(id) {
    if (!id || this.seen.has(id)) return
    this.seen.add(id)
    if (this.seen.size > 200) this.seen.delete(this.seen.values().next().value)
    this.count += 1
    this.activity()
  }
  beginActivity() {
    this.activeRuns += 1
    this.activity()
    let ended = false
    return () => {
      if (ended) return
      ended = true
      this.activeRuns = Math.max(0, this.activeRuns - 1)
      this.activity()
    }
  }
  async withActivity(action) {
    const endActivity = this.beginActivity()
    try { return await action() } finally { endActivity() }
  }
  async release(reason) {
    if (!isQueueIdle(await this.io.queue())) return false
    this.notify('releasing')
    this.io.trim?.()
    if (!await this.io.free()) { this.notify('unavailable'); return false }
    // /free acknowledges flags, not completion. The adapter waits for memory
    // telemetry to settle, with a bounded timeout; it never claims full release.
    const settled = await this.io.settle()
    this.released = true
    this.count = 0
    this.notify(settled ? 'released' : 'requested')
    return true
  }
  wake() {
    if (!this.sleeping) return Promise.resolve()
    return this.exclusive(async () => {
      if (!this.sleeping) return
      this.notify('waking')
      await this.io.wake()
      this.sleeping = false
      this.activity()
      this.notify('idle')
    })
  }
  submit(workflow, action) {
    return this.exclusive(async () => {
      if (this.sleeping) { await this.io.wake(); this.sleeping = false }
      const settings = this.io.settings()
      const signature = modelSignature(workflow)
      if (settings.enabled && ((this.lastSignature && signature !== this.lastSignature) || (settings.everyN > 0 && this.count >= settings.everyN))) await this.release('transition')
      const result = await action()
      this.lastSignature = signature
      this.activity()
      return result
    })
  }
  tick(manual = false) {
    return this.exclusive(async () => {
      const settings = this.io.settings()
      if ((!settings.enabled && !manual) || this.sleeping || this.activeRuns > 0) return false
      if (!isQueueIdle(await this.io.queue())) { this.activity(); return false }
      const elapsed = this.io.now() - this.lastActivity
      const pressure = underMemoryPressure(await this.io.stats(), settings)
      if (!this.released && (manual || pressure || elapsed >= settings.idleSeconds * 1000 || (settings.everyN > 0 && this.count >= settings.everyN))) await this.release(manual ? 'manual' : pressure ? 'pressure' : 'idle')
      if (!manual && settings.deepIdleMinutes > 0 && elapsed >= Math.max(settings.idleSeconds * 1000, settings.deepIdleMinutes * 60000)) {
        if (isQueueIdle(await this.io.queue()) && await this.io.sleep()) { this.sleeping = true; this.notify('sleeping') }
      }
      return this.released
    })
  }
}
