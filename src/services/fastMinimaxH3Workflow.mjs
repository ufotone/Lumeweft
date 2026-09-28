// Published schedules from aziib's Fast MiniMax H3 workflow (Civitai 2906467).
export const FAST_H3_SIGMAS = Object.freeze({
  4: '0.9999166, 0.9728326, 0.9230769, 0.8, 0.0',
  6: '0.9999166, 0.9868421, 0.9638554, 0.9230769, 0.8695652, 0.8, 0.0',
  8: '1.0, 0.9882352941, 0.9729729730, 0.9523809524, 0.9230769231, 0.8780487805, 0.8, 0.6315789474, 0.0',
})

export function modifyFastMinimaxH3Workflow(workflow, options = {}) {
  const {prompt = '', referenceImages = [], referenceAudio = [], width = 864, height = 480,
    duration = 5, steps = 4, seed = 0, filenamePrefix = 'video/CANVAS_fast_minimax_h3'} = options
  const images = referenceImages.filter(Boolean)
  const audios = referenceAudio.filter(Boolean)
  if (images.length > 2 || audios.length > 2) {
    throw new Error('参照画像・音声はそれぞれ2つまでです。 / Fast H3 accepts up to two images and two audio references.')
  }
  const modified = JSON.parse(JSON.stringify(workflow))
  const conditioning = modified['6'].inputs
  const size = (value, fallback) => Math.max(32, Math.min(4096, Math.round((Number(value) || fallback) / 32) * 32))
  const frames = Math.round(Math.max(5, Math.min(15, Number(duration) || 5)) * 24)
  Object.assign(conditioning, {
    prompt: String(prompt || ''), width: size(width, 864), height: size(height, 480),
    length: frames + ((5 - frames % 17) + 17) % 17,
  })
  for (const [kind, filenames, type, input, prefix] of [
    ['image', images, 'LoadImage', 'image', 'ref_images.ref_image_'],
    ['audio', audios, 'LoadAudio', 'audio', 'ref_audios.ref_audio_'],
  ]) {
    for (let index = 0; index < 2; index++) {
      const id = `fast_ref_${kind}_${index}`
      delete modified[id]
      delete conditioning[`${prefix}${index}`]
      if (filenames[index]) {
        modified[id] = {class_type: type, inputs: {[input]: filenames[index]}, _meta: {title: `Reference ${kind} ${index + 1}`}}
        conditioning[`${prefix}${index}`] = [id, 0]
      }
    }
  }
  modified['10'].inputs.sigmas = FAST_H3_SIGMAS[steps] || FAST_H3_SIGMAS[4]
  // Keep the source's Euler + fused Turbo/Mystic model. The Reddit er_sde/beta
  // example uses different Kijai experimental weights and is not this recipe.
  modified['2'].inputs.sage_attention = 'auto'
  modified['7'].inputs.noise_seed = seed
  modified['14'].inputs.fps = 24
  modified['15'].inputs.filename_prefix = filenamePrefix
  return modified
}
