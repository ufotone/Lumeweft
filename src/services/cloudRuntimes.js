export const CLOUD_RUNTIME_SETTINGS_CHANGED_EVENT = 'lumeweft-cloud-runtime-settings-changed'
export const LOCAL_COMFY_RUNTIME_ID = 'local-comfyui'

function requireBridge() {
  const bridge = typeof window !== 'undefined' ? window.electronAPI?.cloudRuntimes : null
  if (!bridge) throw new Error('Cloud runtimes are available in the Lumeweft desktop app.')
  return bridge
}

function unwrap(result, fallback) {
  if (result?.success) return result
  const error = new Error(result?.error || fallback || 'Cloud runtime request failed.')
  Object.assign(error, {
    providerId: result?.providerId || '', status: result?.status || 0,
    type: result?.type || '', code: result?.code || '', details: result?.details || null,
  })
  throw error
}

export async function getCloudRuntimeSettings() {
  return unwrap(await requireBridge().getSettings(), 'Could not load cloud runtime settings.')
}

export async function saveCloudRuntimeCredential(providerId, apiKey) {
  const result = unwrap(await requireBridge().saveCredential({ providerId, apiKey }), 'Could not save the credential.')
  window.dispatchEvent(new CustomEvent(CLOUD_RUNTIME_SETTINGS_CHANGED_EVENT, { detail: result }))
  return result
}

export async function setImportedWorkflowRuntime(runtimeId) {
  const result = unwrap(await requireBridge().setRouting({ importedApiWorkflows: runtimeId }), 'Could not update cloud runtime routing.')
  window.dispatchEvent(new CustomEvent(CLOUD_RUNTIME_SETTINGS_CHANGED_EVENT, { detail: result }))
  return result
}

export async function testCloudRuntime(providerId) {
  return unwrap(await requireBridge().testConnection({ providerId }), 'Could not connect to the cloud runtime.')
}

export async function testCloudRuntimeCredential(providerId, apiKey) {
  return unwrap(await requireBridge().testCredential({ providerId, apiKey }), 'Could not validate the cloud runtime credential.')
}

export async function getCloudRuntimeBalance(providerId) {
  return unwrap(await requireBridge().getBalance({ providerId }), 'Could not retrieve the cloud runtime balance.').balance
}

export async function uploadCloudRuntimeFile(providerId, file) {
  return unwrap(await requireBridge().uploadFile(providerId, file), 'Could not upload the input.').file
}

export async function createCloudRuntimeRun(providerId, workflow, { name = '' } = {}) {
  return unwrap(await requireBridge().createRun({ providerId, workflow, name }), 'Could not queue the workflow.').run
}

export async function getCloudRuntimeRun(providerId, runId) {
  return unwrap(await requireBridge().getRun({ providerId, runId, presignedUrlExpiresIn: 3600 }), 'Could not retrieve the run.').run
}

export async function cancelCloudRuntimeRun(providerId, runId) {
  return unwrap(await requireBridge().cancelRun({ providerId, runId }), 'Could not cancel the run.')
}

export async function generateGoogleImage(payload = {}) {
  return unwrap(await requireBridge().generateImage({ providerId: 'google-gemini', ...payload }), 'Google image generation failed.').media
}

export async function createGoogleVideo(payload = {}) {
  return unwrap(await requireBridge().createVideo({ providerId: 'google-gemini', ...payload }), 'Google video generation failed.').operation
}

export async function getGoogleVideoOperation(operationName) {
  return unwrap(await requireBridge().getVideoOperation({ providerId: 'google-gemini', operationName }), 'Could not retrieve Google video progress.').operation
}

export async function downloadGoogleMedia(uri) {
  return unwrap(await requireBridge().downloadMedia({ providerId: 'google-gemini', uri }), 'Could not download Google media.').media
}

export async function pollCloudRuntimeRun(providerId, runId, { onProgress = () => {}, pollIntervalMs = 3000, timeoutMs = 4 * 60 * 60 * 1000 } = {}) {
  const startedAt = Date.now()
  let retryDelay = pollIntervalMs
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const run = await getCloudRuntimeRun(providerId, runId)
      const status = String(run?.status || '').toLowerCase()
      if (status === 'complete') return run
      if (status === 'failed') throw Object.assign(new Error(run?.error?.message || `${providerId} workflow failed.`), run?.error || {})
      if (status === 'canceled') throw new Error(`${providerId} workflow was canceled.`)
      const elapsedRatio = Math.min(1, (Date.now() - startedAt) / (15 * 60 * 1000))
      onProgress(Math.min(90, 45 + (elapsedRatio * 45)), run)
      retryDelay = pollIntervalMs
    } catch (error) {
      if (error?.status !== 429) throw error
      retryDelay = Math.min(30000, Math.max(pollIntervalMs, retryDelay * 2))
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelay))
  }
  throw new Error(`${providerId} workflow timed out after 4 hours.`)
}

export function cloudRuntimeRunToGenerationResult(run) {
  const items = (Array.isArray(run?.outputs) ? run.outputs : []).map((output) => ({
    filename: output.file_name || output.filename || output.name || 'cloud-output',
    subfolder: output.id || output.path || output.key || '',
    presignedUrl: output.presigned_url || output.presignedUrl || '',
    mimeType: output.mime_type || output.mimeType || '',
    outputType: 'cloud-runtime',
  })).filter((item) => item.presignedUrl)
  if (!items.length) return null
  const kindFor = (item) => {
    const value = `${item.mimeType} ${item.filename}`.toLowerCase()
    if (value.includes('video/') || /\.(mp4|webm|mov|mkv|gif)$/i.test(item.filename)) return 'video'
    if (value.includes('audio/') || /\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(item.filename)) return 'audio'
    return 'image'
  }
  const videos = items.filter((item) => kindFor(item) === 'video').map((item) => ({ type: 'video', ...item }))
  if (videos.length === 1) return videos[0]
  if (videos.length > 1) return { type: 'videos', items: videos }
  const audio = items.find((item) => kindFor(item) === 'audio')
  if (audio) return { type: 'audio', ...audio }
  return { type: 'images', items: items.map((item) => ({ type: 'image', ...item })) }
}
