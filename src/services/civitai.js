const CIVITAI_MODEL_URL_RE = /^https?:\/\/(?:www\.)?civitai\.(?:com|red)\/models\/(\d+)(?:\/[^?#]*)?(?:[?#].*)?$/i
const CIVITAI_MEDIA_URL_RE = /^https?:\/\/(?:www\.)?civitai\.(?:com|red)\/(?:images|videos)\/(\d+)(?:\/[^?#]*)?(?:[?#].*)?$/i

export function parseCivitaiReference(value) {
  const input = String(value || '').trim()
  if (/^\d+$/.test(input)) return { kind: 'model', modelId: Number(input), sourceUrl: `https://civitai.com/models/${input}` }
  const modelMatch = input.match(CIVITAI_MODEL_URL_RE)
  if (modelMatch) {
    let modelVersionId = null
    try { modelVersionId = Number(new URL(input).searchParams.get('modelVersionId')) || null } catch { /* regex already validated the URL */ }
    return { kind: 'model', modelId: Number(modelMatch[1]), modelVersionId, sourceUrl: `https://civitai.com/models/${modelMatch[1]}` }
  }
  const mediaMatch = input.match(CIVITAI_MEDIA_URL_RE)
  if (mediaMatch) return { kind: 'media', mediaId: Number(mediaMatch[1]), sourceUrl: `https://civitai.com/images/${mediaMatch[1]}` }
  return null
}

export function parseCivitaiModelReference(value) {
  const parsed = parseCivitaiReference(value)
  return parsed?.kind === 'model' ? { modelId: parsed.modelId, sourceUrl: parsed.sourceUrl } : null
}

function normalizeFile(file = {}) {
  return {
    id: Number(file.id) || null,
    name: String(file.name || '').trim(),
    type: String(file.type || 'Model').trim(),
    sizeBytes: Math.max(0, Number(file.sizeKB) || 0) * 1024,
    format: String(file.metadata?.format || '').trim(),
    precision: String(file.metadata?.fp || '').trim(),
    primary: file.primary === true,
    virusScanResult: String(file.virusScanResult || '').trim(),
    pickleScanResult: String(file.pickleScanResult || '').trim(),
    sha256: String(file.hashes?.SHA256 || '').trim(),
    downloadUrl: String(file.downloadUrl || '').trim(),
  }
}

function imageIdFromUrl(value) {
  const match = String(value || '').match(/\/(\d+)\.(?:png|jpe?g|webp)(?:[?#]|$)/i)
  return match ? Number(match[1]) : null
}

export function normalizeCivitaiModel(raw = {}) {
  return {
    id: Number(raw.id) || null,
    name: String(raw.name || '').trim(),
    type: String(raw.type || '').trim(),
    nsfw: raw.nsfw === true,
    creator: String(raw.creator?.username || '').trim(),
    sourceUrl: raw.id ? `https://civitai.com/models/${raw.id}` : '',
    permissions: {
      allowNoCredit: raw.allowNoCredit === true,
      allowCommercialUse: Array.isArray(raw.allowCommercialUse) ? raw.allowCommercialUse.map(String) : [],
      allowDerivatives: raw.allowDerivatives === true,
      allowDifferentLicense: raw.allowDifferentLicense === true,
    },
    stats: raw.stats && typeof raw.stats === 'object' ? raw.stats : {},
    versions: (Array.isArray(raw.modelVersions) ? raw.modelVersions : []).map((version) => ({
      id: Number(version.id) || null,
      name: String(version.name || '').trim(),
      baseModel: String(version.baseModel || '').trim(),
      trainedWords: Array.isArray(version.trainedWords) ? version.trainedWords.map(String).filter(Boolean) : [],
      files: (Array.isArray(version.files) ? version.files : []).map(normalizeFile).filter((file) => file.name),
      images: (Array.isArray(version.images) ? version.images : []).map((image) => ({
        id: Number(image?.id) || imageIdFromUrl(image?.url),
        url: String(image?.url || '').trim(),
        width: Number(image?.width) || 0,
        height: Number(image?.height) || 0,
        nsfw: image?.nsfw ?? null,
      })).filter((image) => image.url),
    })).filter((version) => version.id),
  }
}

const MODEL_SUBDIR_BY_FILE_TYPE = Object.freeze({
  checkpoint: 'checkpoints',
  model: 'checkpoints',
  'diffusion model': 'diffusion_models',
  lora: 'loras',
  lycoris: 'loras',
  vae: 'vae',
  'text encoder': 'text_encoders',
  controlnet: 'controlnet',
  embedding: 'embeddings',
  textualinversion: 'embeddings',
  upscale: 'upscale_models',
})

export function inferComfyModelSubdir(modelType, fileType) {
  const normalizedModelType = String(modelType || '').trim().toLowerCase()
  if (normalizedModelType === 'lora' || normalizedModelType === 'lycoris') return 'loras'
  if (normalizedModelType === 'textualinversion') return 'embeddings'
  if (normalizedModelType === 'controlnet') return 'controlnet'
  return MODEL_SUBDIR_BY_FILE_TYPE[String(fileType || '').trim().toLowerCase()] || ''
}

export function isCivitaiFileInstallable(modelType, file = {}) {
  return Boolean(
    file.name
      && !/[\\/]/.test(file.name)
      && /^https:\/\/(?:www\.)?civitai\.(?:com|red)\/api\/download\/models\/\d+/i.test(file.downloadUrl)
      && inferComfyModelSubdir(modelType, file.type)
      && (!file.sha256 || /^[a-f0-9]{64}$/i.test(file.sha256))
  )
}

export function getDefaultCivitaiFileIds(modelType, version) {
  const installable = (version?.files || []).filter((file) => isCivitaiFileInstallable(modelType, file))
  const primary = installable.filter((file) => file.primary)
  return (primary.length > 0 ? primary : installable.slice(0, 1)).map((file) => file.id)
}

export function buildCivitaiInstallTasks(model, version, selectedFileIds = []) {
  const selected = new Set((Array.isArray(selectedFileIds) ? selectedFileIds : []).map(Number))
  return (version?.files || [])
    .filter((file) => selected.has(Number(file.id)) && isCivitaiFileInstallable(model?.type, file))
    .map((file) => ({
      filename: file.name,
      displayName: `${model.name} · ${file.type || 'Model'}`,
      targetSubdir: inferComfyModelSubdir(model.type, file.type),
      downloadUrl: file.downloadUrl,
      sizeBytes: file.sizeBytes,
      sha256: file.sha256,
    }))
}

export function extractComfyInputChoices(objectInfo, classType, inputName) {
  const choices = objectInfo?.[classType]?.input?.required?.[inputName]?.[0]
  return Array.isArray(choices)
    ? choices.map((value) => String(value || '').trim()).filter(Boolean)
    : []
}

export function resolveComfyModelChoice(choices = [], filename = '') {
  const requested = String(filename || '').trim()
  if (!requested) return ''
  const available = (Array.isArray(choices) ? choices : []).map((value) => String(value || '').trim()).filter(Boolean)
  const exact = available.find((value) => value === requested)
  if (exact) return exact
  const requestedBase = requested.split(/[\\/]/).pop()?.toLowerCase()
  const basenameMatches = available.filter((value) => value.split(/[\\/]/).pop()?.toLowerCase() === requestedBase)
  return basenameMatches.length === 1 ? basenameMatches[0] : ''
}

export function chooseCivitaiLoraBaseCheckpoint(checkpoints = [], baseModel = '', publishedModel = '') {
  const available = (Array.isArray(checkpoints) ? checkpoints : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  if (available.length === 0) return ''

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/\.(?:safetensors|ckpt|pt)$/i, '')
    .replace(/[^a-z0-9]+/g, '')
  const published = normalize(publishedModel)
  if (published) {
    const exact = available.find((value) => {
      const candidate = normalize(value.split(/[\\/]/).pop())
      return candidate === published || candidate.includes(published) || published.includes(candidate)
    })
    if (exact) return exact
  }

  const base = normalize(baseModel)
  const familyTokens = base.includes('illustrious') || base.includes('noob')
    ? ['illustrious', 'noobai', 'noob']
    : base.includes('pony')
      ? ['pony']
      : base.includes('flux')
        ? ['flux']
        : base.includes('sd3')
          ? ['sd3']
          : base.includes('sdxl') || base.includes('xl')
            ? ['sdxl', 'xl']
            : base.includes('sd15') || base.includes('sd1')
              ? ['sd15', 'v15', '1.5']
              : []
  const familyMatch = familyTokens.reduce((match, token) => (
    match || available.find((value) => normalize(value).includes(normalize(token)))
  ), '')
  return familyMatch || available[0]
}

export function chooseCivitaiAnimaDiffusionModel(models = [], publishedModel = '') {
  const available = (Array.isArray(models) ? models : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
  if (available.length === 0) return ''

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .replace(/\.(?:safetensors|ckpt|pt)$/i, '')
    .replace(/[^a-z0-9]+/g, '')
  const published = normalize(publishedModel)
  if (published) {
    const publishedMatch = available.find((value) => {
      const candidate = normalize(value.split(/[\\/]/).pop())
      return candidate === published || candidate.includes(published) || published.includes(candidate)
    })
    if (publishedMatch) return publishedMatch
  }

  return available.find((value) => normalize(value).includes('waianima'))
    || available.find((value) => normalize(value).includes('anima'))
    || ''
}

export async function fetchCivitaiModel(reference) {
  const parsed = typeof reference === 'object' ? reference : parseCivitaiModelReference(reference)
  if (!parsed?.modelId) throw new Error('Enter a valid Civitai or Civitai Red model URL.')
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (!api?.getCivitaiModel) throw new Error('Civitai browsing is only available in the desktop build.')
  const result = await api.getCivitaiModel(parsed.modelId)
  if (!result?.success) throw new Error(result?.error || 'Could not load that Civitai model.')
  return normalizeCivitaiModel(result.model)
}

export async function fetchCivitaiImageGenerationData(imageId) {
  const normalizedId = Number(imageId)
  if (!Number.isSafeInteger(normalizedId) || normalizedId <= 0) {
    throw new Error('This example does not expose a Civitai image ID.')
  }
  const api = typeof window !== 'undefined' ? window.electronAPI : null
  if (!api?.getCivitaiImageGenerationData) {
    throw new Error('Civitai example data is only available in the desktop build.')
  }
  const result = await api.getCivitaiImageGenerationData(normalizedId)
  if (!result?.success) throw new Error(result?.error || 'Could not read this example’s generation data.')
  return result.generationData
}
