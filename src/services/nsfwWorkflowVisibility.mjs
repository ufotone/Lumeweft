export const NSFW_WORKFLOW_VISIBILITY_STORAGE_KEY = 'lumeweft-show-nsfw-workflows'
export const NSFW_WORKFLOW_VISIBILITY_CHANGED_EVENT = 'lumeweft-nsfw-workflow-visibility-changed'

const KNOWN_NSFW_WORKFLOW_IDS = new Set([
  'dark-beast-krea2-i2i',
  'haruki-mix-krea2-t2i',
  'minimax-h3-naughty-times',
  'minimax-h3-pink-reference',
  'minimax-h3-aftermidnight-r2v',
  'minimax-h3-aftermidnight-3ref',
])

const NSFW_RESOURCE_MARKERS = [
  'naughty times',
  'naughtytimes',
  'pink fluffy bunny',
  'pinkfluffybunny',
  'after midnight',
  'aftermidnight',
  'dark beast',
  'dark-beast',
  'haruki mix',
  'haruki-mix',
]

export function getShowNsfwWorkflows(storage = globalThis.localStorage) {
  try {
    return storage?.getItem(NSFW_WORKFLOW_VISIBILITY_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

export function setShowNsfwWorkflows(show, storage = globalThis.localStorage, eventTarget = globalThis.window) {
  const next = Boolean(show)
  try {
    storage?.setItem(NSFW_WORKFLOW_VISIBILITY_STORAGE_KEY, String(next))
  } catch {
    // The live setting still applies when storage is unavailable.
  }
  if (eventTarget?.dispatchEvent && typeof globalThis.CustomEvent === 'function') {
    eventTarget.dispatchEvent(new CustomEvent(NSFW_WORKFLOW_VISIBILITY_CHANGED_EVENT, { detail: { show: next } }))
  }
  return next
}

function collectMetadataStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value)
    return output
  }
  if (!value || typeof value !== 'object') return output
  for (const key of ['id', 'workflowId', 'templateId', 'title', 'label', 'workflowLabel', 'workflowName', 'name', 'filename']) {
    if (typeof value[key] === 'string') output.push(value[key])
  }
  if (Array.isArray(value.resources)) {
    value.resources.forEach((resource) => collectMetadataStrings(resource, output))
  }
  if (value.recipe && typeof value.recipe === 'object') collectMetadataStrings(value.recipe, output)
  return output
}

export function isNsfwWorkflow(value) {
  if (value?.nsfw === true || String(value?.section || '').toLowerCase() === 'nsfw') return true
  return collectMetadataStrings(value).some((candidate) => {
    const text = String(candidate || '').trim().toLowerCase()
    if (!text) return false
    if (/^\[nsfw\](?:\s|$)/i.test(text)) return true
    if (text.includes('nsfw')) return true
    if (KNOWN_NSFW_WORKFLOW_IDS.has(text)) return true
    return NSFW_RESOURCE_MARKERS.some((marker) => text.includes(marker))
  })
}

export function ensureNsfwPrefix(title, fallback = 'Generation') {
  const normalized = String(title || '').trim() || fallback
  return /^\[nsfw\](?:\s|$)/i.test(normalized) ? normalized : `[NSFW] ${normalized}`
}
