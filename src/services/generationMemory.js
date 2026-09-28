import { GenerationMemoryManager, normalizeMemorySettings } from './generationMemoryPolicy.mjs'
import { getLocalComfyHttpBaseSync, COMFY_CONNECTION_CHANGED_EVENT } from './localComfyConnection'
const KEY = 'lumeweft-generation-memory'
export const MEMORY_STATE_EVENT = 'lumeweft-memory-state'
export const MEMORY_TRIM_EVENT = 'lumeweft-memory-trim'
export function getMemorySettings() {
  try { return normalizeMemorySettings(JSON.parse(localStorage.getItem(KEY) || '{}')) } catch { return normalizeMemorySettings() }
}
export function setMemorySettings(value) {
  const next = normalizeMemorySettings(value)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
async function request(route, body) {
  try {
    const response = await fetch(`${getLocalComfyHttpBaseSync()}${route}`, { signal: AbortSignal.timeout(4000), ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
    if (!response.ok) return null
    return await response.json()
  } catch { return null }
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
export const generationMemory = new GenerationMemoryManager({
  now: () => Date.now(), settings: getMemorySettings,
  queue: () => request('/queue'),
  stats: async () => {
    const [comfy, system] = await Promise.all([request('/system_stats'), window.electronAPI?.generationMemory?.stats?.()])
    return { ...comfy, ramFree: system?.ramFree }
  },
  free: async () => (await request('/free', { unload_models: true, free_memory: true })) !== null,
  settle: async () => {
    let previous = null
    for (let i = 0; i < 6; i++) {
      await pause(500)
      const stats = await request('/system_stats')
      const free = stats?.devices?.reduce((sum, device) => sum + (Number(device.vram_free) || 0), 0)
      if (i >= 2 && free != null && previous != null && Math.abs(free - previous) < 16 * 1024 ** 2) return true
      previous = free
    }
    return false
  },
  trim: () => window.dispatchEvent(new CustomEvent(MEMORY_TRIM_EVENT)),
  notify: detail => window.dispatchEvent(new CustomEvent(MEMORY_STATE_EVENT, { detail })),
  sleep: async () => (await window.electronAPI?.generationMemory?.sleep?.())?.success === true,
  wake: async () => {
    const result = await window.electronAPI?.comfyLauncher?.start?.()
    if (!result?.success) throw new Error('ComfyUI could not resume after memory sleep.')
    for (let i = 0; i < 300; i++) {
      if (await request('/system_stats')) return
      await pause(1000)
    }
    throw new Error('ComfyUI resume timed out.')
  },
})
export function startGenerationMemory() {
  let pending = false
  const tick = async () => {
    if (pending) return
    pending = true
    try { await generationMemory.tick() } catch (error) { console.warn('[Memory]', error) } finally { pending = false }
  }
  const changed = () => {
    generationMemory.sleeping = false
    generationMemory.lastSignature = ''
    generationMemory.activity()
  }
  window.addEventListener(COMFY_CONNECTION_CHANGED_EVENT, changed)
  const timer = setInterval(tick, 10000)
  return () => { clearInterval(timer); window.removeEventListener(COMFY_CONNECTION_CHANGED_EVENT, changed) }
}
