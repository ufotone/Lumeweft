import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, ExternalLink, FolderOpen, LayoutGrid, Loader2, Search, ShieldAlert, XCircle } from 'lucide-react'
import { formatBytes } from '../../hooks/useWorkflowSetupFlow'
import {
  buildCivitaiInstallTasks,
  chooseCivitaiAnimaDiffusionModel,
  chooseCivitaiLoraBaseCheckpoint,
  extractComfyInputChoices,
  fetchCivitaiImageGenerationData,
  fetchCivitaiModel,
  getDefaultCivitaiFileIds,
  inferComfyModelSubdir,
  isCivitaiFileInstallable,
  parseCivitaiReference,
  resolveComfyModelChoice,
} from '../../services/civitai'
import { comfyui } from '../../services/comfyui'
import { getModelInstallInfo } from '../../config/workflowInstallCatalog'
import {
  acceptExternalModelConsent,
  getExternalModelConsent,
  isExternalModelConsentValid,
  revokeExternalModelConsent,
} from '../../services/externalModelConsent'
import { openApiWorkflowInComfyUi } from '../../services/workflowSetupManager'
import { useI18n } from '../../i18n/I18nContext'

const EXTERNAL_PROVIDERS = [
  { id: 'civitai', name: 'Civitai', available: true },
  { id: 'huggingFace', name: 'Hugging Face' },
  { id: 'tensorArt', name: 'Tensor.Art' },
  { id: 'liblibai', name: 'LiblibAI' },
  { id: 'shakkerAi', name: 'Shakker AI' },
]
const CIVITAI_HISTORY_KEY = 'lumeweft.civitaiUrlHistory.v1'
function normalizeSamplerName(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const aliases = { euler_a: 'euler_ancestral', euler_ancestral: 'euler_ancestral', dpmpp_2m: 'dpmpp_2m', dpmpp_2m_sde: 'dpmpp_2m_sde' }
  return aliases[normalized] || normalized || 'euler'
}

function finiteInRange(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const bounded = Math.min(max, Math.max(min, parsed))
  return integer ? Math.round(bounded) : bounded
}

function buildFlatKrea2ApiWorkflow(diffusionModel, generation = {}) {
  const meta = generation?.meta && typeof generation.meta === 'object' ? generation.meta : generation
  const width = finiteInRange(meta?.width, 1024, 64, 8192, true)
  const height = finiteInRange(meta?.height, 1024, 64, 8192, true)
  const seed = finiteInRange(meta?.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  const steps = finiteInRange(meta?.steps, 8, 1, 1000, true)
  const cfg = finiteInRange(meta?.cfgScale ?? meta?.cfg, 1, 0, 100)
  const denoise = finiteInRange(meta?.denoise, 1, 0, 1)
  const prompt = String(meta?.prompt || '').trim() || 'A cinematic, highly detailed image with natural lighting and a strong composition.'
  const samplerName = normalizeSamplerName(meta?.sampler)
  const scheduler = String(meta?.scheduler || 'simple').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return {
    1: { class_type: 'UNETLoader', inputs: { unet_name: diffusionModel, weight_dtype: 'default' }, _meta: { title: 'Load Krea 2 Diffusion Model' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: 'qwen3vl_4b_fp8_scaled.safetensors', type: 'krea2', device: 'default' }, _meta: { title: 'Load Krea 2 Text Encoder' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: 'qwen_image_vae.safetensors' }, _meta: { title: 'Load Qwen Image VAE' } },
    4: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] }, _meta: { title: 'Prompt' } },
    5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] }, _meta: { title: 'Negative Conditioning' } },
    6: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 }, _meta: { title: 'Image Size' } },
    7: { class_type: 'KSampler', inputs: { seed, steps, cfg, sampler_name: samplerName, scheduler, denoise, model: ['1', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0] }, _meta: { title: 'Krea 2 Sampler' } },
    8: { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['3', 0] }, _meta: { title: 'Decode Image' } },
    9: { class_type: 'SaveImage', inputs: { filename_prefix: 'Lumeweft_Krea2', images: ['8', 0] }, _meta: { title: 'Save Image' } },
  }
}

function resolvePublishedLoraStrength(generation = {}) {
  const meta = generation?.meta && typeof generation.meta === 'object' ? generation.meta : generation
  const resources = [
    ...(Array.isArray(generation?.resources) ? generation.resources : []),
    ...(Array.isArray(meta?.resources) ? meta.resources : []),
  ]
  const resource = resources.find((entry) => /lora|lycoris/i.test(String(entry?.type || '')))
  return finiteInRange(resource?.weight ?? meta?.loraStrength ?? meta?.strength, 1, -5, 5)
}

function buildCheckpointLoraApiWorkflow({ checkpoint, lora, trainedWords = [], generation = {} }) {
  const meta = generation?.meta && typeof generation.meta === 'object' ? generation.meta : generation
  const width = finiteInRange(meta?.width, 1024, 64, 8192, true)
  const height = finiteInRange(meta?.height, 1024, 64, 8192, true)
  const seed = finiteInRange(meta?.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  const steps = finiteInRange(meta?.steps, 25, 1, 1000, true)
  const cfg = finiteInRange(meta?.cfgScale ?? meta?.cfg, 7, 0, 100)
  const denoise = finiteInRange(meta?.denoise, 1, 0, 1)
  const triggerPrefix = (Array.isArray(trainedWords) ? trainedWords : []).map(String).filter(Boolean).join(', ')
  const prompt = String(meta?.prompt || '').trim() || [triggerPrefix, 'A cinematic, highly detailed image with natural lighting and a strong composition.'].filter(Boolean).join(', ')
  const negativePrompt = String(meta?.negativePrompt ?? meta?.negative_prompt ?? '').trim()
  const samplerName = normalizeSamplerName(meta?.sampler)
  const scheduler = String(meta?.scheduler || 'normal').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const strength = resolvePublishedLoraStrength(generation)
  return {
    1: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: checkpoint }, _meta: { title: 'Load compatible base checkpoint' } },
    2: { class_type: 'LoraLoader', inputs: { lora_name: lora, strength_model: strength, strength_clip: strength, model: ['1', 0], clip: ['1', 1] }, _meta: { title: 'Apply Civitai LoRA' } },
    3: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 1] }, _meta: { title: 'Prompt' } },
    4: { class_type: 'CLIPTextEncode', inputs: { text: negativePrompt, clip: ['2', 1] }, _meta: { title: 'Negative Prompt' } },
    5: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 }, _meta: { title: 'Image Size' } },
    6: { class_type: 'KSampler', inputs: { seed, steps, cfg, sampler_name: samplerName, scheduler, denoise, model: ['2', 0], positive: ['3', 0], negative: ['4', 0], latent_image: ['5', 0] }, _meta: { title: 'Sampler' } },
    7: { class_type: 'VAEDecode', inputs: { samples: ['6', 0], vae: ['1', 2] }, _meta: { title: 'Decode Image' } },
    8: { class_type: 'SaveImage', inputs: { filename_prefix: 'Lumeweft_Civitai_LoRA', images: ['7', 0] }, _meta: { title: 'Save Image' } },
  }
}

function buildAnimaLoraApiWorkflow({ diffusionModel, clip, vae, lora, trainedWords = [], generation = {} }) {
  const meta = generation?.meta && typeof generation.meta === 'object' ? generation.meta : generation
  const width = finiteInRange(meta?.width, 1024, 64, 8192, true)
  const height = finiteInRange(meta?.height, 1024, 64, 8192, true)
  const seed = finiteInRange(meta?.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  const steps = finiteInRange(meta?.steps, 30, 1, 1000, true)
  const cfg = finiteInRange(meta?.cfgScale ?? meta?.cfg, 4, 0, 100)
  const denoise = finiteInRange(meta?.denoise, 1, 0, 1)
  const triggerPrefix = (Array.isArray(trainedWords) ? trainedWords : []).map(String).filter(Boolean).join(', ')
  const prompt = String(meta?.prompt || '').trim() || [triggerPrefix, 'masterpiece, best quality, anime illustration'].filter(Boolean).join(', ')
  const negativePrompt = String(meta?.negativePrompt ?? meta?.negative_prompt ?? '').trim()
  const samplerName = normalizeSamplerName(meta?.sampler)
  const scheduler = String(meta?.scheduler || 'simple').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const strength = resolvePublishedLoraStrength(generation)
  return {
    1: { class_type: 'UNETLoader', inputs: { unet_name: diffusionModel, weight_dtype: 'default' }, _meta: { title: 'Load Anima Diffusion Model' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: clip, type: 'stable_diffusion', device: 'default' }, _meta: { title: 'Load Anima Qwen Text Encoder' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: vae }, _meta: { title: 'Load Anima VAE' } },
    4: { class_type: 'LoraLoaderModelOnly', inputs: { lora_name: lora, strength_model: strength, model: ['1', 0] }, _meta: { title: 'Apply Civitai Anima LoRA' } },
    5: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] }, _meta: { title: 'Prompt' } },
    6: { class_type: 'CLIPTextEncode', inputs: { text: negativePrompt, clip: ['2', 0] }, _meta: { title: 'Negative Prompt' } },
    7: { class_type: 'EmptyLatentImage', inputs: { width, height, batch_size: 1 }, _meta: { title: 'Image Size' } },
    8: { class_type: 'KSampler', inputs: { seed, steps, cfg, sampler_name: samplerName, scheduler, denoise, model: ['4', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0] }, _meta: { title: 'Anima Sampler' } },
    9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] }, _meta: { title: 'Decode Image' } },
    10: { class_type: 'SaveImage', inputs: { filename_prefix: 'Lumeweft_Civitai_Anima_LoRA', images: ['9', 0] }, _meta: { title: 'Save Image' } },
  }
}

function readCivitaiHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(CIVITAI_HISTORY_KEY) || '[]')
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()).slice(0, 10) : []
  } catch {
    return []
  }
}

function rememberCivitaiReference(value, previous = []) {
  const normalized = String(value || '').trim()
  const next = [normalized, ...previous.filter((item) => item !== normalized)].filter(Boolean).slice(0, 10)
  try { localStorage.setItem(CIVITAI_HISTORY_KEY, JSON.stringify(next)) } catch { /* history is optional */ }
  return next
}

function ProviderCatalog() {
  const { t } = useI18n()
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-sf-text-primary">{t('generate.community.sources.title')}</h2>
          <p className="mt-1 text-[10px] text-sf-text-muted">{t('generate.community.sources.description')}</p>
        </div>
        <span className="text-[10px] text-sf-text-muted">{t('generate.community.sources.morePlanned')}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {EXTERNAL_PROVIDERS.map((provider) => (
          <button
            key={provider.id}
            type="button"
            disabled={!provider.available}
            aria-pressed={provider.available}
            className={`min-h-24 rounded-xl border p-3 text-left transition-colors ${
              provider.available
                ? 'border-sf-accent bg-sf-accent/10 text-sf-text-primary'
                : 'cursor-not-allowed border-sf-dark-700 bg-sf-dark-900/50 text-sf-text-muted opacity-55'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold">{provider.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[9px] ${provider.available ? 'bg-sf-accent/20 text-sf-accent' : 'bg-sf-dark-700 text-sf-text-muted'}`}>
                {provider.available ? t('generate.community.sources.active') : t('generate.community.sources.comingSoon')}
              </span>
            </div>
            <div className="mt-2 text-[10px] leading-4">{t(`generate.community.sources.providers.${provider.id}`)}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

function TermsGate({ onAccepted, onCancel }) {
  const { t } = useI18n()
  const [checks, setChecks] = useState({ adult: false, risk: false, rules: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ready = checks.adult && checks.risk && checks.rules

  const accept = async () => {
    if (!ready || busy) return
    setBusy(true)
    setError('')
    try {
      const consent = await acceptExternalModelConsent()
      onAccepted(consent)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('generate.community.errors.saveConsent'))
    } finally {
      setBusy(false)
    }
  }

  const rows = [
    ['adult', t('generate.community.consent.adult')],
    ['risk', t('generate.community.consent.risk')],
    ['rules', t('generate.community.consent.rules')],
  ]

  return (
    <div className="fixed inset-0 z-[300] flex overflow-y-auto bg-sf-dark-950/95 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="community-consent-title">
    <div className="m-auto w-full max-w-3xl rounded-2xl border border-amber-400/30 bg-sf-dark-900 p-6 shadow-2xl shadow-black/60">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
        <div>
          <h2 id="community-consent-title" className="text-lg font-semibold text-sf-text-primary">{t('generate.community.consent.title')}</h2>
          <p className="mt-2 text-xs leading-5 text-sf-text-secondary">
            {t('generate.community.consent.disclaimer')}
          </p>
          <p className="mt-2 text-xs leading-5 text-sf-text-secondary">
            {t('generate.community.consent.prohibited')}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(([id, label]) => (
          <label key={id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900/70 p-3 text-xs text-sf-text-secondary">
            <input
              type="checkbox"
              checked={checks[id]}
              onChange={(event) => setChecks((previous) => ({ ...previous, [id]: event.target.checked }))}
              className="mt-0.5"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {error && <div className="mt-3 text-xs text-sf-error">{error}</div>}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-sf-dark-700 pt-4">
        <button type="button" onClick={onCancel} disabled={busy} className="rounded-lg px-4 py-2 text-xs font-semibold text-sf-text-muted hover:bg-sf-dark-800 hover:text-sf-text-primary disabled:opacity-50">
          {t('generate.community.consent.notNow')}
        </button>
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => { void accept() }}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold ${
            ready && !busy ? 'bg-sf-accent text-white hover:bg-sf-accent-hover' : 'cursor-not-allowed bg-sf-dark-700 text-sf-text-muted'
          }`}
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {t('generate.community.consent.agree')}
        </button>
      </div>
    </div>
    </div>
  )
}

function ScanBadge({ label, value }) {
  const { t } = useI18n()
  if (!value) return null
  const success = value.toLowerCase() === 'success'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
      success ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-200'
    }`}>
      {success ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {t('generate.community.scan.result', { label, value })}
    </span>
  )
}

function extractPublishedComfyWorkflow(generationData) {
  const candidate = generationData?.meta?.comfy?.prompt ?? generationData?.comfy?.prompt
  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate
  if (typeof candidate !== 'string') return null
  try {
    const parsed = JSON.parse(candidate)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function detectCommunityWorkflowTemplate(generationData) {
  const searchable = (generationData?.resources || []).map((resource) => `${resource?.baseModel || ''} ${resource?.modelName || ''} ${resource?.versionName || ''}`).join(' ')
  if (/wan\s*(?:video\s*)?2[._-]?2/i.test(searchable)) return generationData?.type === 'video' ? 'wan22-i2v' : null
  return null
}

async function buildCommunityMediaWorkflow(generationData, mediaId, installedTasks = []) {
  const response = await fetch('/workflows/video_wan2_2_14B_i2v.json')
  if (!response.ok) throw new Error(`Could not load WAN 2.2 workflow template (${response.status}).`)
  const workflow = await response.json()
  const meta = generationData?.meta || {}
  const prompt = String(meta.prompt || '').trim()
  if (workflow['129:93']?.inputs) workflow['129:93'].inputs.text = prompt
  const negativePrompt = String(meta.negativePrompt || meta.negative_prompt || '').trim()
  if (negativePrompt && workflow['129:89']?.inputs) workflow['129:89'].inputs.text = negativePrompt
  if (workflow['97']) workflow['97']._meta = { ...workflow['97']._meta, title: 'Select a local start image (not published by Civitai)' }
  if (workflow['108']?.inputs) workflow['108'].inputs.filename_prefix = `video/Lumeweft_Civitai_${mediaId}`
  const tasks = Array.isArray(installedTasks) ? installedTasks : []
  const publishedHighBaseModel = tasks.find((task) => task.modelType === 'Checkpoint' && task.targetSubdir === 'diffusion_models' && task.noiseRole !== 'low')
  const officialHighBaseModel = tasks.find((task) => (
    task.modelType === 'support'
    && task.targetSubdir === 'diffusion_models'
    && /high[_-]?noise/i.test(task.filename)
  ))
  const highBaseModel = publishedHighBaseModel || officialHighBaseModel
  const publishedLowBaseModel = tasks.find((task) => task.modelType === 'Checkpoint' && task.targetSubdir === 'diffusion_models' && task.noiseRole === 'low')
  const officialLowBaseModel = tasks.find((task) => (
    task.modelType === 'support'
    && task.targetSubdir === 'diffusion_models'
    && /low[_-]?noise/i.test(task.filename)
  ))
  const lowBaseModel = publishedLowBaseModel || officialLowBaseModel
  const applyWanBaseModel = (nodeId, task) => {
    const node = workflow[nodeId]
    if (!node?.inputs || !task?.filename) return
    const isGguf = /\.gguf$/i.test(task.filename)
    node.class_type = isGguf ? 'UnetLoaderGGUF' : 'UNETLoader'
    node.inputs = isGguf
      ? { unet_name: task.filename }
      : { unet_name: task.filename, weight_dtype: 'default' }
  }
  if (highBaseModel) {
    applyWanBaseModel('129:95', highBaseModel)
    workflow['129:95']._meta.title = publishedHighBaseModel ? 'Civitai WAN High-noise model' : 'Official WAN 2.2 High-noise model'
  }
  if (lowBaseModel) {
    applyWanBaseModel('129:96', lowBaseModel)
    workflow['129:96']._meta.title = publishedLowBaseModel ? 'Civitai WAN Low-noise model' : 'Official WAN 2.2 Low-noise model'
  }
  const wireLoras = (role, switchedModelNodeId, samplingNodeId) => {
    const matching = tasks.filter((task) => task.modelType === 'LORA' && task.noiseRole === role)
    if (matching.length === 0 || !workflow[switchedModelNodeId]?.inputs || !workflow[samplingNodeId]?.inputs) return
    let previousNodeId = switchedModelNodeId
    matching.forEach((task, index) => {
      const nodeId = `civitai:${role}:${index + 1}`
      workflow[nodeId] = {
        class_type: 'LoraLoaderModelOnly',
        inputs: { lora_name: task.filename, strength_model: 1, model: [previousNodeId, 0] },
        _meta: { title: `Civitai ${role} LoRA ${index + 1}` },
      }
      previousNodeId = nodeId
    })
    // Preserve the template's base-vs-LightX2V switch, then layer community
    // style/motion LoRAs after it. Replacing the bundled accelerator node made
    // one expert run unaccelerated at four steps, producing heavy residual
    // noise.
    workflow[samplingNodeId].inputs.model = [previousNodeId, 0]
  }
  wireLoras('high', '129:116', '129:104')
  wireLoras('low', '129:117', '129:103')

  const usesFourStepAccelerator = tasks.some((task) => (
    (task.modelType === 'LORA' || task.modelType === 'support')
    && task.targetSubdir === 'loras'
    && /(?:lightx2v|lightning).*(?:4[ _-]?steps?)|(?:4[ _-]?steps?).*(?:lightx2v|lightning)/i.test(task.filename || '')
  ))
  if (workflow['129:131']?.inputs) workflow['129:131'].inputs.value = usesFourStepAccelerator

  // The post metadata often describes a private source graph and is not safe
  // to transplant onto the reconstructed LightX2V graph. Use its documented
  // four-step operating point; otherwise retain a conservative 20-step path.
  const publishedSteps = finiteInRange(meta.steps, 20, 8, 40, true)
  const steps = usesFourStepAccelerator ? 4 : publishedSteps
  const cfg = usesFourStepAccelerator ? 1 : finiteInRange(meta.cfgScale ?? meta.cfg, 3.5, 1, 7)
  const splitStep = usesFourStepAccelerator
    ? 2
    : Math.max(1, Math.min(steps - 1, finiteInRange(meta.splitStep ?? meta.switchStep, Math.ceil(steps / 2), 1, steps - 1, true)))
  const seed = finiteInRange(meta.seed, Math.floor(Math.random() * 0xffffffff), 0, Number.MAX_SAFE_INTEGER, true)
  const samplerName = normalizeSamplerName(meta.sampler || 'euler')
  const scheduler = String(meta.scheduler || 'simple').trim().toLowerCase().replace(/[\s-]+/g, '_')
  const width = finiteInRange(meta.width, 640, 64, 4096, true)
  const height = finiteInRange(meta.height, 640, 64, 4096, true)
  const shift = finiteInRange(meta.shift, 5, 0, 100)

  if (workflow['129:128']?.inputs) workflow['129:128'].inputs.value = steps
  if (workflow['129:118']?.inputs) workflow['129:118'].inputs.value = steps
  if (workflow['129:126']?.inputs) workflow['129:126'].inputs.value = cfg
  if (workflow['129:122']?.inputs) workflow['129:122'].inputs.value = cfg
  if (workflow['129:127']?.inputs) workflow['129:127'].inputs.value = splitStep
  if (workflow['129:124']?.inputs) workflow['129:124'].inputs.value = splitStep
  if (workflow['129:86']?.inputs) {
    workflow['129:86'].inputs.noise_seed = seed
    workflow['129:86'].inputs.sampler_name = samplerName
    workflow['129:86'].inputs.scheduler = scheduler
  }
  if (workflow['129:85']?.inputs) {
    workflow['129:85'].inputs.sampler_name = samplerName
    workflow['129:85'].inputs.scheduler = scheduler
  }
  if (workflow['129:104']?.inputs) workflow['129:104'].inputs.shift = shift
  if (workflow['129:103']?.inputs) workflow['129:103'].inputs.shift = shift
  if (workflow['129:98']?.inputs) {
    workflow['129:98'].inputs.width = width
    workflow['129:98'].inputs.height = height
    const resizeNodeId = 'lumeweft:aspect_resize'
    workflow[resizeNodeId] = {
      class_type: 'ImageScaleToTotalPixels',
      inputs: {
        upscale_method: 'lanczos',
        megapixels: Math.max(0.01, Number(((width * height) / 1_000_000).toFixed(3))),
        resolution_steps: 1,
        image: ['97', 0],
      },
      _meta: { title: 'Preserve aspect ratio (Lumeweft)' },
    }
    workflow['129:98'].inputs.start_image = [resizeNodeId, 0]
  }
  return workflow
}

export default function CommunityModelBrowser({ onCancelConsent }) {
  const { t } = useI18n()
  const [consent, setConsent] = useState(null)
  const [consentLoaded, setConsentLoaded] = useState(false)
  const [reference, setReference] = useState('')
  const [model, setModel] = useState(null)
  const [communityMedia, setCommunityMedia] = useState(null)
  const [returnCommunityMedia, setReturnCommunityMedia] = useState(null)
  const [communityMediaState, setCommunityMediaState] = useState({ busy: false, message: '', error: '' })
  const [batchReview, setBatchReview] = useState({ open: false, loading: false, tasks: [], selected: [], error: '' })
  const [selectedVersionId, setSelectedVersionId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [comfyRootPath, setComfyRootPath] = useState('')
  const [rootValidation, setRootValidation] = useState({ checked: false, isValid: false, error: '', normalizedPath: '' })
  const [selectedFileIds, setSelectedFileIds] = useState([])
  const [installPhase, setInstallPhase] = useState('idle')
  const [installProgress, setInstallProgress] = useState({ overallPercent: 0, taskPercent: null, message: '', bytesDownloaded: 0, totalBytes: 0 })
  const [installResult, setInstallResult] = useState(null)
  const [showInstallConfirm, setShowInstallConfirm] = useState(false)
  const [diskSpace, setDiskSpace] = useState({ checked: false, freeBytes: null })
  const [civitaiApiKey, setCivitaiApiKey] = useState('')
  const [apiKeySaved, setApiKeySaved] = useState(false)
  const [referenceHistory, setReferenceHistory] = useState(readCivitaiHistory)
  const [generateWithModelState, setGenerateWithModelState] = useState({ busy: false, message: '', error: '' })
  const [installedCheck, setInstalledCheck] = useState({ status: 'idle', files: [] })
  const [exampleMenu, setExampleMenu] = useState(null)
  const [exampleGenerationState, setExampleGenerationState] = useState({ busyId: null, message: '', error: '' })
  const [loraBaseState, setLoraBaseState] = useState({ status: 'idle', mode: 'checkpoint', options: [], selected: '', loraName: '', clipName: '', vaeName: '', error: '' })

  useEffect(() => {
    let cancelled = false
    getExternalModelConsent().then((value) => {
      if (!cancelled) {
        setConsent(value)
        setConsentLoaded(true)
      }
    }).catch(() => { if (!cancelled) setConsentLoaded(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    window.electronAPI?.getSetting?.('civitaiApiKey').then((value) => {
      if (cancelled) return
      const stored = String(value || '').trim()
      setCivitaiApiKey(stored)
      setApiKeySaved(Boolean(stored))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const saveCivitaiApiKey = async () => {
    const value = civitaiApiKey.trim()
    await window.electronAPI?.setSetting?.('civitaiApiKey', value)
    setCivitaiApiKey(value)
    setApiKeySaved(Boolean(value))
    setError('')
  }

  useEffect(() => {
    let cancelled = false
    const api = window.electronAPI
    api?.getSetting?.('comfyRootPath').then(async (value) => {
      const storedPath = String(value || '').trim()
      if (cancelled) return
      setComfyRootPath(storedPath)
      if (!storedPath || !api?.validateWorkflowSetupRoot) return
      const result = await api.validateWorkflowSetupRoot(storedPath)
      if (cancelled) return
      const normalizedPath = String(result?.normalizedPath || storedPath)
      setRootValidation({
        checked: true,
        isValid: Boolean(result?.isValid),
        error: String(result?.error || ''),
        normalizedPath,
      })
      if (!result?.isValid) return
      setComfyRootPath(normalizedPath)
      const space = await api.getWorkflowSetupDiskSpace?.({ comfyRootPath: normalizedPath })
      if (!cancelled) {
        setDiskSpace({ checked: true, freeBytes: space?.success && Number.isFinite(space.freeBytes) ? Number(space.freeBytes) : null })
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (installPhase !== 'downloading' || !window.electronAPI?.onWorkflowSetupProgress) return undefined
    return window.electronAPI.onWorkflowSetupProgress((entry) => {
      setInstallProgress((previous) => ({
        ...previous,
        overallPercent: Number.isFinite(Number(entry?.overallPercent)) ? Number(entry.overallPercent) : previous.overallPercent,
        taskPercent: Number.isFinite(Number(entry?.taskPercent)) ? Number(entry.taskPercent) : previous.taskPercent,
        message: String(entry?.message || previous.message || ''),
        bytesDownloaded: Number(entry?.bytesDownloaded) || previous.bytesDownloaded,
        totalBytes: Number(entry?.totalBytes) || previous.totalBytes,
      }))
    })
  }, [installPhase])

  const selectedVersion = useMemo(() => (
    model?.versions?.find((version) => version.id === selectedVersionId) || model?.versions?.[0] || null
  ), [model, selectedVersionId])
  const installTasks = useMemo(() => buildCivitaiInstallTasks(model, selectedVersion, selectedFileIds), [model, selectedVersion, selectedFileIds])
  const totalInstallBytes = useMemo(() => installTasks.reduce((sum, task) => sum + (Number(task.sizeBytes) || 0), 0), [installTasks])
  const insufficientSpace = diskSpace.checked && Number.isFinite(diskSpace.freeBytes) && diskSpace.freeBytes < totalInstallBytes + (1024 ** 3)
  const duplicateSelections = useMemo(() => {
    const groups = new Map()
    for (const file of selectedVersion?.files || []) {
      if (!selectedFileIds.includes(file.id)) continue
      const key = file.name.trim().toLowerCase()
      groups.set(key, [...(groups.get(key) || []), file])
    }
    return [...groups.values()].filter((files) => files.length > 1)
  }, [selectedVersion, selectedFileIds])
  const isKrea2Model = /\bkrea\s*[-_]?\s*2\b/i.test(`${model?.name || ''} ${selectedVersion?.baseModel || ''}`)
  const isLoraModel = /^(?:lora|lycoris)$/i.test(String(model?.type || '').trim())
  const isAnimaLora = isLoraModel && /anima/i.test([
    model?.name,
    selectedVersion?.name,
    selectedVersion?.baseModel,
    ...(Array.isArray(selectedVersion?.files) ? selectedVersion.files.map((file) => file?.name) : []),
  ].filter(Boolean).join(' '))
  const installedKreaDiffusionFile = installResult?.files?.find((file) => (
    installTasks.some((task) => task.targetSubdir === 'diffusion_models' && task.filename === file.filename)
  )) || null
  const installedLoraFile = installResult?.files?.find((file) => (
    installTasks.some((task) => task.targetSubdir === 'loras' && task.filename === file.filename)
  )) || null
  const installedGenerationFile = installedKreaDiffusionFile || installedLoraFile
  const isLoraBaseReady = Boolean(
    loraBaseState.selected
    && loraBaseState.loraName
    && (loraBaseState.mode !== 'anima' || (loraBaseState.clipName && loraBaseState.vaeName))
  )

  useEffect(() => {
    let cancelled = false
    if (!isLoraModel || !installedLoraFile) {
      setLoraBaseState({ status: 'idle', mode: 'checkpoint', options: [], selected: '', loraName: '', clipName: '', vaeName: '', error: '' })
      return () => { cancelled = true }
    }
    setLoraBaseState((previous) => ({ ...previous, status: 'loading', error: '' }))
    const infoRequests = isAnimaLora
      ? [
          comfyui.getObjectInfo('UNETLoader'),
          comfyui.getObjectInfo('LoraLoaderModelOnly'),
          comfyui.getObjectInfo('CLIPLoader'),
          comfyui.getObjectInfo('VAELoader'),
        ]
      : [
          comfyui.getObjectInfo('CheckpointLoaderSimple'),
          comfyui.getObjectInfo('LoraLoader'),
        ]
    Promise.all(infoRequests).then(([baseInfo, loraInfo, clipInfo, vaeInfo]) => {
      if (cancelled) return
      const mode = isAnimaLora ? 'anima' : 'checkpoint'
      const baseNode = isAnimaLora ? 'UNETLoader' : 'CheckpointLoaderSimple'
      const baseInput = isAnimaLora ? 'unet_name' : 'ckpt_name'
      const loraNode = isAnimaLora ? 'LoraLoaderModelOnly' : 'LoraLoader'
      const options = extractComfyInputChoices(baseInfo, baseNode, baseInput)
      const loraChoices = extractComfyInputChoices(loraInfo, loraNode, 'lora_name')
      const loraName = resolveComfyModelChoice(loraChoices, installedLoraFile.filename)
      const selected = isAnimaLora
        ? chooseCivitaiAnimaDiffusionModel(options)
        : chooseCivitaiLoraBaseCheckpoint(options, selectedVersion?.baseModel)
      const clipName = isAnimaLora
        ? resolveComfyModelChoice(extractComfyInputChoices(clipInfo, 'CLIPLoader', 'clip_name'), 'qwen_3_06b_base.safetensors')
        : ''
      const vaeName = isAnimaLora
        ? resolveComfyModelChoice(extractComfyInputChoices(vaeInfo, 'VAELoader', 'vae_name'), 'qwen_image_vae.safetensors')
        : ''
      const hasRequiredBase = Boolean(selected && (!isAnimaLora || (clipName && vaeName)))
      if (isAnimaLora && selected) {
        void window.electronAPI?.setSetting?.('animaBaseDiffusionModel', selected)
      } else if (selected && /sdxl|\bxl\b/i.test(String(selectedVersion?.baseModel || ''))) {
        void window.electronAPI?.setSetting?.('sdxlBaseCheckpoint', selected)
      }
      setLoraBaseState({
        status: hasRequiredBase && loraName ? 'ready' : 'empty',
        mode,
        options,
        selected,
        loraName,
        clipName,
        vaeName,
        error: !loraName
          ? t('generate.community.lora.notVisibleToComfy')
          : (!hasRequiredBase
              ? t(isAnimaLora ? 'generate.community.lora.missingAnimaComponents' : 'generate.community.lora.noCheckpoints')
              : ''),
      })
    }).catch((reason) => {
      if (cancelled) return
      setLoraBaseState({
        status: 'error',
        mode: isAnimaLora ? 'anima' : 'checkpoint',
        options: [],
        selected: '',
        loraName: '',
        clipName: '',
        vaeName: '',
        error: reason instanceof Error ? reason.message : t('generate.community.lora.checkpointLookupFailed'),
      })
    })
    return () => { cancelled = true }
  }, [installedLoraFile?.filename, isAnimaLora, isLoraModel, selectedVersion?.baseModel, t])

  useEffect(() => {
    let cancelled = false
    if (!rootValidation.isValid || installTasks.length === 0 || installPhase === 'downloading') {
      setInstalledCheck({ status: 'idle', files: [] })
      return () => { cancelled = true }
    }
    setInstalledCheck({ status: 'checking', files: [] })
    window.electronAPI?.checkInstalledCivitaiFiles?.({
      comfyRootPath: rootValidation.normalizedPath || comfyRootPath,
      files: installTasks,
    }).then((result) => {
      if (cancelled) return
      const files = Array.isArray(result?.files) ? result.files : []
      if (result?.success && result.allInstalled) {
        setInstallResult({ success: true, files, alreadyInstalled: true })
        setInstallPhase('complete')
        setInstalledCheck({ status: 'installed', files })
      } else {
        setInstallResult((previous) => previous?.alreadyInstalled ? null : previous)
        setInstalledCheck({ status: 'missing', files })
      }
    }).catch(() => {
      if (!cancelled) setInstalledCheck({ status: 'unknown', files: [] })
    })
    return () => { cancelled = true }
  }, [rootValidation.isValid, rootValidation.normalizedPath, comfyRootPath, installTasks, installPhase === 'downloading'])

  const validateComfyRoot = async (value = comfyRootPath) => {
    const path = String(value || '').trim()
    if (!window.electronAPI?.validateWorkflowSetupRoot) return null
    const result = await window.electronAPI.validateWorkflowSetupRoot(path)
    const normalized = {
      checked: true,
      isValid: Boolean(result?.isValid),
      error: String(result?.error || ''),
      normalizedPath: String(result?.normalizedPath || path),
    }
    setRootValidation(normalized)
    if (normalized.isValid) {
      setComfyRootPath(normalized.normalizedPath)
      await window.electronAPI.setSetting?.('comfyRootPath', normalized.normalizedPath)
      const space = await window.electronAPI.getWorkflowSetupDiskSpace?.({ comfyRootPath: normalized.normalizedPath })
      setDiskSpace({ checked: true, freeBytes: space?.success && Number.isFinite(space.freeBytes) ? Number(space.freeBytes) : null })
    }
    return normalized
  }

  const chooseComfyRoot = async () => {
    const picked = await window.electronAPI?.selectDirectory?.({ title: t('generate.community.destination.selectFolder'), defaultPath: comfyRootPath || undefined })
    if (!picked) return
    setComfyRootPath(picked)
    await validateComfyRoot(picked)
  }

  const prepareInstall = async () => {
    setInstallResult(null)
    setError('')
    const validation = rootValidation.isValid ? rootValidation : await validateComfyRoot()
    if (!validation?.isValid) {
      setError(validation?.error || t('generate.community.errors.chooseFolder'))
      return
    }
    if (installTasks.length === 0) {
      setError(t('generate.community.errors.selectFile'))
      return
    }
    setShowInstallConfirm(true)
  }

  const install = async () => {
    setShowInstallConfirm(false)
    setInstallPhase('downloading')
    setInstallProgress({ overallPercent: 0, taskPercent: 0, message: t('generate.community.download.preparing'), bytesDownloaded: 0, totalBytes: 0 })
    setInstallResult(null)
    setError('')
    const installId = globalThis.crypto?.randomUUID?.() || `civitai-${Date.now()}`
    try {
      const result = await window.electronAPI?.installCivitaiFiles?.({
        installId,
        comfyRootPath: rootValidation.normalizedPath || comfyRootPath,
        files: installTasks,
      })
      setInstallResult(result || null)
      if (!result?.success) setError(result?.error || t('generate.community.errors.downloadsFailed'))
      setInstallPhase(result?.success ? 'complete' : 'error')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('generate.community.errors.downloadFailed'))
      setInstallPhase('error')
    }
  }

  const cancelInstall = async () => {
    setInstallProgress((previous) => ({ ...previous, message: t('generate.community.download.cancelling') }))
    const result = await window.electronAPI?.cancelCivitaiDownload?.()
    if (!result?.success) setError(result?.error || t('generate.community.errors.cancelDownload'))
  }

  const generateWithInstalledModel = async () => {
    if (!installedGenerationFile || generateWithModelState.busy) return
    setGenerateWithModelState({ busy: true, message: '', error: '' })
    try {
      if (installedLoraFile && !isLoraBaseReady) {
        throw new Error(loraBaseState.error || t('generate.community.lora.selectBase'))
      }
      const workflow = installedLoraFile
        ? (loraBaseState.mode === 'anima'
            ? buildAnimaLoraApiWorkflow({
                diffusionModel: loraBaseState.selected,
                clip: loraBaseState.clipName,
                vae: loraBaseState.vaeName,
                lora: loraBaseState.loraName,
                trainedWords: selectedVersion?.trainedWords,
              })
            : buildCheckpointLoraApiWorkflow({
                checkpoint: loraBaseState.selected,
                lora: loraBaseState.loraName,
                trainedWords: selectedVersion?.trainedWords,
              }))
        : buildFlatKrea2ApiWorkflow(installedKreaDiffusionFile.filename)
      const result = await openApiWorkflowInComfyUi(workflow, {
        label: `${model.name} · ${installedLoraFile ? t('generate.community.lora.compatibleWorkflow') : t('generate.community.krea.compatibleWorkflow')}`,
        reloadComfyUi: Boolean(installedLoraFile),
      })
      if (!result.success) throw new Error(result.error || t('generate.community.errors.openWorkflow'))
      setGenerateWithModelState({
        busy: false,
        message: t(installedLoraFile ? 'generate.community.lora.openedModel' : 'generate.community.krea.openedModel'),
        error: '',
      })
    } catch (reason) {
      setGenerateWithModelState({
        busy: false,
        message: '',
        error: reason instanceof Error ? reason.message : t('generate.community.errors.prepareModel'),
      })
    }
  }

  const generateWithExampleParameters = async (image) => {
    if (!installedGenerationFile || !image?.id || exampleGenerationState.busyId) return
    setExampleMenu(null)
    setExampleGenerationState({ busyId: image.id, message: '', error: '' })
    try {
      const generationData = await fetchCivitaiImageGenerationData(image.id)
      const meta = generationData?.meta || {}
      if (!String(meta.prompt || '').trim()) throw new Error(t('generate.community.errors.exampleNoPrompt'))
      const publishedModel = String(meta?.Model ?? meta?.model ?? '').trim()
      const exampleCheckpoint = installedLoraFile
        ? (loraBaseState.mode === 'anima'
            ? chooseCivitaiAnimaDiffusionModel(loraBaseState.options, publishedModel)
            : chooseCivitaiLoraBaseCheckpoint(loraBaseState.options, selectedVersion?.baseModel, publishedModel))
        : ''
      if (installedLoraFile && (!exampleCheckpoint || !isLoraBaseReady)) {
        throw new Error(loraBaseState.error || t('generate.community.lora.selectBase'))
      }
      const workflow = installedLoraFile
        ? (loraBaseState.mode === 'anima'
            ? buildAnimaLoraApiWorkflow({
                diffusionModel: exampleCheckpoint,
                clip: loraBaseState.clipName,
                vae: loraBaseState.vaeName,
                lora: loraBaseState.loraName,
                trainedWords: selectedVersion?.trainedWords,
                generation: generationData,
              })
            : buildCheckpointLoraApiWorkflow({
                checkpoint: exampleCheckpoint,
                lora: loraBaseState.loraName,
                trainedWords: selectedVersion?.trainedWords,
                generation: generationData,
              }))
        : buildFlatKrea2ApiWorkflow(installedKreaDiffusionFile.filename, generationData)
      const result = await openApiWorkflowInComfyUi(workflow, {
        label: `${model.name} · Civitai example ${image.id}`,
        reloadComfyUi: Boolean(installedLoraFile),
      })
      if (!result.success) throw new Error(result.error || t('generate.community.errors.openExampleWorkflow'))
      setExampleGenerationState({
        busyId: null,
        message: t('generate.community.examples.applied', { width: meta.width || '?', height: meta.height || '?' }),
        error: '',
      })
    } catch (reason) {
      setExampleGenerationState({
        busyId: null,
        message: '',
        error: reason instanceof Error ? reason.message : t('generate.community.errors.prepareExample'),
      })
    }
  }

  const openCommunityMediaWorkflow = async () => {
    if (!communityMedia || communityMediaState.busy) return
    setCommunityMediaState({ busy: true, message: '', error: '' })
    try {
      const published = extractPublishedComfyWorkflow(communityMedia.generationData)
      const installedTasks = batchReview.tasks.filter((task) => batchReview.selected.includes(task.key))
      const workflow = published || await buildCommunityMediaWorkflow(communityMedia.generationData, communityMedia.id, installedTasks)
      const result = await openApiWorkflowInComfyUi(workflow, {
        label: published ? `Civitai post ${communityMedia.id}` : `Civitai post ${communityMedia.id} · WAN 2.2 I2V reconstruction`,
        reloadComfyUi: false,
      })
      if (!result.success) throw new Error(result.error || t('generate.community.errors.openMediaWorkflow'))
      setCommunityMediaState({ busy: false, message: t(published ? 'generate.community.media.openedPublished' : 'generate.community.media.openedReconstructed'), error: '' })
    } catch (reason) {
      setCommunityMediaState({ busy: false, message: '', error: reason instanceof Error ? reason.message : t('generate.community.errors.openMediaWorkflow') })
    }
  }

  const prepareCommunityResourceBatch = async () => {
    const resources = Array.isArray(communityMedia?.generationData?.resources) ? communityMedia.generationData.resources : []
    if (resources.length === 0 || batchReview.loading) return
    setBatchReview({ open: true, loading: true, tasks: [], selected: [], error: '' })
    try {
      const uniqueVersions = [...new Map(resources.filter((resource) => resource.modelId).map((resource) => [
        `${resource.modelId}:${resource.modelVersionId || ''}`, resource,
      ])).values()]
      const models = await Promise.all(uniqueVersions.map(async (resource) => ({
        resource,
        model: await fetchCivitaiModel({ modelId: Number(resource.modelId) }),
      })))
      const tasks = models.flatMap(({ resource, model: resourceModel }) => {
        const version = resourceModel.versions.find((item) => item.id === Number(resource.modelVersionId)) || resourceModel.versions[0]
        return buildCivitaiInstallTasks(resourceModel, version, getDefaultCivitaiFileIds(resourceModel.type, version)).map((task) => ({
          ...task,
          targetSubdir: resourceModel.type === 'Checkpoint' && /wan\s*(?:video\s*)?2[._-]?2/i.test(`${resource.baseModel || ''} ${version?.baseModel || ''}`)
            ? 'diffusion_models'
            : task.targetSubdir,
          resourceName: resource.modelName || resourceModel.name,
          versionName: resource.versionName || version?.name || '',
          modelType: resourceModel.type,
          noiseRole: /\blow\b/i.test(`${resource.versionName || ''} ${version?.name || ''}`) ? 'low' : (/\bhigh\b/i.test(`${resource.versionName || ''} ${version?.name || ''}`) ? 'high' : ''),
          key: `${resourceModel.type === 'Checkpoint' && /wan\s*(?:video\s*)?2[._-]?2/i.test(`${resource.baseModel || ''} ${version?.baseModel || ''}`) ? 'diffusion_models' : task.targetSubdir}/${task.filename}`.toLowerCase(),
        }))
      })
      const publishedWanBases = models.filter(({ model: resourceModel }) => resourceModel.type === 'Checkpoint')
      const hasPublishedHighWanBase = publishedWanBases.some(({ resource, model: resourceModel }) => !/\blow\b/i.test(`${resource.versionName || ''} ${resourceModel.name || ''}`))
      const hasPublishedLowWanBase = publishedWanBases.some(({ resource, model: resourceModel }) => /\blow\b/i.test(`${resource.versionName || ''} ${resourceModel.name || ''}`))
      const supportTasks = [
        getModelInstallInfo({ targetSubdir: 'text_encoders', filename: 'umt5-xxl-encoder-Q4_K_M.gguf' }),
        getModelInstallInfo({ targetSubdir: 'vae', filename: 'wan_2.1_vae.safetensors' }),
        // These two accelerator LoRAs are embedded in the standard WAN 2.2
        // reconstruction template. They are not necessarily declared by the
        // Civitai post, so they must be checked as template dependencies.
        getModelInstallInfo({ targetSubdir: 'loras', filename: 'wan2.2_i2v_lightx2v_4steps_lora_v1_high_noise.safetensors' }),
        getModelInstallInfo({ targetSubdir: 'loras', filename: 'wan2.2_i2v_lightx2v_4steps_lora_v1_low_noise.safetensors' }),
        ...(!hasPublishedHighWanBase ? [getModelInstallInfo({ targetSubdir: 'diffusion_models', filename: 'Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf' })] : []),
        ...(!hasPublishedLowWanBase ? [getModelInstallInfo({ targetSubdir: 'diffusion_models', filename: 'Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf' })] : []),
      ].filter((task) => task.downloadUrl).map((task) => ({
        ...task,
        resourceName: t('generate.community.media.standardDependency'),
        versionName: 'WAN 2.2',
        modelType: 'support',
        noiseRole: '',
        installer: 'workflowSetup',
        key: `${task.targetSubdir}/${task.filename}`.toLowerCase(),
      }))
      const deduplicated = [...new Map([...tasks, ...supportTasks].map((task) => [task.key, task])).values()]
      if (rootValidation.isValid && window.electronAPI?.checkInstalledCivitaiFiles) {
        await window.electronAPI.checkInstalledCivitaiFiles({
          comfyRootPath: rootValidation.normalizedPath || comfyRootPath,
          files: deduplicated.filter((task) => task.installer !== 'workflowSetup'),
        })
      }
      setBatchReview({ open: true, loading: false, tasks: deduplicated, selected: deduplicated.map((task) => task.key), error: '' })
    } catch (reason) {
      setBatchReview({ open: true, loading: false, tasks: [], selected: [], error: reason instanceof Error ? reason.message : t('generate.community.errors.loadResources') })
    }
  }

  const installCommunityResourceBatch = async () => {
    const tasks = batchReview.tasks.filter((task) => batchReview.selected.includes(task.key))
    const civitaiTasks = tasks.filter((task) => task.installer !== 'workflowSetup')
    const supportTasks = tasks.filter((task) => task.installer === 'workflowSetup')
    const validation = rootValidation.isValid ? rootValidation : await validateComfyRoot()
    if (!validation?.isValid) {
      setBatchReview((previous) => ({ ...previous, error: validation?.error || t('generate.community.errors.chooseFolder') }))
      return
    }
    if (tasks.length === 0) return
    setBatchReview((previous) => ({ ...previous, open: false }))
    setInstallPhase('downloading')
    setInstallProgress({ overallPercent: 0, taskPercent: 0, message: t('generate.community.download.preparing'), bytesDownloaded: 0, totalBytes: 0 })
    setError('')
    try {
      const civitaiResult = civitaiTasks.length > 0 ? await window.electronAPI?.installCivitaiFiles?.({
        installId: globalThis.crypto?.randomUUID?.() || `civitai-batch-${Date.now()}`,
        comfyRootPath: validation.normalizedPath || comfyRootPath,
        files: civitaiTasks,
      }) : { success: true, files: [] }
      if (!civitaiResult?.success) throw new Error(civitaiResult?.error || t('generate.community.errors.downloadsFailed'))
      const supportResult = supportTasks.length > 0 ? await window.electronAPI?.installWorkflowSetup?.({
        comfyRootPath: validation.normalizedPath || comfyRootPath,
        plan: { nodePacks: [], models: supportTasks },
      }) : { success: true, modelResults: [] }
      if (!supportResult?.success) throw new Error(supportResult?.error || t('generate.community.errors.downloadsFailed'))
      const installedFiles = [...(civitaiResult.files || []), ...(supportResult.modelResults || supportResult.models || [])]
      setInstallResult({ success: true, files: installedFiles })
      setInstallPhase('complete')
      setCommunityMediaState({ busy: false, message: t('generate.community.media.batchInstalled', { count: tasks.length }), error: '' })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('generate.community.errors.downloadFailed'))
      setInstallPhase('error')
    }
  }

  const search = async (requestedReference = reference, preserveReturn = false) => {
    if (busy) return
    const nextReference = String(requestedReference || '').trim()
    const parsed = parseCivitaiReference(nextReference)
    if (!parsed) {
      setError(t('generate.community.errors.invalidReference'))
      return
    }
    setReference(nextReference)
    setReferenceHistory((previous) => rememberCivitaiReference(nextReference, previous))
    setBusy(true)
    setError('')
    setModel(null)
    if (!preserveReturn) setReturnCommunityMedia(null)
    setCommunityMedia(null)
    setCommunityMediaState({ busy: false, message: '', error: '' })
    try {
      if (parsed.kind === 'media') {
        const generationData = await fetchCivitaiImageGenerationData(parsed.mediaId)
        setCommunityMedia({ id: parsed.mediaId, sourceUrl: parsed.sourceUrl, generationData })
      } else {
        const next = await fetchCivitaiModel(parsed)
        const initialVersion = next.versions.find((version) => version.id === parsed.modelVersionId) || next.versions[0]
        setModel(next)
        setSelectedVersionId(initialVersion?.id || null)
        setSelectedFileIds(getDefaultCivitaiFileIds(next.type, initialVersion))
        setInstallResult(null)
        setInstallPhase('idle')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('generate.community.errors.loadModel'))
    } finally {
      setBusy(false)
    }
  }

  if (!consentLoaded) {
    return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-sf-accent" /></div>
  }
  if (!isExternalModelConsentValid(consent)) {
    return <TermsGate onAccepted={setConsent} onCancel={onCancelConsent} />
  }

  return (
    <div className="space-y-4">
      <ProviderCatalog />
      <div className="rounded-xl border border-sf-dark-700 bg-sf-dark-900 p-4">
        <div className="mb-3">
          <div className="text-xs font-semibold text-sf-text-primary">{t('generate.community.search.title')}</div>
          <div className="mt-1 text-[10px] text-sf-text-muted">{t('generate.community.search.description')}</div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sf-text-muted" />
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void search() }}
              placeholder={t('generate.community.search.placeholder')}
              className="w-full rounded-lg border border-sf-dark-600 bg-sf-dark-800 py-2.5 pl-9 pr-3 text-sm text-sf-text-primary outline-none focus:border-sf-accent"
            />
          </div>
          <button type="button" onClick={() => { void search() }} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-lg bg-sf-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-sf-accent-hover disabled:opacity-50">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {t('generate.community.search.inspect')}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-sf-text-muted">
          <span>{t('generate.community.search.unverified')}</span>
          <button type="button" onClick={() => { void revokeExternalModelConsent().then(() => setConsent(null)) }} className="shrink-0 underline hover:text-sf-text-secondary">{t('generate.community.search.disableAccess')}</button>
        </div>
        {referenceHistory.length > 0 && (
          <div className="mt-3">
            <div className="text-[9px] font-semibold uppercase tracking-wider text-sf-text-muted">{t('generate.community.search.recent')}</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {referenceHistory.map((item) => (
                <button
                  key={item}
                  type="button"
                  title={item}
                  disabled={busy}
                  onClick={() => { setReference(item); void search(item) }}
                  className="max-w-full truncate rounded border border-sf-dark-600 bg-sf-dark-800 px-2 py-1 text-[9px] text-sf-text-secondary hover:border-sf-accent hover:text-sf-text-primary disabled:opacity-50"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-3 rounded-lg border border-sf-dark-700 bg-sf-dark-800/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-semibold text-sf-text-secondary">{t('generate.community.apiKey.title')}</div>
              <div className="mt-0.5 text-[9px] text-sf-text-muted">{t('generate.community.apiKey.description')}</div>
            </div>
            <button type="button" onClick={() => window.electronAPI?.openExternalUrl?.('https://civitai.com/user/account')} className="text-[10px] text-sf-accent underline">{t('generate.community.apiKey.openAccount')}</button>
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              value={civitaiApiKey}
              onChange={(event) => { setCivitaiApiKey(event.target.value); setApiKeySaved(false) }}
              placeholder={t('generate.community.apiKey.placeholder')}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-sf-dark-600 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-primary outline-none focus:border-sf-accent"
            />
            <button type="button" onClick={() => { void saveCivitaiApiKey() }} className="rounded-lg border border-sf-dark-600 px-3 py-2 text-[10px] text-sf-text-secondary hover:text-sf-text-primary">{apiKeySaved ? t('generate.community.apiKey.saved') : t('generate.community.apiKey.save')}</button>
          </div>
        </div>
        {error && <div className="mt-3 rounded-lg border border-sf-error/30 bg-sf-error/10 p-2 text-xs text-sf-error">{error}</div>}
      </div>

      {communityMedia && (() => {
        const generationData = communityMedia.generationData || {}
        const prompt = String(generationData?.meta?.prompt || '').trim()
        const resources = Array.isArray(generationData.resources) ? generationData.resources : []
        const hasPublishedWorkflow = Boolean(extractPublishedComfyWorkflow(generationData))
        const template = detectCommunityWorkflowTemplate(generationData)
        const canOpen = hasPublishedWorkflow || Boolean(template)
        return (
          <div className="rounded-2xl border border-sf-dark-700 bg-sf-dark-900 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {generationData.thumbnailUrl && (
                  <img
                    src={generationData.thumbnailUrl}
                    alt=""
                    width="50"
                    height="50"
                    className="h-[50px] w-[50px] shrink-0 rounded-md border border-sf-dark-600 bg-sf-dark-800 object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-sf-text-primary">{t('generate.community.media.title', { id: communityMedia.id })}</div>
                  <div className="mt-1 text-xs text-sf-text-muted">{t(`generate.community.media.${generationData.type === 'video' ? 'video' : 'image'}`)}</div>
                </div>
              </div>
              <button type="button" onClick={() => window.electronAPI?.openExternalUrl?.(communityMedia.sourceUrl)} className="inline-flex items-center gap-1.5 rounded-lg border border-sf-dark-600 px-3 py-1.5 text-xs text-sf-text-secondary hover:border-sf-dark-400 hover:text-sf-text-primary">
                {t('generate.community.media.sourcePage')} <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className={`mt-4 rounded-lg border p-3 text-[10px] leading-4 ${hasPublishedWorkflow ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/25 bg-amber-400/10 text-amber-100'}`}>
              {hasPublishedWorkflow
                ? t('generate.community.media.publishedWorkflow')
                : template
                  ? t('generate.community.media.reconstructedWorkflow')
                  : t('generate.community.media.unsupportedWorkflow')}
            </div>

            {prompt && (
              <details className="mt-4 rounded-xl border border-sf-dark-700 bg-sf-dark-800/50 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-sf-text-primary">{t('generate.community.media.prompt')}</summary>
                <div className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-sf-text-secondary">{prompt}</div>
              </details>
            )}

            {resources.length > 0 && (
              <div className="mt-4">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-sf-text-muted">{t('generate.community.media.resources')}</div>
                <div className="mt-2 space-y-2">
                  {resources.map((resource, index) => (
                    <div key={`${resource.modelVersionId || resource.modelId || index}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-800/50 p-3">
                      <div className="min-w-0">
                        <div className="break-words text-xs font-semibold text-sf-text-primary">{resource.modelName || resource.name || t('generate.community.model.defaultType')}</div>
                        <div className="mt-1 text-[10px] text-sf-text-muted">{[resource.versionName, resource.type, resource.baseModel].filter(Boolean).join(' · ')}</div>
                      </div>
                      {resource.modelId && (
                        <button type="button" onClick={() => {
                          setReturnCommunityMedia(communityMedia)
                          void search(`https://civitai.com/models/${resource.modelId}${resource.modelVersionId ? `?modelVersionId=${resource.modelVersionId}` : ''}`, true)
                        }} className="shrink-0 rounded-lg border border-sf-dark-600 px-2.5 py-1.5 text-[10px] text-sf-text-secondary hover:border-sf-accent hover:text-sf-text-primary">
                          {t('generate.community.media.inspectResource')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={batchReview.loading || installPhase === 'downloading'} onClick={() => { void prepareCommunityResourceBatch() }} className="inline-flex items-center gap-2 rounded-lg border border-sf-accent/60 bg-sf-accent/10 px-4 py-2.5 text-xs font-semibold text-sf-accent hover:bg-sf-accent/20 disabled:opacity-45">
                {batchReview.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                {t('generate.community.media.reviewAllResources')}
              </button>
              <button type="button" disabled={!canOpen || communityMediaState.busy} onClick={() => { void openCommunityMediaWorkflow() }} className="inline-flex items-center gap-2 rounded-lg bg-sf-accent px-4 py-2.5 text-xs font-semibold text-white hover:bg-sf-accent-hover disabled:cursor-not-allowed disabled:opacity-45">
                {communityMediaState.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                {t(hasPublishedWorkflow ? 'generate.community.media.openPublished' : 'generate.community.media.openReconstructed')}
              </button>
              {!hasPublishedWorkflow && template && <span className="text-[10px] leading-4 text-sf-text-muted">{t('generate.community.media.localImageRequired')}</span>}
            </div>
            {communityMediaState.message && <div className="mt-3 text-[10px] text-emerald-300">{communityMediaState.message}</div>}
            {communityMediaState.error && <div className="mt-3 text-[10px] text-red-400">{communityMediaState.error}</div>}
            {installPhase === 'downloading' && (
              <div className="mt-3 rounded-lg border border-sf-dark-700 bg-sf-dark-800/50 p-3">
                <div className="h-2 overflow-hidden rounded-full bg-sf-dark-700"><div className="h-full bg-sf-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, installProgress.overallPercent || 0))}%` }} /></div>
                <div className="mt-2 flex items-center justify-between gap-3 text-[10px] text-sf-text-muted"><span>{installProgress.message}</span><button type="button" onClick={() => { void cancelInstall() }} className="text-sf-error underline">{t('generate.community.download.cancel')}</button></div>
              </div>
            )}
          </div>
        )
      })()}

      {model && (
        <div className="rounded-2xl border border-sf-dark-700 bg-sf-dark-900 p-4">
          {returnCommunityMedia && (
            <button type="button" onClick={() => {
              setModel(null)
              setCommunityMedia(returnCommunityMedia)
              setReturnCommunityMedia(null)
              setError('')
            }} className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-sf-dark-600 px-3 py-2 text-xs text-sf-text-secondary hover:border-sf-accent hover:text-sf-text-primary">
              ← {t('generate.community.media.backToPost')}
            </button>
          )}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-sf-text-primary">{model.name}</div>
              <div className="mt-1 text-xs text-sf-text-muted">{model.type || t('generate.community.model.defaultType')}{model.creator ? ` · ${t('generate.community.model.by', { creator: model.creator })}` : ''}</div>
            </div>
            <button type="button" onClick={() => window.electronAPI?.openExternalUrl?.(model.sourceUrl)} className="inline-flex items-center gap-1.5 rounded-lg border border-sf-dark-600 px-3 py-1.5 text-xs text-sf-text-secondary hover:border-sf-dark-400 hover:text-sf-text-primary">
              {t('generate.community.model.sourcePage')} <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-sf-text-muted">{t('generate.community.model.version')}</label>
            <select value={selectedVersion?.id || ''} onChange={(event) => {
              const nextId = Number(event.target.value)
              const nextVersion = model.versions.find((version) => version.id === nextId)
              setSelectedVersionId(nextId)
              setSelectedFileIds(getDefaultCivitaiFileIds(model.type, nextVersion))
              setInstallResult(null)
              setInstallPhase('idle')
            }} className="mt-1 w-full rounded-lg border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary">
              {model.versions.map((version) => <option key={version.id} value={version.id}>{version.name} · {version.baseModel || t('generate.community.model.unknownBase')}</option>)}
            </select>
          </div>

          {selectedVersion?.images?.length > 0 && (
            <div className="mt-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-sf-text-muted">{t('generate.community.examples.title')}</div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                {selectedVersion.images.slice(0, 12).map((image, index) => (
                  <div key={`${image.url}-${index}`} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => window.electronAPI?.openExternalUrl?.(image.url)}
                      onContextMenu={(event) => {
                        event.preventDefault()
                        setExampleMenu((current) => current?.id === image.id ? null : image)
                        setExampleGenerationState((current) => ({ ...current, message: '', error: '' }))
                      }}
                      title={image.id ? t('generate.community.examples.imageHelp') : t('generate.community.examples.openSource')}
                      className="h-[160px] w-[160px] overflow-hidden rounded-lg border border-sf-dark-700 bg-sf-dark-800 hover:border-sf-accent"
                    >
                      <img src={image.url} alt={t('generate.community.examples.alt', { index: index + 1 })} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    </button>
                    {exampleMenu?.id === image.id && (
                      <div className="absolute left-2 top-2 z-30 w-[145px] rounded-lg border border-sf-dark-600 bg-sf-dark-950 p-1.5 shadow-xl">
                        <button
                          type="button"
                          disabled={
                            (!isKrea2Model && !isLoraModel)
                            || !installedGenerationFile
                            || (isLoraModel && !isLoraBaseReady)
                            || Boolean(exampleGenerationState.busyId)
                          }
                          onClick={() => { void generateWithExampleParameters(image) }}
                          className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-left text-[10px] font-semibold text-sf-text-primary hover:bg-sf-accent/20 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {exampleGenerationState.busyId === image.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                          {t('generate.community.examples.generateWithParameters')}
                        </button>
                        {!installedGenerationFile && <div className="px-2 pb-1 text-[9px] leading-3 text-amber-300">{t('generate.community.examples.installFirst')}</div>}
                        {installedLoraFile && !isLoraBaseReady && <div className="px-2 pb-1 text-[9px] leading-3 text-amber-300">{loraBaseState.error || t('generate.community.lora.selectBase')}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-1 text-[9px] text-sf-text-muted">{t('generate.community.examples.controls')}</div>
              {exampleGenerationState.message && <div className="mt-2 text-[10px] leading-4 text-emerald-300">{exampleGenerationState.message}</div>}
              {exampleGenerationState.error && <div className="mt-2 text-[10px] leading-4 text-red-400">{exampleGenerationState.error}</div>}
            </div>
          )}

          {selectedVersion && (
            <div className="mt-4 space-y-3">
              {selectedVersion.trainedWords.length > 0 && <div className="text-xs text-sf-text-secondary"><span className="text-sf-text-muted">{t('generate.community.model.triggerWords')}</span> {selectedVersion.trainedWords.join(', ')}</div>}
              <div className="space-y-2">
                {selectedVersion.files.map((file) => (
                  <div key={file.id || file.name} className="rounded-xl border border-sf-dark-700 bg-sf-dark-800/60 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          disabled={!isCivitaiFileInstallable(model.type, file) || installPhase === 'downloading'}
                          onChange={(event) => setSelectedFileIds((previous) => event.target.checked
                            ? [...new Set([...previous, file.id])]
                            : previous.filter((id) => id !== file.id))}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                        <div className="break-all text-xs font-semibold text-sf-text-primary">{file.name}</div>
                        <div className="mt-1 text-[10px] text-sf-text-muted">{file.type}{file.format ? ` · ${file.format}` : ''}{file.precision ? ` · ${file.precision}` : ''}{file.sizeBytes > 0 ? ` · ${formatBytes(file.sizeBytes)}` : ''}</div>
                        <div className="mt-1 text-[10px] text-sf-text-muted">→ ComfyUI/models/{inferComfyModelSubdir(model.type, file.type) || t('generate.community.files.unsupported')}</div>
                        </div>
                      </div>
                      {file.primary
                        ? <span className="rounded-full bg-sf-accent/15 px-2 py-0.5 text-[10px] text-sf-accent">{t('generate.community.files.primary')}</span>
                        : <span className="rounded-full bg-sf-dark-700 px-2 py-0.5 text-[10px] text-sf-text-muted">{t('generate.community.files.alternative')}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5"><ScanBadge label={t('generate.community.scan.virus')} value={file.virusScanResult} /><ScanBadge label={t('generate.community.scan.pickle')} value={file.pickleScanResult} /></div>
                    {file.sha256 && <div className="mt-2 truncate font-mono text-[9px] text-sf-text-muted" title={file.sha256}>SHA-256 {file.sha256}</div>}
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-2.5 text-[10px] leading-4 text-amber-100/80">
                {t('generate.community.files.licenseWarning')}
              </div>
              {duplicateSelections.length > 0 && (
                <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 p-2.5 text-[10px] leading-4 text-amber-100">
                  {t('generate.community.files.duplicateWarning')}
                </div>
              )}

              <div className="rounded-xl border border-sf-dark-700 bg-sf-dark-800/40 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-sf-text-primary">{t('generate.community.destination.title')}</div>
                    <div className="mt-1 break-all text-[10px] text-sf-text-muted">{rootValidation.isValid ? rootValidation.normalizedPath : (comfyRootPath || t('generate.community.destination.notConfigured'))}</div>
                  </div>
                  <button type="button" onClick={() => { void chooseComfyRoot() }} disabled={installPhase === 'downloading'} className="inline-flex items-center gap-1.5 rounded-lg border border-sf-dark-600 px-3 py-1.5 text-xs text-sf-text-secondary hover:border-sf-dark-400 hover:text-sf-text-primary disabled:opacity-50">
                    <FolderOpen className="h-3.5 w-3.5" /> {t('generate.community.destination.chooseFolder')}
                  </button>
                </div>
                {rootValidation.checked && !rootValidation.isValid && <div className="mt-2 text-[10px] text-sf-error">{rootValidation.error || t('generate.community.errors.invalidComfyFolder')}</div>}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[10px] text-sf-text-muted">
                    {t(installTasks.length === 1 ? 'generate.community.download.selectedOne' : 'generate.community.download.selectedMany', { count: installTasks.length })} · {formatBytes(totalInstallBytes)}
                    {diskSpace.checked && Number.isFinite(diskSpace.freeBytes) ? ` · ${t('generate.community.download.freeSpace', { size: formatBytes(diskSpace.freeBytes) })}` : ''}
                  </div>
                  {installPhase === 'downloading' ? (
                    <button type="button" onClick={() => { void cancelInstall() }} className="inline-flex items-center gap-2 rounded-lg border border-sf-error/50 bg-sf-error/10 px-4 py-2 text-xs font-semibold text-sf-error hover:bg-sf-error/20">
                      <XCircle className="h-3.5 w-3.5" /> {t('generate.community.download.cancel')}
                    </button>
                  ) : (
                    <button type="button" onClick={() => { void prepareInstall() }} disabled={installTasks.length === 0 || installedCheck.status === 'checking'} className="inline-flex items-center gap-2 rounded-lg bg-sf-accent px-4 py-2 text-xs font-semibold text-white hover:bg-sf-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
                      {installedCheck.status === 'checking' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {installedCheck.status === 'checking' ? t('generate.community.download.checking') : t('generate.community.download.review')}
                    </button>
                  )}
                </div>
                {insufficientSpace && <div className="mt-2 text-[10px] text-sf-error">{t('generate.community.download.insufficientSpace')}</div>}
                {installPhase === 'downloading' && (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-sf-dark-700"><div className="h-full bg-sf-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, installProgress.overallPercent || 0))}%` }} /></div>
                    <div className="mt-1 text-[10px] text-sf-text-muted">{installProgress.message}</div>
                  </div>
                )}
                {installResult?.files?.length > 0 && (
                  <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-2.5 text-[10px] text-emerald-200">
                    <div>
                      {t(installResult.files.length === 1 ? 'generate.community.download.installedOne' : 'generate.community.download.installedMany', { count: installResult.files.length })}
                      <button type="button" onClick={() => window.electronAPI?.showItemInFolder?.(installResult.files[0].targetPath)} className="ml-2 underline">{t('generate.community.download.showInFolder')}</button>
                    </div>
                    {installedLoraFile && (
                      <div className="mt-2 rounded-lg border border-sf-dark-600 bg-sf-dark-900/60 p-2">
                        <label className="block text-[9px] font-semibold uppercase tracking-wider text-sf-text-muted">
                          {t(loraBaseState.mode === 'anima'
                            ? 'generate.community.lora.baseDiffusionModel'
                            : 'generate.community.lora.baseCheckpoint')}
                        </label>
                        <select
                          value={loraBaseState.selected}
                          onChange={(event) => {
                            const selected = event.target.value
                            setLoraBaseState((previous) => ({ ...previous, selected, error: '' }))
                            if (loraBaseState.mode === 'anima' && selected) {
                              void window.electronAPI?.setSetting?.('animaBaseDiffusionModel', selected)
                            } else if (selected && /sdxl|\bxl\b/i.test(String(selectedVersion?.baseModel || ''))) {
                              void window.electronAPI?.setSetting?.('sdxlBaseCheckpoint', selected)
                            }
                          }}
                          disabled={loraBaseState.status === 'loading' || loraBaseState.options.length === 0}
                          className="mt-1 w-full rounded-md border border-sf-dark-600 bg-sf-dark-950 px-2 py-1.5 text-[10px] text-sf-text-primary disabled:opacity-50"
                        >
                          {loraBaseState.options.length === 0 && <option value="">{t(loraBaseState.mode === 'anima'
                            ? 'generate.community.lora.noDiffusionModelOption'
                            : 'generate.community.lora.noCheckpointOption')}</option>}
                          {loraBaseState.options.map((checkpoint) => <option key={checkpoint} value={checkpoint}>{checkpoint}</option>)}
                        </select>
                        <div className="mt-1 text-[9px] leading-3 text-sf-text-muted">
                          {loraBaseState.status === 'loading'
                            ? t(loraBaseState.mode === 'anima'
                                ? 'generate.community.lora.loadingAnimaComponents'
                                : 'generate.community.lora.loadingCheckpoints')
                            : (loraBaseState.error || t(loraBaseState.mode === 'anima'
                                ? 'generate.community.lora.animaBaseHelp'
                                : 'generate.community.lora.baseHelp', { base: selectedVersion?.baseModel || t('generate.community.model.unknownBase') }))}
                        </div>
                      </div>
                    )}
                    {((isKrea2Model && installedKreaDiffusionFile) || installedLoraFile) && (
                      <button
                        type="button"
                        disabled={generateWithModelState.busy || Boolean(installedLoraFile && !isLoraBaseReady)}
                        onClick={() => { void generateWithInstalledModel() }}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-sf-accent px-3 py-2 text-xs font-semibold text-white hover:bg-sf-accent-hover disabled:opacity-50"
                      >
                        {generateWithModelState.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutGrid className="h-3.5 w-3.5" />}
                        {t('generate.community.krea.generateWithModel')}
                      </button>
                    )}
                    {isKrea2Model && installedKreaDiffusionFile && (
                      <div className="mt-2 text-[9px] leading-4 text-emerald-100/80">
                        {t('generate.community.krea.description')}
                      </div>
                    )}
                    {installedLoraFile && (
                      <div className="mt-2 text-[9px] leading-4 text-emerald-100/80">
                        {t('generate.community.lora.description')}
                      </div>
                    )}
                  </div>
                )}
                {(generateWithModelState.message || generateWithModelState.error) && (
                  <div className={`mt-2 text-[10px] ${generateWithModelState.error ? 'text-sf-error' : 'text-emerald-300'}`}>
                    {generateWithModelState.error || generateWithModelState.message}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {batchReview.open && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !batchReview.loading) setBatchReview((previous) => ({ ...previous, open: false })) }}>
          <div className="w-full max-w-2xl rounded-2xl border border-sf-dark-600 bg-sf-dark-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-sf-text-primary">{t('generate.community.media.batchTitle')}</h3>
            <p className="mt-2 text-xs leading-5 text-sf-text-secondary">{t('generate.community.media.batchDescription')}</p>
            {batchReview.loading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-xs text-sf-text-muted"><Loader2 className="h-4 w-4 animate-spin" />{t('generate.community.media.loadingResources')}</div>
            ) : (
              <div className="mt-3 max-h-[50vh] space-y-2 overflow-auto">
                {batchReview.tasks.map((task) => (
                  <label key={task.key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-sf-dark-700 bg-sf-dark-800 p-3">
                    <input type="checkbox" checked={batchReview.selected.includes(task.key)} onChange={(event) => setBatchReview((previous) => ({ ...previous, selected: event.target.checked ? [...previous.selected, task.key] : previous.selected.filter((key) => key !== task.key) }))} className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] text-sf-text-muted">{task.resourceName}{task.versionName ? ` · ${task.versionName}` : ''}</div>
                      <div className="mt-1 break-all text-xs font-semibold text-sf-text-primary">{task.filename}</div>
                      <div className="mt-1 text-[10px] text-sf-text-muted">ComfyUI/models/{task.targetSubdir} · {formatBytes(task.sizeBytes)}</div>
                    </div>
                  </label>
                ))}
                {batchReview.tasks.length === 0 && !batchReview.error && <div className="py-6 text-center text-xs text-sf-text-muted">{t('generate.community.media.noInstallableResources')}</div>}
              </div>
            )}
            {batchReview.error && <div className="mt-3 rounded-lg border border-sf-error/30 bg-sf-error/10 p-2 text-xs text-sf-error">{batchReview.error}</div>}
            {!batchReview.loading && batchReview.tasks.length > 0 && (
              <div className="mt-3 text-xs text-sf-text-secondary">{t('generate.community.media.batchTotal', { count: batchReview.selected.length, size: formatBytes(batchReview.tasks.filter((task) => batchReview.selected.includes(task.key)).reduce((sum, task) => sum + (Number(task.sizeBytes) || 0), 0)) })}</div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={batchReview.loading} onClick={() => setBatchReview((previous) => ({ ...previous, open: false }))} className="rounded-lg border border-sf-dark-600 px-4 py-2 text-xs text-sf-text-secondary hover:text-sf-text-primary disabled:opacity-50">{t('common.cancel')}</button>
              <button type="button" disabled={batchReview.loading || batchReview.selected.length === 0} onClick={() => { void installCommunityResourceBatch() }} className="rounded-lg bg-sf-accent px-4 py-2 text-xs font-semibold text-white hover:bg-sf-accent-hover disabled:opacity-50">{t('generate.community.media.downloadSelected')}</button>
            </div>
          </div>
        </div>
      )}

      {showInstallConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowInstallConfirm(false) }}>
          <div className="w-full max-w-lg rounded-2xl border border-sf-dark-600 bg-sf-dark-900 p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-sf-text-primary">{t('generate.community.confirm.title')}</h3>
            <p className="mt-2 text-xs leading-5 text-sf-text-secondary">{t('generate.community.confirm.description')}</p>
            <div className="mt-3 max-h-52 space-y-2 overflow-auto">
              {installTasks.map((task) => <div key={`${task.targetSubdir}/${task.filename}`} className="rounded-lg border border-sf-dark-700 bg-sf-dark-800 p-2 text-[10px] text-sf-text-secondary"><div className="break-all font-semibold text-sf-text-primary">{task.filename}</div><div className="mt-1">ComfyUI/models/{task.targetSubdir} · {formatBytes(task.sizeBytes)}</div></div>)}
            </div>
            <div className="mt-3 text-xs text-sf-text-secondary">{t('generate.community.confirm.total', { size: formatBytes(totalInstallBytes) })}</div>
            {insufficientSpace && <div className="mt-2 text-xs text-sf-error">{t('generate.community.confirm.insufficientSpace')}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setShowInstallConfirm(false)} className="rounded-lg border border-sf-dark-600 px-4 py-2 text-xs text-sf-text-secondary hover:text-sf-text-primary">{t('common.cancel')}</button>
              <button type="button" disabled={insufficientSpace} onClick={() => { void install() }} className="rounded-lg bg-sf-accent px-4 py-2 text-xs font-semibold text-white hover:bg-sf-accent-hover disabled:cursor-not-allowed disabled:opacity-50">{t('generate.community.confirm.download')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
