const cloneWorkflow = workflow => JSON.parse(JSON.stringify(workflow || {}))

function findNode(workflow, classType) {
  return Object.values(workflow).find(node => node?.class_type === classType) || null
}

function boundedNumber(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  const resolved = Number.isFinite(parsed) ? parsed : fallback
  const bounded = Math.min(max, Math.max(min, resolved))
  return integer ? Math.round(bounded) : bounded
}

export function modifyHarukiMixKrea2Workflow(workflow, options = {}) {
  const next = cloneWorkflow(workflow)
  const prompt = findNode(next, 'CLIPTextEncode')
  const latent = findNode(next, 'EmptyLatentImage')
  const sampler = findNode(next, 'KSampler')
  const saver = findNode(next, 'SaveImage')

  if (!prompt || !latent || !sampler || !saver) {
    throw new Error('HARUKI_MIX Krea 2 workflow is missing a required core node.')
  }

  prompt.inputs.text = String(options.prompt || '').trim()
  latent.inputs.width = boundedNumber(options.width, 816, 256, 4096, true)
  latent.inputs.height = boundedNumber(options.height, 1104, 256, 4096, true)
  latent.inputs.batch_size = boundedNumber(options.variantCount, 1, 1, 10, true)
  sampler.inputs.seed = boundedNumber(options.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  sampler.inputs.steps = boundedNumber(options.steps, 8, 1, 1000, true)
  sampler.inputs.cfg = boundedNumber(options.cfg, 1, 0, 100)
  sampler.inputs.sampler_name = String(options.samplerName || 'euler').trim() || 'euler'
  sampler.inputs.scheduler = String(options.scheduler || 'simple').trim() || 'simple'
  saver.inputs.filename_prefix = String(options.filenamePrefix || 'image/CANVAS_haruki_mix_krea2').trim()

  return next
}
