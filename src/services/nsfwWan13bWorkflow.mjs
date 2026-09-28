const cloneWorkflow = workflow => JSON.parse(JSON.stringify(workflow || {}))

function findNode(workflow, classType) {
  return Object.values(workflow).find(node => node?.class_type === classType) || null
}

function findPromptNode(workflow, titlePart) {
  const normalized = String(titlePart || '').toLowerCase()
  return Object.values(workflow).find(node => (
    node?.class_type === 'CLIPTextEncode'
    && String(node?._meta?.title || '').toLowerCase().includes(normalized)
  )) || null
}

function boundedNumber(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  const resolved = Number.isFinite(parsed) ? parsed : fallback
  const bounded = Math.min(max, Math.max(min, resolved))
  return integer ? Math.round(bounded) : bounded
}

function multipleOf(value, fallback, multiple, min, max) {
  const bounded = boundedNumber(value, fallback, min, max, true)
  return Math.max(min, Math.min(max, Math.round(bounded / multiple) * multiple))
}

function wanFrameCount(value) {
  const bounded = boundedNumber(value, 81, 5, 257, true)
  return Math.max(5, Math.min(257, Math.round((bounded - 1) / 4) * 4 + 1))
}

export function modifyNsfwWan13bWorkflow(workflow, options = {}) {
  const next = cloneWorkflow(workflow)
  const positive = findPromptNode(next, 'positive')
  const negative = findPromptNode(next, 'negative')
  const latent = findNode(next, 'EmptyHunyuanLatentVideo')
  const sampler = findNode(next, 'KSampler')
  const createVideo = findNode(next, 'CreateVideo')
  const saver = findNode(next, 'SaveVideo')

  if (!positive || !negative || !latent || !sampler || !createVideo || !saver) {
    throw new Error('NSFW Wan 1.3B e10 workflow is missing a required core node.')
  }

  positive.inputs.text = String(options.prompt || '').trim()
  negative.inputs.text = String(options.negativePrompt || negative.inputs.text || '').trim()
  latent.inputs.width = multipleOf(options.width, 832, 16, 256, 2048)
  latent.inputs.height = multipleOf(options.height, 480, 16, 256, 2048)
  latent.inputs.length = wanFrameCount(options.frames)
  sampler.inputs.seed = boundedNumber(options.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  sampler.inputs.steps = boundedNumber(options.steps, 30, 1, 100, true)
  sampler.inputs.cfg = boundedNumber(options.cfg, 6, 0, 100)
  sampler.inputs.sampler_name = String(options.samplerName || 'uni_pc').trim() || 'uni_pc'
  sampler.inputs.scheduler = String(options.scheduler || 'simple').trim() || 'simple'
  createVideo.inputs.fps = boundedNumber(options.fps, 16, 1, 120)
  saver.inputs.filename_prefix = String(options.filenamePrefix || 'video/CANVAS_nsfw_wan_1_3b_e10').trim()

  return next
}
