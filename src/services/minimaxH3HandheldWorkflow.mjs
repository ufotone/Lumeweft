export const MINIMAX_H3_HANDHELD_LORA = 'handheld_h3_100.safetensors'
export const MINIMAX_H3_HANDHELD_STRENGTH = 1.7

export function modifyMinimaxH3HandheldWorkflow(workflow, options = {}) {
  const modified = JSON.parse(JSON.stringify(workflow))
  const entries = Object.entries(modified)
  const findEntry = classType => entries.find(([, node]) => node?.class_type === classType)
  const [imageNodeId, imageNode] = findEntry('LoadImage') || []
  const [, conditioningNode] = findEntry('MiniMaxH3ImageToVideo') || []
  const [, loraNode] = findEntry('LoraLoaderModelOnly') || []
  const [, schedulerNode] = findEntry('BasicScheduler') || []
  const [, samplerNode] = findEntry('KSamplerSelect') || []
  const [, noiseNode] = findEntry('RandomNoise') || []
  const [, videoNode] = findEntry('CreateVideo') || []
  const [, saveNode] = findEntry('SaveVideo') || []

  if (!conditioningNode?.inputs || !loraNode?.inputs || !schedulerNode?.inputs) {
    throw new Error('H3 Handheld workflow is missing one or more required nodes.')
  }

  const inputImage = String(options.inputImage || '').trim()
  if (inputImage && imageNode?.inputs) {
    imageNode.inputs.image = inputImage
    conditioningNode.inputs.first_frame = [imageNodeId, 0]
  } else {
    delete conditioningNode.inputs.first_frame
    if (imageNodeId) delete modified[imageNodeId]
  }

  const width = Math.max(256, Math.round((Number(options.width) || 640) / 32) * 32)
  const height = Math.max(256, Math.round((Number(options.height) || 480) / 32) * 32)
  const requestedFrames = Math.max(5, Math.round((Number(options.duration) || 3.75) * 24))
  const length = requestedFrames + ((5 - (requestedFrames % 17)) + 17) % 17

  conditioningNode.inputs.prompt = String(options.prompt || '').trim() || 'Natural documentary realism. Subtle handheld shake and organic operator micro-movements throughout one continuous shot.'
  conditioningNode.inputs.width = width
  conditioningNode.inputs.height = height
  conditioningNode.inputs.length = length
  delete conditioningNode.inputs.last_frame

  loraNode.inputs.lora_name = MINIMAX_H3_HANDHELD_LORA
  loraNode.inputs.strength_model = MINIMAX_H3_HANDHELD_STRENGTH
  schedulerNode.inputs.scheduler = 'simple'
  schedulerNode.inputs.steps = 20
  schedulerNode.inputs.denoise = 1
  if (samplerNode?.inputs) samplerNode.inputs.sampler_name = 'res_multistep'
  if (noiseNode?.inputs) noiseNode.inputs.noise_seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : 1
  if (videoNode?.inputs) videoNode.inputs.fps = 24
  if (saveNode?.inputs) saveNode.inputs.filename_prefix = options.filenamePrefix || 'video/CANVAS_minimax_h3_handheld'

  return modified
}
