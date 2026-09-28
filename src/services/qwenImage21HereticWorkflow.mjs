const TRANSPARENT_PROMPT_PREFIX = 'This is an RGBA format image with transparency.'
const TRANSPARENT_PROMPT_SUFFIX = 'The image has an alpha channel and a transparent background.'

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

export function buildQwenImage21Prompt(prompt = '', transparentPng = false) {
  const subject = String(prompt || '').trim()
  if (!transparentPng) return subject
  return `${TRANSPARENT_PROMPT_PREFIX} ${subject} ${TRANSPARENT_PROMPT_SUFFIX}`.trim()
}

export function modifyQwenImage21HereticWorkflow(workflow, options = {}) {
  const next = cloneWorkflow(workflow)
  const encoder = findNode(next, 'TextEncodeQwenImage21')
  const latent = findNode(next, 'EmptyLatentImage')
  const sampler = findNode(next, 'KSampler')
  const saver = findNode(next, 'SaveImage')

  if (!encoder || !latent || !sampler || !saver) {
    throw new Error('Qwen Image 2.1 Heretic workflow is missing a required core node.')
  }

  encoder.inputs.prompt = buildQwenImage21Prompt(options.prompt, options.transparentPng)
  encoder.inputs.negative_prompt = String(options.negativePrompt || '').trim()
  latent.inputs.width = boundedNumber(options.width, 1024, 256, 4096, true)
  latent.inputs.height = boundedNumber(options.height, 1024, 256, 4096, true)
  latent.inputs.batch_size = boundedNumber(options.variantCount, 1, 1, 10, true)
  sampler.inputs.seed = boundedNumber(options.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  sampler.inputs.steps = boundedNumber(options.steps, 25, 1, 1000, true)
  sampler.inputs.cfg = boundedNumber(options.cfg, 1, 0, 100)
  sampler.inputs.sampler_name = String(options.samplerName || 'euler').trim() || 'euler'
  sampler.inputs.scheduler = String(options.scheduler || 'simple').trim() || 'simple'
  saver.inputs.filename_prefix = String(options.filenamePrefix || 'image/CANVAS_qwen_image_2_1_heretic').trim()

  return next
}

export function modifyQwenImage21HereticEditWorkflow(workflow, options = {}) {
  const next = cloneWorkflow(workflow)
  const image = findNode(next, 'LoadImage')
  const encoder = findNode(next, 'TextEncodeQwenImage21')
  const sampler = findNode(next, 'KSampler')
  const saver = findNode(next, 'SaveImage')

  if (!image || !encoder || !sampler || !saver) {
    throw new Error('Qwen Image 2.1 Heretic edit workflow is missing a required core node.')
  }

  const inputImage = String(options.inputImage || '').trim()
  if (!inputImage) throw new Error('Qwen Image 2.1 Heretic edit requires an input image.')

  image.inputs.image = inputImage
  encoder.inputs.prompt = buildQwenImage21Prompt(options.prompt, options.transparentPng)
  encoder.inputs.negative_prompt = String(options.negativePrompt || '').trim()
  encoder.inputs.resolution = boundedNumber(options.resolution, 1024, 0, 2048, true)
  sampler.inputs.seed = boundedNumber(options.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  sampler.inputs.steps = boundedNumber(options.steps, 25, 1, 1000, true)
  sampler.inputs.cfg = boundedNumber(options.cfg, 1, 0, 100)
  sampler.inputs.sampler_name = String(options.samplerName || 'euler').trim() || 'euler'
  sampler.inputs.scheduler = String(options.scheduler || 'simple').trim() || 'simple'
  saver.inputs.filename_prefix = String(options.filenamePrefix || 'image/CANVAS_qwen_image_2_1_heretic_edit').trim()

  return next
}

export function modifyQwenImage21CharacterSheetWorkflow(workflow, options = {}) {
  const next = cloneWorkflow(workflow)
  const image = findNode(next, 'LoadImage')
  const encoder = findNode(next, 'TextEncodeQwenImage21')
  const latent = findNode(next, 'EmptyLatentImage')
  const sampler = findNode(next, 'KSampler')
  const saver = findNode(next, 'SaveImage')

  if (!image || !encoder || !latent || !sampler || !saver) {
    throw new Error('QWEN character sheet workflow is missing a required core node.')
  }

  const inputImage = String(options.inputImage || '').trim()
  if (!inputImage) throw new Error('QWEN character sheet requires a reference image.')

  image.inputs.image = inputImage
  encoder.inputs.prompt = String(options.prompt || '').trim()
  encoder.inputs.negative_prompt = String(options.negativePrompt || '').trim()
  encoder.inputs.resolution = boundedNumber(options.resolution, 1536, 0, 2048, true)
  latent.inputs.width = boundedNumber(options.width, 2240, 256, 4096, true)
  latent.inputs.height = boundedNumber(options.height, 1504, 256, 4096, true)
  latent.inputs.batch_size = 1
  sampler.inputs.seed = boundedNumber(options.seed, 42, 0, Number.MAX_SAFE_INTEGER, true)
  sampler.inputs.steps = boundedNumber(options.steps, 25, 1, 1000, true)
  sampler.inputs.cfg = boundedNumber(options.cfg, 1, 0, 100)
  sampler.inputs.sampler_name = String(options.samplerName || 'res_2m').trim() || 'res_2m'
  sampler.inputs.scheduler = String(options.scheduler || 'beta').trim() || 'beta'
  saver.inputs.filename_prefix = String(options.filenamePrefix || 'image/CANVAS_qwen_character_sheet').trim()

  return next
}
