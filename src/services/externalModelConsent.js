import { EXTERNAL_MODELS_TERMS_VERSION } from '../config/brand'

export const EXTERNAL_MODEL_CONSENT_SETTING_KEY = 'lumeweftExternalModelConsent'

export function isExternalModelConsentValid(value) {
  return Boolean(
    value
      && value.termsVersion === EXTERNAL_MODELS_TERMS_VERSION
      && value.adultConfirmed === true
      && value.ownRiskAccepted === true
      && value.rulesAccepted === true
      && typeof value.acceptedAt === 'string'
  )
}

export async function getExternalModelConsent() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (!api?.getSetting) return null
  return await api.getSetting(EXTERNAL_MODEL_CONSENT_SETTING_KEY)
}

export async function acceptExternalModelConsent() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (!api?.setSetting) throw new Error('External model settings are only available in the desktop build.')
  const consent = {
    termsVersion: EXTERNAL_MODELS_TERMS_VERSION,
    acceptedAt: new Date().toISOString(),
    adultConfirmed: true,
    ownRiskAccepted: true,
    rulesAccepted: true,
  }
  const result = await api.setSetting(EXTERNAL_MODEL_CONSENT_SETTING_KEY, consent)
  if (!result?.success) throw new Error(result?.error || 'Could not save external model consent.')
  return consent
}

export async function revokeExternalModelConsent() {
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (!api?.deleteSetting) return
  await api.deleteSetting(EXTERNAL_MODEL_CONSENT_SETTING_KEY)
}
