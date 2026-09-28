const LORA_NODE_IDS = Object.freeze(['20', '21', '22', '23', '24'])

function cloneWorkflow(workflow) {
  return JSON.parse(JSON.stringify(workflow || {}))
}

function normalizedLoras(value) {
  const entries = Array.isArray(value) ? value : []
  return entries.slice(0, LORA_NODE_IDS.length).map((entry) => ({
    enabled: entry?.enabled !== false,
    name: String(entry?.name || '').trim(),
    strength: Math.max(-100, Math.min(100, Number(entry?.strength) || 0)),
  })).filter((entry) => entry.enabled && entry.name && entry.strength !== 0)
}

export function modifyAnimaLoraUpscaleWorkflow(workflow, options = {}) {
  const next = cloneWorkflow(workflow)
  const checkpointName = String(options.checkpointName || '').trim()
  if (!checkpointName) throw new Error('Select an ANIMA checkpoint before running this flow.')

  next['1'].inputs.ckpt_name = checkpointName
  next['5'].inputs.text = String(options.prompt || '')
  next['6'].inputs.text = String(options.negativePrompt || '')
  next['7'].inputs.width = Math.max(256, Math.round((Number(options.width) || 768) / 8) * 8)
  next['7'].inputs.height = Math.max(256, Math.round((Number(options.height) || 1280) / 8) * 8)
  const cfg = Number(options.cfg)
  next['13'].inputs.cfg = Math.max(0, Math.min(100, Number.isFinite(cfg) ? cfg : 5))
  next['13'].inputs.seed = Math.max(0, Math.round(Number(options.seed) || 0))
  next['13'].inputs.eta = Math.max(-100, Math.min(100, Number.isFinite(Number(options.eta)) ? Number(options.eta) : 0.5))
  next['13'].inputs.denoise = Math.max(0, Math.min(1, Number.isFinite(Number(options.denoise)) ? Number(options.denoise) : 1))
  next['13'].inputs.sampler_name = String(options.samplerName || 'exponential/res_2s')
  next['13'].inputs.scheduler = String(options.scheduler || 'karras')
  next['13'].inputs.sampler_mode = String(options.samplerMode || 'standard')
  next['13'].inputs.bongmath = options.bongmath !== false
  next['12'].inputs.steps = Math.max(1, Math.min(100, Math.round(Number(options.steps) || 15)))
  next['13'].inputs.steps = next['12'].inputs.steps
  next['12'].inputs.width = next['7'].inputs.width
  next['12'].inputs.height = next['7'].inputs.height
  next['17'].inputs.filename_prefix = String(options.filenamePrefix || 'image/CANVAS_anima_lora')

  const loras = normalizedLoras(options.loras)
  let modelLink = ['1', 0]
  let clipLink = ['1', 1]
  for (let index = 0; index < LORA_NODE_IDS.length; index += 1) {
    const nodeId = LORA_NODE_IDS[index]
    const lora = loras[index]
    if (!lora) {
      delete next[nodeId]
      continue
    }
    next[nodeId].inputs = {
      model: modelLink,
      clip: clipLink,
      lora_name: lora.name,
      strength_model: lora.strength,
      strength_clip: lora.strength,
    }
    modelLink = [nodeId, 0]
    clipLink = [nodeId, 1]
  }
  next['5'].inputs.clip = clipLink
  next['6'].inputs.clip = clipLink
  next['13'].inputs.model = modelLink

  if (options.upscaleEnabled) {
    const upscaleModel = String(options.upscaleModel || '').trim()
    if (!upscaleModel) throw new Error('Select an upscale model, or turn upscale off.')
    next['15'].inputs.model_name = upscaleModel
    next['17'].inputs.images = ['16', 0]
  } else {
    delete next['15']
    delete next['16']
    next['17'].inputs.images = ['14', 0]
  }
  return next
}
