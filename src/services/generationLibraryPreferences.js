export const COLLAPSED_RECIPE_IDS_KEY = 'lumeweft-generation-recipes-collapsed-v1'
export const COLLAPSED_HISTORY_IDS_KEY = 'lumeweft-generation-history-collapsed-v1'

export function readCollapsedIds(storage, key) {
  try {
    const parsed = JSON.parse(storage?.getItem?.(key) || '[]')
    return new Set((Array.isArray(parsed) ? parsed : []).map((value) => String(value || '').trim()).filter(Boolean))
  } catch {
    return new Set()
  }
}

export function writeCollapsedIds(storage, key, ids) {
  try {
    const values = [...(ids || [])].map((value) => String(value || '').trim()).filter(Boolean)
    storage?.setItem?.(key, JSON.stringify(values))
    return true
  } catch {
    return false
  }
}

