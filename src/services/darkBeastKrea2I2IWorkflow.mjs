const cloneWorkflow = workflow => JSON.parse(JSON.stringify(workflow || {}))

function findNode(workflow, classType) {
  return Object.values(workflow).find(node => node?.class_type === classType) || null
}

function findNodeEntry(workflow, classType) {
  return Object.entries(workflow).find(([, node]) => node?.class_type === classType) || null
}

function boundedNumber(value, fallback, min, max, integer = false) {
  const parsed = Number(value)
  const resolved = Number.isFinite(parsed) ? parsed : fallback
  const bounded = Math.min(max, Math.max(min, resolved))
  return integer ? Math.round(bounded) : bounded
}

/**
 * Configure Dark Beast KREA 2 for either text-to-image or conventional latent
 * image-to-image. With a source image, denoise controls how far the result may
 * depart from it. Without one, sampling starts from an empty latent at denoise 1.
 */
export function modifyDarkBeastKrea2I2IWorkflow(workflow, options = {}) {
  const next = cloneWorkflow(workflow)
  const loadImageEntry = findNodeEntry(next, 'LoadImage')
  const vaeEncodeEntry = findNodeEntry(next, 'VAEEncode')
  const emptyLatentEntry = findNodeEntry(next, 'EmptyLatentImage')
  const prompt = findNode(next, 'CLIPTextEncode')
  const sampler = findNode(next, 'KSampler')
  const saver = findNode(next, 'SaveImage')

  if (!loadImageEntry || !vaeEncodeEntry || !emptyLatentEntry || !prompt || !sampler || !saver) {
    throw new Error('Dark Beast KREA 2 T2I / I2I workflow is missing a required core node.')
  }

  const inputImage = String(options.inputImage || '').trim()
  const [loadImageId, loadImage] = loadImageEntry
  const [vaeEncodeId] = vaeEncodeEntry
  const [emptyLatentId, emptyLatent] = emptyLatentEntry
  if (inputImage) {
    loadImage.inputs.image = inputImage
    sampler.inputs.latent_image = [vaeEncodeId, 0]
    delete next[emptyLatentId]
  } else {
    emptyLatent.inputs.width = boundedNumber(options.width, 960, 256, 4096, true)
    emptyLatent.inputs.height = boundedNumber(options.height, 1440, 256, 4096, true)
    sampler.inputs.latent_image = [emptyLatentId, 0]
    delete next[loadImageId]
    delete next[vaeEncodeId]
  }
  prompt.inputs.text = String(options.prompt || '').trim()
  sampler.inputs.seed = boundedNumber(options.seed, 0, 0, Number.MAX_SAFE_INTEGER, true)
  sampler.inputs.steps = boundedNumber(options.steps, 16, 1, 1000, true)
  sampler.inputs.cfg = boundedNumber(options.cfg, 1, 0, 100)
  sampler.inputs.denoise = inputImage ? boundedNumber(options.denoise, 0.55, 0, 1) : 1
  sampler.inputs.sampler_name = String(options.samplerName || 'euler').trim() || 'euler'
  sampler.inputs.scheduler = String(options.scheduler || 'simple').trim() || 'simple'
  saver.inputs.filename_prefix = String(options.filenamePrefix || 'image/CANVAS_dark_beast_krea2').trim()

  return next
}
