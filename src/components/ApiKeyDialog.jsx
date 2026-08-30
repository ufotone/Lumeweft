import { useCallback, useEffect, useRef, useState } from 'react'
import {
  X,
  KeyRound,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  Cloud,
} from 'lucide-react'
import {
  COMFY_PARTNER_DASHBOARD_URL,
  COMFY_PARTNER_WORKFLOWS,
  clearComfyPartnerApiKey,
  getComfyPartnerApiKey,
  openComfyPartnerDashboard,
  saveComfyPartnerApiKey,
  validateComfyPartnerApiKey,
} from '../services/comfyPartnerAuth'
import {
  getCloudRuntimeSettings,
  saveCloudRuntimeCredential,
  setImportedWorkflowRuntime,
  testCloudRuntimeCredential,
} from '../services/cloudRuntimes'
import { useI18n } from '../i18n/I18nContext'

function maskKey(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (raw.length <= 10) return `${raw.slice(0, 3)}••••${raw.slice(-2)}`
  return `${raw.slice(0, 6)}••••••${raw.slice(-4)}`
}

/**
 * Shared modal for adding, replacing, or removing the Comfy.org partner API key.
 *
 * The same component is reused from Settings, the Getting Started checklist,
 * the Workflow Setup gallery, and Generate so the experience is identical no
 * matter where the user first hits a "needs API key" prompt.
 */
export default function ApiKeyDialog({
  open,
  onClose,
  onSaved,
  headline,
  subhead,
  allowProviderSelection = false,
  initialProviderId = 'comfy-org',
}) {
  const { t } = useI18n()
  const [existingKey, setExistingKey] = useState('')
  const [providerId, setProviderId] = useState(initialProviderId)
  const [credentialFromEnvironment, setCredentialFromEnvironment] = useState(false)
  const [useFloyoForImportedWorkflows, setUseFloyoForImportedWorkflows] = useState(true)
  const [draftKey, setDraftKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [validation, setValidation] = useState({ state: 'idle', message: '' })
  const [validating, setValidating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)
  const abortRef = useRef(null)
  const isFloyo = providerId === 'floyo'

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const load = async () => {
      try {
        const stored = isFloyo
          ? await getCloudRuntimeSettings()
          : await getComfyPartnerApiKey()
        if (cancelled) return
        if (isFloyo) {
          const floyo = stored.providers?.find((provider) => provider.id === 'floyo')
          setExistingKey(floyo?.hasCredential ? '__configured__' : '')
          setCredentialFromEnvironment(Boolean(floyo?.credentialFromEnvironment))
          setUseFloyoForImportedWorkflows(floyo?.hasCredential
            ? stored.routing?.importedApiWorkflows === 'floyo'
            : true)
        } else {
          setExistingKey(stored)
          setCredentialFromEnvironment(false)
        }
        setDraftKey('')
        setShowKey(false)
        setValidation({ state: 'idle', message: '' })
        setError('')
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || t('apiKey.readFailed'))
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [isFloyo, open, t])

  useEffect(() => {
    if (open) setProviderId(initialProviderId)
  }, [initialProviderId, open])

  useEffect(() => {
    if (!open) return
    const focusTimer = setTimeout(() => {
      try { inputRef.current?.focus() } catch (_) { /* ignore */ }
    }, 40)
    return () => clearTimeout(focusTimer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  useEffect(() => () => {
    try { abortRef.current?.abort() } catch (_) { /* ignore */ }
  }, [])

  const handleGetKey = useCallback(async () => {
    const result = isFloyo
      ? await window.electronAPI?.openExternalUrl?.('https://www.floyo.ai/app')
      : await openComfyPartnerDashboard()
    if (!result?.success) {
      setError(t('apiKey.openFailed'))
    }
  }, [isFloyo, t])

  const runValidation = useCallback(async (candidate) => {
    const value = String(candidate || '').trim()
    if (!value) {
      setValidation({ state: 'invalid', message: t('apiKey.pasteFirst') })
      return null
    }
    setValidating(true)
    setValidation({ state: 'checking', message: t('apiKey.checking') })
    try {
      abortRef.current?.abort?.()
    } catch (_) { /* ignore */ }
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = isFloyo
        ? await testCloudRuntimeCredential('floyo', value).then(() => ({ status: 'valid' }))
        : await validateComfyPartnerApiKey(value, { signal: controller.signal })
      setValidation({
        state: result.status === 'valid' ? 'valid'
          : result.status === 'invalid' ? 'invalid'
          : 'unknown',
        message: result.status === 'valid'
          ? t(isFloyo ? 'apiKey.floyoAccepted' : 'apiKey.accepted')
          : (result.message || ''),
      })
      return result
    } catch (err) {
      const invalidCredential = isFloyo && [400, 401, 403].includes(Number(err?.status))
      setValidation({
        state: invalidCredential ? 'invalid' : 'unknown',
        message: err?.message || t('apiKey.validateFailed'),
      })
      return { status: invalidCredential ? 'invalid' : 'unknown' }
    } finally {
      setValidating(false)
    }
  }, [isFloyo, t])

  const handleTest = useCallback(() => {
    void runValidation(draftKey)
  }, [draftKey, runValidation])

  const handleSave = useCallback(async () => {
    const value = String(draftKey || '').trim()
    if (!value) {
      setError(t('apiKey.pasteBeforeSave'))
      return
    }
    setSaving(true)
    setError('')
    // If we haven't validated yet, try once — but don't block save on
    // "unknown" outcomes (offline, ambiguous endpoint, etc.).
    let finalState = validation.state
    if (validation.state === 'idle' || validation.state === 'checking') {
      const result = await runValidation(value)
      finalState = result?.status === 'valid' ? 'valid'
        : result?.status === 'invalid' ? 'invalid'
        : 'unknown'
    }
    if (finalState === 'invalid') {
      setSaving(false)
      return
    }
    try {
      if (isFloyo) {
        await saveCloudRuntimeCredential('floyo', value)
        if (useFloyoForImportedWorkflows) await setImportedWorkflowRuntime('floyo')
      } else {
        await saveComfyPartnerApiKey(value)
      }
      setSaving(false)
      onSaved?.(value, providerId)
      onClose?.()
    } catch (err) {
      setSaving(false)
      setError(err?.message || t('apiKey.saveFailed'))
    }
  }, [draftKey, isFloyo, onClose, onSaved, providerId, runValidation, t, useFloyoForImportedWorkflows, validation.state])

  const handleRemove = useCallback(async () => {
    setSaving(true)
    setError('')
    try {
      if (isFloyo) {
        await saveCloudRuntimeCredential('floyo', '')
        await setImportedWorkflowRuntime('local-comfyui')
      } else await clearComfyPartnerApiKey()
      setExistingKey('')
      setDraftKey('')
      setValidation({ state: 'idle', message: '' })
      setSaving(false)
      onSaved?.('', providerId)
    } catch (err) {
      setSaving(false)
      setError(err?.message || t('apiKey.removeFailed'))
    }
  }, [isFloyo, onSaved, providerId, t])

  if (!open) return null

  const hasDraft = Boolean(String(draftKey || '').trim())
  const hasExisting = Boolean(String(existingKey || '').trim())
  const providerName = isFloyo ? 'Floyo' : 'Comfy.org'
  const providerHost = isFloyo ? 'www.floyo.ai' : 'platform.comfy.org'

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-sf-dark-600 bg-sf-dark-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-sf-dark-700 px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-sf-dark-800 p-2">
              <KeyRound className="h-4 w-4 text-sf-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-sf-text-primary">
                {headline || t(allowProviderSelection ? 'apiKey.providersTitle' : 'apiKey.title')}
              </h2>
              <p className="mt-1 text-xs text-sf-text-muted">
                {subhead || t(allowProviderSelection ? 'apiKey.providersSubtitle' : 'apiKey.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-sf-text-muted transition-colors hover:bg-sf-dark-800 hover:text-sf-text-primary"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {allowProviderSelection && (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-sf-text-muted">
                {t('apiKey.provider')}
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-sf-dark-900/70 p-1">
                {[
                  { id: 'comfy-org', label: 'Comfy.org', icon: KeyRound },
                  { id: 'floyo', label: 'Floyo', icon: Cloud },
                ].map((provider) => {
                  const Icon = provider.icon
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => setProviderId(provider.id)}
                      className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${providerId === provider.id ? 'border-sf-accent/50 bg-sf-accent/15 text-sf-text-primary' : 'border-transparent text-sf-text-muted hover:bg-sf-dark-800 hover:text-sf-text-primary'}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {provider.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/70 px-3 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sf-text-muted">
              {t('apiKey.unlocks')}
            </div>
            <ul className="mt-1.5 space-y-0.5 text-xs text-sf-text-secondary">
              {(isFloyo ? [
                t('apiKey.floyoFeatureRun'),
                t('apiKey.floyoFeatureUpload'),
                t('apiKey.floyoFeatureBalance'),
              ] : COMFY_PARTNER_WORKFLOWS).map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1 w-1 rounded-full bg-sf-accent" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-sf-text-muted">
              {t(isFloyo ? 'apiKey.floyoCoverage' : 'apiKey.coverage')}
            </p>
          </div>

          {hasExisting && !hasDraft && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                  <div>
                    <div className="text-sm text-sf-text-primary">{providerName} · {t('apiKey.alreadySaved')}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-sf-text-muted">
                      {isFloyo ? (credentialFromEnvironment ? 'FLOYO_API_KEY' : t('apiKey.securelyStored')) : maskKey(existingKey)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { void handleRemove() }}
                  disabled={saving || credentialFromEnvironment}
                  className="inline-flex items-center gap-1 rounded-md border border-sf-dark-600 px-2 py-1 text-[11px] text-sf-text-muted transition-colors hover:border-sf-error/40 hover:text-sf-error disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  {t('apiKey.remove')}
                </button>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-medium text-sf-text-secondary" htmlFor="cloud-provider-key">
                {hasExisting ? t('apiKey.replacePrompt') : t('apiKey.pastePrompt')}
              </label>
              <button
                type="button"
                onClick={() => { void handleGetKey() }}
                className="inline-flex items-center gap-1 text-[11px] text-sf-accent hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {t('apiKey.getKey')}
              </button>
            </div>
            <div className="mt-1.5 flex gap-2">
              <div className="relative flex-1">
                <input
                  id="cloud-provider-key"
                  ref={inputRef}
                  type={showKey ? 'text' : 'password'}
                  disabled={credentialFromEnvironment}
                  autoComplete="off"
                  spellCheck={false}
                  value={draftKey}
                  onChange={(e) => {
                    setDraftKey(e.target.value)
                    if (validation.state !== 'idle') {
                      setValidation({ state: 'idle', message: '' })
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !validating && !saving && hasDraft) {
                      e.preventDefault()
                      void handleSave()
                    }
                  }}
                  placeholder={isFloyo ? 'Floyo API key' : 'comfyui-...'}
                  className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 pr-9 text-sm text-sf-text-primary placeholder-sf-text-muted focus:border-sf-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-sf-text-muted hover:text-sf-text-primary"
                  aria-label={showKey ? t('apiKey.hide') : t('apiKey.show')}
                  tabIndex={-1}
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleTest}
                disabled={!hasDraft || validating || saving || credentialFromEnvironment}
                className="inline-flex items-center gap-1.5 rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-secondary transition-colors hover:border-sf-dark-500 hover:text-sf-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                {t('apiKey.test')}
              </button>
            </div>

            {validation.state === 'checking' && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-sf-text-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                {validation.message || t('apiKey.checkingShort')}
              </div>
            )}
            {validation.state === 'valid' && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                {validation.message}
              </div>
            )}
            {validation.state === 'invalid' && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-sf-error">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{validation.message}</span>
              </div>
            )}
            {validation.state === 'unknown' && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-yellow-300">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{validation.message}</span>
              </div>
            )}
          </div>

          {isFloyo && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900/40 px-3 py-2.5">
              <input
                type="checkbox"
                checked={useFloyoForImportedWorkflows}
                onChange={(event) => setUseFloyoForImportedWorkflows(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-sf-accent"
              />
              <span>
                <span className="block text-xs text-sf-text-primary">{t('apiKey.useFloyo')}</span>
                <span className="mt-0.5 block text-[10px] text-sf-text-muted">{t('apiKey.useFloyoHelp')}</span>
              </span>
            </label>
          )}

          {error && (
            <div className="rounded border border-sf-error/40 bg-sf-error/10 px-3 py-2 text-[11px] text-sf-error">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/40 px-3 py-2.5 text-[11px] text-sf-text-muted">
            {isFloyo ? t('apiKey.floyoStorage') : (
              <>{t('apiKey.storagePrefix')}{' '}<code className="rounded bg-sf-dark-800 px-1">api_key_comfy_org</code>{' '}{t('apiKey.storageSuffix')}</>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-sf-dark-700 bg-sf-dark-900/40 px-5 py-3">
          <a
            href={isFloyo ? 'https://www.floyo.ai/app' : COMFY_PARTNER_DASHBOARD_URL}
            onClick={(event) => {
              event.preventDefault()
              void handleGetKey()
            }}
            className="inline-flex items-center gap-1 text-[11px] text-sf-text-muted hover:text-sf-text-primary"
          >
            <ExternalLink className="h-3 w-3" />
            {providerHost}
          </a>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-sf-dark-600 px-3 py-1.5 text-xs text-sf-text-secondary transition-colors hover:text-sf-text-primary hover:border-sf-dark-500"
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={() => { void handleSave() }}
              disabled={!hasDraft || saving || validating || validation.state === 'invalid' || credentialFromEnvironment}
              className="inline-flex items-center gap-1.5 rounded bg-sf-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sf-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {hasExisting ? t('apiKey.replace') : t('apiKey.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
