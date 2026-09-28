/** AInVFX's distilled, two-painted-keyframe recipe. Keep the black frames intact. */
export const AINVFX_FLUID_FRAMES = 121
export const AINVFX_FLUID_FPS = Object.freeze([24, 25, 50])

export function validateAinvfxFluidSettings({ width = 512, height = 512, fps = 25 } = {}) {
  const values = { width: Number(width), height: Number(height), fps: Number(fps) }
  for (const key of ['width', 'height']) {
    if (!Number.isInteger(values[key]) || values[key] < 64 || values[key] > 2048 || values[key] % 64 !== 0) {
      throw new Error('VFX: 幅・高さは64〜2048の64の倍数にしてください。 / Width and height must be multiples of 64 between 64 and 2048.')
    }
  }
  if (!AINVFX_FLUID_FPS.includes(values.fps)) throw new Error('VFX: FPSは24・25・50から選んでください。 / Choose 24, 25 or 50 fps.')
  return { ...values, frames: AINVFX_FLUID_FRAMES, duration: AINVFX_FLUID_FRAMES / values.fps }
}

export function modifyAinvfxFluidWorkflow(workflow, options = {}) {
  const { firstFrame, lastFrame, prompt = 'smoke plume', negativePrompt, seed = 42, strength = 1,
    filenamePrefix = 'video/CANVAS_ainvfx_fluid' } = options
  if (!firstFrame || !lastFrame) throw new Error('VFX: 最初と最後の描画画像を接続してください。 / Connect both painted keyframes.')
  const settings = validateAinvfxFluidSettings(options)
  const weight = Number(strength)
  if (!Number.isFinite(weight) || weight < 0 || weight > 2) throw new Error('VFX: LoRA強度は0〜2にしてください。 / LoRA strength must be between 0 and 2.')
  if (!Number.isSafeInteger(Number(seed)) || Number(seed) < 0) throw new Error('VFX: シードは0以上の整数にしてください。 / Seed must be a non-negative safe integer.')
  const result = structuredClone(workflow)
  result.first.inputs.image = firstFrame
  result.last.inputs.image = lastFrame
  for (const id of ['first_size', 'last_size', 'black', 'latent']) {
    Object.assign(result[id].inputs, { width: settings.width, height: settings.height })
  }
  result.black.inputs.batch_size = settings.frames - 2
  result.latent.inputs.length = settings.frames
  result.silence.inputs.duration = settings.duration
  result.conditioning.inputs.frame_rate = settings.fps
  result.video.inputs.fps = settings.fps
  const text = String(prompt || '').trim() || 'smoke plume'
  result.positive.inputs.text = /\bainvfxfluid\b/i.test(text) ? text : `ainvfxfluid, ${text}`
  if (String(negativePrompt || '').trim()) result.negative.inputs.text = String(negativePrompt).trim()
  result.noise.inputs.noise_seed = Number(seed)
  result.lora.inputs.strength_model = weight
  result.save.inputs.filename_prefix = filenamePrefix
  return result
}
