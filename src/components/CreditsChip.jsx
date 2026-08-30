import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Coins, AlertTriangle, Loader2 } from 'lucide-react'
import {
  getComfyPartnerApiKey,
  COMFY_PARTNER_KEY_CHANGED_EVENT,
  COMFY_PARTNER_CREDITS_LOW_EVENT,
} from '../services/comfyPartnerAuth'
import { comfyui } from '../services/comfyui'
import {
  CLOUD_CREDIT_DISPLAY_CHANGED_EVENT,
  getShowCloudCreditBalance,
} from '../services/cloudCreditDisplaySettings'
import {
  CLOUD_RUNTIME_SETTINGS_CHANGED_EVENT,
  LOCAL_COMFY_RUNTIME_ID,
  getCloudRuntimeBalance,
  getCloudRuntimeSettings,
} from '../services/cloudRuntimes'

/**
 * CreditsChip
 *
 * A compact status pill that surfaces the user's Comfy.org credit balance.
 *
 * Behaviour:
 *   - In Electron, the chip can read the logged-in embedded ComfyUI session
 *     through the main-process bridge and display the same balance shown in
 *     ComfyUI's Settings > Credits panel.
 *   - In browser mode, or as a fallback, it still supports the older stored
 *     Comfy Partner API key path via `comfyui.getComfyOrgCreditBalance()`.
 *   - A failed queue submission anywhere in the app can dispatch the
 *     `COMFY_PARTNER_CREDITS_LOW_EVENT` and this chip flips into an amber
 *     "Out of credits" state immediately.
 */
function CreditsChip({ className = '', size = 'sm' }) {
  const [showCreditBalance, setShowCreditBalance] = useState(() => getShowCloudCreditBalance())
  const [hasKey, setHasKey] = useState(false)
  const [runtimeSettings, setRuntimeSettings] = useState({ providers: [], routing: { importedApiWorkflows: LOCAL_COMFY_RUNTIME_ID } })
  const [balance, setBalance] = useState({
    status: 'idle', // 'idle' | 'loading' | 'ok' | 'unknown' | 'low'
    credits: null,
    floTimeMs: null,
    partnerNodesUsd: null,
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const pollTimerRef = useRef(null)
  const mountedRef = useRef(true)
  const refreshInFlightRef = useRef(false)
  const hasEmbeddedBalanceSupport = typeof window !== 'undefined'
    && typeof window?.electronAPI?.getComfyCloudCreditBalance === 'function'
  const selectedRuntimeId = String(runtimeSettings.routing?.importedApiWorkflows || LOCAL_COMFY_RUNTIME_ID)
  const selectedProvider = selectedRuntimeId === LOCAL_COMFY_RUNTIME_ID
    ? null
    : runtimeSettings.providers.find((provider) => provider.id === selectedRuntimeId) || null

  useEffect(() => {
    const onDisplayChanged = (event) => {
      setShowCreditBalance(event?.detail?.show !== false)
    }
    window.addEventListener(CLOUD_CREDIT_DISPLAY_CHANGED_EVENT, onDisplayChanged)
    return () => window.removeEventListener(CLOUD_CREDIT_DISPLAY_CHANGED_EVENT, onDisplayChanged)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const settings = await getCloudRuntimeSettings()
        if (!cancelled) {
          setRuntimeSettings(settings)
          setBalance({ status: 'idle', credits: null, floTimeMs: null, partnerNodesUsd: null })
        }
      } catch (_) { /* desktop bridge may not be available in browser previews */ }
    }
    void load()
    window.addEventListener(CLOUD_RUNTIME_SETTINGS_CHANGED_EVENT, load)
    return () => {
      cancelled = true
      window.removeEventListener(CLOUD_RUNTIME_SETTINGS_CHANGED_EVENT, load)
    }
  }, [])

  const refreshBalance = useCallback(async () => {
    if (refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    if (mountedRef.current) setIsRefreshing(true)

    try {
      setBalance((prev) => {
        if (prev.status === 'low') return prev
        if (Number.isFinite(prev.credits)) return prev
        return { ...prev, status: 'loading' }
      })

      if (selectedProvider?.hasCredential) {
        const result = await getCloudRuntimeBalance(selectedProvider.id)
        if (!mountedRef.current) return
        const floTimeMs = firstFiniteNumber(result?.available_flotime_ms, result?.availableFloTimeMs)
        const partnerNodesUsd = firstFiniteNumber(result?.partner_nodes_usd, result?.partnerNodesUsd)
        if (floTimeMs !== null || partnerNodesUsd !== null) {
          setBalance({ status: 'ok', credits: null, floTimeMs, partnerNodesUsd })
        } else {
          setBalance({ status: 'unknown', credits: null, floTimeMs: null, partnerNodesUsd: null })
        }
        return
      }

      const embeddedLookup = typeof window !== 'undefined'
        ? window?.electronAPI?.getComfyCloudCreditBalance
        : null
      if (typeof embeddedLookup === 'function') {
        const embeddedResult = await embeddedLookup()
        if (!mountedRef.current) return
        if (embeddedResult?.status === 'ok' && Number.isFinite(embeddedResult.credits)) {
          setBalance({ status: 'ok', credits: embeddedResult.credits, floTimeMs: null, partnerNodesUsd: null })
          return
        }
      }

      const key = await getComfyPartnerApiKey()
      if (!key) {
        if (!mountedRef.current) return
        setBalance((prev) => prev.status === 'low' || Number.isFinite(prev.credits)
          ? prev
          : { status: 'unknown', credits: null, floTimeMs: null, partnerNodesUsd: null })
        return
      }

      const result = await comfyui.getComfyOrgCreditBalance()
      if (!mountedRef.current) return

      if (result?.status === 'ok' && Number.isFinite(result.credits)) {
        setBalance({ status: 'ok', credits: result.credits, floTimeMs: null, partnerNodesUsd: null })
      } else {
        setBalance((prev) => prev.status === 'low' || Number.isFinite(prev.credits)
          ? prev
          : { status: 'unknown', credits: null, floTimeMs: null, partnerNodesUsd: null })
      }
    } catch (_) {
      if (!mountedRef.current) return
      setBalance((prev) => prev.status === 'low' || Number.isFinite(prev.credits)
        ? prev
        : { status: 'unknown', credits: null, floTimeMs: null, partnerNodesUsd: null })
    } finally {
      refreshInFlightRef.current = false
      if (mountedRef.current) setIsRefreshing(false)
    }
  }, [selectedProvider?.hasCredential, selectedProvider?.id])

  // Track API-key presence for the legacy fallback; re-evaluate when the user
  // adds/removes a key.
  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    const load = async () => {
      const key = await getComfyPartnerApiKey()
      if (cancelled) return
      setHasKey(Boolean(key))
    }
    load()

    const onKeyChanged = () => { load() }
    window.addEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, onKeyChanged)

    return () => {
      cancelled = true
      mountedRef.current = false
      window.removeEventListener(COMFY_PARTNER_KEY_CHANGED_EVENT, onKeyChanged)
    }
  }, [])

  const handleRefresh = useCallback((e) => {
    e.preventDefault?.()
    e.stopPropagation?.()
    refreshBalance()
  }, [refreshBalance])

  // Poll when either balance source is available. The embedded ComfyUI source
  // gracefully returns "not-authenticated" until the user logs in.
  useEffect(() => {
    const canQueryBalance = showCreditBalance && (
      selectedProvider?.hasCredential || (!selectedProvider && (hasKey || hasEmbeddedBalanceSupport))
    )

    if (!canQueryBalance) {
      setBalance({ status: 'idle', credits: null, floTimeMs: null, partnerNodesUsd: null })
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
      return
    }

    refreshBalance()
    pollTimerRef.current = setInterval(refreshBalance, 2 * 60 * 1000)
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current)
        pollTimerRef.current = null
      }
    }
  }, [hasKey, hasEmbeddedBalanceSupport, refreshBalance, selectedProvider?.hasCredential, selectedProvider?.id, showCreditBalance])

  // Flip into "low" state the moment any surface dispatches the event.
  useEffect(() => {
    const onLow = () => {
      if (!selectedProvider) setBalance({ status: 'low', credits: null, floTimeMs: null, partnerNodesUsd: null })
    }
    window.addEventListener(COMFY_PARTNER_CREDITS_LOW_EVENT, onLow)
    return () => window.removeEventListener(COMFY_PARTNER_CREDITS_LOW_EVENT, onLow)
  }, [selectedProvider])

  const labelPieces = useMemo(() => {
    if (balance.status === 'low') {
      return {
        label: 'Out of credits',
        tooltip: 'A recent job failed because your Comfy.org credit balance is exhausted.',
      }
    }
    if (balance.status === 'ok' && selectedProvider) {
      const values = []
      if (Number.isFinite(balance.floTimeMs)) values.push(`${formatFloTime(balance.floTimeMs)} FloTime`)
      if (Number.isFinite(balance.partnerNodesUsd)) values.push(formatUsd(balance.partnerNodesUsd))
      return {
        label: `${selectedProvider.name} · ${values.join(' · ') || 'Balance'}`,
        tooltip: isRefreshing
          ? `Refreshing your ${selectedProvider.name} balance...`
          : `${selectedProvider.name} available FloTime and Partner Nodes balance. Click to refresh.`,
      }
    }
    if (balance.status === 'ok' && Number.isFinite(balance.credits)) {
      return {
        label: `${formatCreditCount(balance.credits)} credits`,
        tooltip: isRefreshing
          ? 'Refreshing your Comfy.org credit balance...'
          : 'Click to refresh your Comfy.org credit balance.',
      }
    }
    if (balance.status === 'loading') {
      return {
        label: 'Credits',
        tooltip: 'Checking your Comfy.org credit balance...',
      }
    }
    return {
      label: 'Credits',
      tooltip: 'Log in through the embedded ComfyUI account settings to show your live balance.',
    }
  }, [balance, isRefreshing, selectedProvider])

  if (!showCreditBalance || (selectedProvider ? !selectedProvider.hasCredential : (!hasKey && !hasEmbeddedBalanceSupport))) return null

  const isLow = balance.status === 'low'
  const isLive = balance.status === 'ok'
  const isLoading = balance.status === 'loading' || isRefreshing

  const sizeClasses = size === 'xs'
    ? 'h-6 px-2 text-[10.5px] gap-1'
    : 'h-7 px-2.5 text-[11px] gap-1.5'

  const iconSize = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'

  return (
    <button
      type="button"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={handleRefresh}
      aria-live="polite"
      title={labelPieces.tooltip}
      className={`no-drag flex items-center rounded-md font-medium border transition-colors ${sizeClasses} ${
        isLow
          ? 'bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/50 text-amber-100'
          : isLive
            ? 'bg-sf-dark-800 hover:bg-sf-dark-700 border-sf-dark-700 text-sf-text-primary'
            : 'bg-sf-dark-800 hover:bg-sf-dark-700 border-sf-dark-700 text-sf-text-secondary'
      } ${className}`}
    >
      {isLow ? (
        <AlertTriangle className={`${iconSize} text-amber-300 flex-shrink-0`} />
      ) : isLoading ? (
        <Loader2 className={`${iconSize} animate-spin flex-shrink-0`} />
      ) : (
        <Coins className={`${iconSize} flex-shrink-0 ${isLive ? 'text-amber-300' : 'text-sf-text-muted'}`} />
      )}
      <span className="whitespace-nowrap">{labelPieces.label}</span>
    </button>
  )
}

function formatCreditCount(n) {
  if (!Number.isFinite(n)) return '-'
  // Match the dashboard's display style: 3,004.00
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function firstFiniteNumber(...values) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return null
}

function formatFloTime(milliseconds) {
  const totalMinutes = Math.max(0, Math.floor(Number(milliseconds) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
}

function formatUsd(value) {
  return Number(value).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default CreditsChip
