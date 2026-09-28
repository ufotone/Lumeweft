export const MINIMAX_H3_360_ORBIT_PROMPT = 'One frozen instant. Only the camera moves. In a continuous 360 orbit. Preserve every person and object in exactly the same world position, orientation, shape and pose throughout the shot. Airborne objects remain suspended at the captured height and angle: no wobbling, shaking, spinning, drifting, falling or continued action. Keep faces, hands, clothing, liquids and the background motionless while retaining their natural appearance. Camera parallax is the only source of apparent movement. No cuts, zoom, morphing or added objects.'

export const MINIMAX_H3_360_ORBIT_SETTINGS = Object.freeze({
  width: 768,
  height: 768,
  frames: 73,
  fps: 24,
  steps: 28,
  loraStrength: 1,
})

export function modifyMinimaxH3360OrbitWorkflow(workflow, options = {}) {
  const inputImage = String(options.inputImage || '').trim()
  if (!inputImage) {
    throw new Error('360 Orbit: 1枚の開始画像を接続してください。 / Connect one source image.')
  }

  const modified = JSON.parse(JSON.stringify(workflow))
  const imageNode = Object.values(modified).find(node => node?.class_type === 'LoadImage')
  const conditioningNode = Object.values(modified).find(node => node?.class_type === 'MiniMaxH3ImageToVideo')
  const loraNode = Object.values(modified).find(node => node?.class_type === 'LoraLoaderModelOnly')
  const schedulerNode = Object.values(modified).find(node => node?.class_type === 'BasicScheduler')
  const samplerNode = Object.values(modified).find(node => node?.class_type === 'KSamplerSelect')
  const noiseNode = Object.values(modified).find(node => node?.class_type === 'RandomNoise')
  const videoNode = Object.values(modified).find(node => node?.class_type === 'CreateVideo')
  const saveNode = Object.values(modified).find(node => node?.class_type === 'SaveVideo')

  if (!imageNode?.inputs || !conditioningNode?.inputs || !loraNode?.inputs || !schedulerNode?.inputs) {
    throw new Error('360 Orbit workflow is missing one or more required nodes.')
  }

  imageNode.inputs.image = inputImage
  conditioningNode.inputs.prompt = String(options.prompt || '').trim() || MINIMAX_H3_360_ORBIT_PROMPT
  conditioningNode.inputs.width = MINIMAX_H3_360_ORBIT_SETTINGS.width
  conditioningNode.inputs.height = MINIMAX_H3_360_ORBIT_SETTINGS.height
  conditioningNode.inputs.length = MINIMAX_H3_360_ORBIT_SETTINGS.frames
  conditioningNode.inputs.first_frame = [String(Object.keys(modified).find(key => modified[key] === imageNode)), 0]
  conditioningNode.inputs.last_frame = [...conditioningNode.inputs.first_frame]

  loraNode.inputs.lora_name = 'minimax_h3_flf2v_lora_v1.safetensors'
  loraNode.inputs.strength_model = MINIMAX_H3_360_ORBIT_SETTINGS.loraStrength
  schedulerNode.inputs.scheduler = 'simple'
  schedulerNode.inputs.steps = MINIMAX_H3_360_ORBIT_SETTINGS.steps
  schedulerNode.inputs.denoise = 1
  if (samplerNode?.inputs) samplerNode.inputs.sampler_name = 'res_multistep'
  if (noiseNode?.inputs) noiseNode.inputs.noise_seed = Number.isFinite(Number(options.seed)) ? Number(options.seed) : 1
  if (videoNode?.inputs) {
    videoNode.inputs.fps = MINIMAX_H3_360_ORBIT_SETTINGS.fps
    delete videoNode.inputs.audio
  }
  if (saveNode?.inputs) saveNode.inputs.filename_prefix = options.filenamePrefix || 'video/CANVAS_minimax_h3_360_orbit'

  return modified
}
