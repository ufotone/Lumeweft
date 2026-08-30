/**
 * Pexels API key storage – works in Electron (settings) and web (localStorage).
 */
const PEXELS_KEY_STORAGE = 'comfystudio-pexels-api-key'
export const PEXELS_API_KEY_CHANGED_EVENT = 'lumeweft-pexels-api-key-changed'

export async function getPexelsApiKey() {
  if (typeof window !== 'undefined' && window.electronAPI?.getSetting) {
    return await window.electronAPI.getSetting('pexelsApiKey')
  }
  return localStorage.getItem(PEXELS_KEY_STORAGE) || null
}

export async function setPexelsApiKey(value) {
  const normalizedValue = value || ''
  if (typeof window !== 'undefined' && window.electronAPI?.setSetting) {
    await window.electronAPI.setSetting('pexelsApiKey', normalizedValue)
  } else {
    localStorage.setItem(PEXELS_KEY_STORAGE, normalizedValue)
  }
  window.dispatchEvent(new CustomEvent(PEXELS_API_KEY_CHANGED_EVENT, {
    detail: { configured: Boolean(String(normalizedValue).trim()) },
  }))
}
