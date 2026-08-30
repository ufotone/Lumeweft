const FLOYO_API_URL = 'https://api.floyo.ai'
const FLOYO_CDN_URL = 'https://cdn.floyo.ai'

const CLOUD_RUNTIME_PROVIDERS = Object.freeze([
  Object.freeze({
    id: 'floyo',
    name: 'Floyo',
    description: 'Run ComfyUI API workflows on Floyo cloud GPUs.',
    docsUrl: 'https://docs.floyo.ai/floyo-api-introduction',
    dashboardUrl: 'https://www.floyo.ai/app',
    environmentKey: 'FLOYO_API_KEY',
    capabilities: Object.freeze(['workflow-runs', 'file-upload', 'cancel', 'balance']),
  }),
])

class CloudRuntimeError extends Error {
  constructor(message, { providerId = '', status = 0, code = '', type = '', details = null } = {}) {
    super(message)
    this.name = 'CloudRuntimeError'
    this.providerId = providerId
    this.status = status
    this.code = code
    this.type = type
    this.details = details
  }
}

function getCloudRuntimeProvider(providerId) {
  return CLOUD_RUNTIME_PROVIDERS.find((provider) => provider.id === String(providerId || '').trim()) || null
}

function normalizeBaseUrl(value, fallback) {
  return String(value || fallback).trim().replace(/\/+$/, '')
}

async function parseResponse(response, providerId) {
  const text = await response.text()
  let payload = null
  if (text) {
    try { payload = JSON.parse(text) } catch { payload = { message: text } }
  }
  if (!response.ok) {
    const structured = payload?.error && typeof payload.error === 'object' ? payload.error : payload
    throw new CloudRuntimeError(String(
      structured?.message || payload?.message || payload?.error || `${providerId} returned HTTP ${response.status}.`
    ).trim(), {
      providerId,
      status: response.status,
      code: structured?.code || '',
      type: structured?.type || '',
      details: structured?.details || payload?.details || null,
    })
  }
  return payload || {}
}

function createFloyoClient({ apiKey, fetchImpl = globalThis.fetch, baseUrl = FLOYO_API_URL, cdnUrl = FLOYO_CDN_URL } = {}) {
  const providerId = 'floyo'
  const key = String(apiKey || '').trim()
  if (!key) throw new CloudRuntimeError('Floyo API key is not configured.', { providerId, code: 'missing_api_key' })
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.')
  const apiBase = normalizeBaseUrl(baseUrl, FLOYO_API_URL)
  const cdnBase = normalizeBaseUrl(cdnUrl, FLOYO_CDN_URL)
  const authHeaders = { Authorization: `Bearer ${key}` }

  async function request(pathname, options = {}) {
    const response = await fetchImpl(`${apiBase}${pathname}`, {
      ...options,
      headers: { Accept: 'application/json', ...authHeaders, ...(options.headers || {}) },
    })
    return parseResponse(response, providerId)
  }

  return {
    async testConnection() {
      await request('/team/balance')
      return { success: true }
    },
    async getBalance() {
      const balance = await request('/team/balance')
      const availableFloTimeMs = balance?.available_flotime_ms === null || balance?.available_flotime_ms === undefined
        ? null
        : Number(balance.available_flotime_ms)
      const partnerNodesUsd = balance?.partner_nodes_usd === null || balance?.partner_nodes_usd === undefined
        ? null
        : Number(balance.partner_nodes_usd)
      return {
        providerId,
        availableFloTimeMs: Number.isFinite(availableFloTimeMs) ? availableFloTimeMs : null,
        partnerNodesUsd: Number.isFinite(partnerNodesUsd) ? partnerNodesUsd : null,
        calculatedAt: String(balance?.calculated_at || ''),
      }
    },
    createRun(workflow, { name = '' } = {}) {
      if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
        throw new CloudRuntimeError('Floyo needs a ComfyUI API workflow JSON object.', { providerId, code: 'invalid_workflow' })
      }
      return request('/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow, ...(String(name).trim() ? { name: String(name).trim() } : {}) }),
      })
    },
    getRun(runId, { presignedUrlExpiresIn = 3600 } = {}) {
      const id = encodeURIComponent(String(runId || '').trim())
      if (!id) throw new CloudRuntimeError('Missing Floyo run ID.', { providerId, code: 'missing_run_id' })
      const expires = Math.max(30, Math.min(84600, Math.floor(Number(presignedUrlExpiresIn) || 3600)))
      return request(`/runs/${id}?expand=outputs.presigned_url&presigned_url_expires_in=${expires}`)
    },
    cancelRun(runId) {
      const id = encodeURIComponent(String(runId || '').trim())
      if (!id) throw new CloudRuntimeError('Missing Floyo run ID.', { providerId, code: 'missing_run_id' })
      return request(`/runs/${id}/cancel`, { method: 'POST' })
    },
    async uploadFile({ bytes, filename, mimeType = 'application/octet-stream', path = '/api/uploads' } = {}) {
      const safeName = String(filename || 'upload.bin').replace(/[\\/]/g, '_')
      const body = new FormData()
      body.append('file', new Blob([bytes], { type: mimeType }), safeName)
      body.append('path', String(path || '/api/uploads'))
      body.append('filename', safeName)
      body.append('on_conflict', 'rename')
      const response = await fetchImpl(`${cdnBase}/upload`, { method: 'POST', headers: authHeaders, body })
      return parseResponse(response, providerId)
    },
  }
}

function createCloudRuntimeClient(providerId, options = {}) {
  if (!getCloudRuntimeProvider(providerId)) {
    throw new CloudRuntimeError(`Unknown cloud runtime: ${providerId || '(missing)'}.`, { providerId, code: 'unknown_provider' })
  }
  if (providerId === 'floyo') return createFloyoClient(options)
  throw new CloudRuntimeError(`Cloud runtime ${providerId} is not implemented.`, { providerId, code: 'unsupported_provider' })
}

module.exports = {
  CLOUD_RUNTIME_PROVIDERS,
  CloudRuntimeError,
  createCloudRuntimeClient,
  getCloudRuntimeProvider,
}
