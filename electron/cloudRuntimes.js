const FLOYO_API_URL = 'https://api.floyo.ai'
const FLOYO_CDN_URL = 'https://cdn.floyo.ai'
const GOOGLE_GEMINI_API_URL = 'https://generativelanguage.googleapis.com'

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
  Object.freeze({
    id: 'google-gemini',
    name: 'Google Gemini API',
    description: 'Generate images with Nano Banana and videos with Veo through the official Gemini API.',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    dashboardUrl: 'https://aistudio.google.com/apikey',
    environmentKey: 'GEMINI_API_KEY',
    capabilities: Object.freeze(['image-generation', 'video-generation']),
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

function createGoogleGeminiClient({ apiKey, fetchImpl = globalThis.fetch, baseUrl = GOOGLE_GEMINI_API_URL } = {}) {
  const providerId = 'google-gemini'
  const key = String(apiKey || '').trim()
  if (!key) throw new CloudRuntimeError('Google Gemini API key is not configured.', { providerId, code: 'missing_api_key' })
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.')
  const apiBase = normalizeBaseUrl(baseUrl, GOOGLE_GEMINI_API_URL)
  const headers = { 'x-goog-api-key': key }

  async function request(pathname, options = {}) {
    const response = await fetchImpl(`${apiBase}${pathname}`, {
      ...options,
      headers: { Accept: 'application/json', ...headers, ...(options.headers || {}) },
    })
    return parseResponse(response, providerId)
  }

  const inlineImage = (image) => {
    if (!image?.bytes) return null
    return {
      inlineData: {
        mimeType: String(image.mimeType || 'image/png'),
        data: Buffer.from(image.bytes).toString('base64'),
      },
    }
  }

  const findInteractionOutputImage = (payload) => {
    const interaction = payload?.interaction && typeof payload.interaction === 'object'
      ? payload.interaction
      : payload
    const directImage = interaction?.output_image || interaction?.outputImage
    if (directImage?.data) return directImage

    const steps = Array.isArray(interaction?.steps) ? interaction.steps : []
    for (let stepIndex = steps.length - 1; stepIndex >= 0; stepIndex -= 1) {
      const content = Array.isArray(steps[stepIndex]?.content) ? steps[stepIndex].content : []
      for (let contentIndex = content.length - 1; contentIndex >= 0; contentIndex -= 1) {
        const part = content[contentIndex]
        if (part?.type === 'image' && part?.data) return part
      }
    }
    return null
  }

  const describeInteractionWithoutImage = (payload) => {
    const interaction = payload?.interaction && typeof payload.interaction === 'object'
      ? payload.interaction
      : payload
    const textParts = (Array.isArray(interaction?.steps) ? interaction.steps : [])
      .flatMap((step) => Array.isArray(step?.content) ? step.content : [])
      .filter((part) => part?.type === 'text' && String(part?.text || '').trim())
      .map((part) => String(part.text).trim())
    const detail = textParts.at(-1)
      || interaction?.error?.message
      || interaction?.message
      || interaction?.status
      || ''
    return String(detail).trim().slice(0, 500)
  }

  return {
    async testConnection() {
      await request('/v1beta/models?pageSize=1')
      return { success: true }
    },
    async generateImage({ prompt, image = null, images = [], model = 'gemini-3.1-flash-lite-image', aspectRatio = '1:1', imageSize = '1K' } = {}) {
      const text = String(prompt || '').trim()
      if (!text) throw new CloudRuntimeError('An image prompt is required.', { providerId, code: 'missing_prompt' })
      const inputImages = [image, ...(Array.isArray(images) ? images : [])]
        .map(inlineImage)
        .filter(Boolean)
        .slice(0, 14)
      const input = inputImages.length
        ? [{ type: 'text', text }, ...inputImages.map((item) => ({ type: 'image', mime_type: item.inlineData.mimeType, data: item.inlineData.data }))]
        : text
      const payload = await request('/v1beta/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: String(model || 'gemini-3.1-flash-lite-image'),
          input,
          response_format: {
            type: 'image',
            mime_type: 'image/jpeg',
            aspect_ratio: String(aspectRatio || '1:1'),
            image_size: String(imageSize || '1K'),
          },
        }),
      })
      const outputImage = findInteractionOutputImage(payload)
      if (!outputImage?.data) {
        const detail = describeInteractionWithoutImage(payload)
        throw new CloudRuntimeError(`Google Gemini returned no image${detail ? `: ${detail}` : '.'}`, { providerId, code: 'missing_output', details: payload })
      }
      return {
        mimeType: String(outputImage.mime_type || outputImage.mimeType || 'image/jpeg'),
        data: String(outputImage.data),
        model: String(model || 'gemini-3.1-flash-lite-image'),
      }
    },
    createVideo({ prompt, image = null, model = 'veo-3.1-lite-generate-preview', aspectRatio = '16:9', durationSeconds = 4, resolution = '720p' } = {}) {
      const text = String(prompt || '').trim()
      if (!text) throw new CloudRuntimeError('A video prompt is required.', { providerId, code: 'missing_prompt' })
      const inputImage = inlineImage(image)
      return request(`/v1beta/models/${encodeURIComponent(String(model || 'veo-3.1-lite-generate-preview'))}:predictLongRunning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: text, ...(inputImage ? { image: inputImage } : {}) }],
          parameters: {
            aspectRatio: String(aspectRatio || '16:9'),
            durationSeconds: [4, 6, 8].includes(Number(durationSeconds)) ? Number(durationSeconds) : 4,
            resolution: String(resolution || '720p'),
            numberOfVideos: 1,
          },
        }),
      })
    },
    getVideoOperation(operationName) {
      const name = String(operationName || '').trim().replace(/^\/+/, '')
      if (!name) throw new CloudRuntimeError('Missing Google video operation name.', { providerId, code: 'missing_operation' })
      return request(`/v1beta/${name}`)
    },
    async downloadMedia(uri) {
      const mediaUrl = String(uri || '').trim()
      let parsedUrl
      try { parsedUrl = new URL(mediaUrl) } catch { /* handled below */ }
      const hostname = String(parsedUrl?.hostname || '').toLowerCase()
      const trustedGoogleHost = hostname === 'googleapis.com'
        || hostname.endsWith('.googleapis.com')
        || hostname === 'googleusercontent.com'
        || hostname.endsWith('.googleusercontent.com')
      if (parsedUrl?.protocol !== 'https:' || !trustedGoogleHost) {
        throw new CloudRuntimeError('Google returned an invalid media URL.', { providerId, code: 'invalid_media_url' })
      }
      const response = await fetchImpl(mediaUrl, { headers })
      if (!response.ok) return parseResponse(response, providerId)
      const bytes = Buffer.from(await response.arrayBuffer())
      return {
        mimeType: String(response.headers.get('content-type') || 'video/mp4').split(';')[0],
        data: bytes.toString('base64'),
      }
    },
  }
}

function createCloudRuntimeClient(providerId, options = {}) {
  if (!getCloudRuntimeProvider(providerId)) {
    throw new CloudRuntimeError(`Unknown cloud runtime: ${providerId || '(missing)'}.`, { providerId, code: 'unknown_provider' })
  }
  if (providerId === 'floyo') return createFloyoClient(options)
  if (providerId === 'google-gemini') return createGoogleGeminiClient(options)
  throw new CloudRuntimeError(`Cloud runtime ${providerId} is not implemented.`, { providerId, code: 'unsupported_provider' })
}

module.exports = {
  CLOUD_RUNTIME_PROVIDERS,
  CloudRuntimeError,
  createCloudRuntimeClient,
  getCloudRuntimeProvider,
}
