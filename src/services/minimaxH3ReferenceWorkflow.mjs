/** Configure local Ref2VA. Reference frames must retain their 24 fps time base. */
export function modifyMinimaxH3GGUFReferenceWorkflow(workflow, options = {}) {
  const {
    prompt = '', referenceVideo = '', referenceImages = [],
    referenceStart = 0, referenceDuration = 5, useReferenceAudio = false,
    useSageAttention = true,
    width = 608, height = 352, duration = 5, seed = 0,
    filenamePrefix = 'video/CANVAS_minimax_h3_reference',
  } = options
  if (!referenceVideo) throw new Error('参照動画を選択してください。 / A reference video is required.')
  const refs = Array.isArray(referenceImages) ? referenceImages.filter(Boolean) : []
  if (refs.length > 8) throw new Error('参照画像は8枚までです。 / At most eight reference images are supported.')
  const modified = JSON.parse(JSON.stringify(workflow))
  // This is the only existing H3 flow that receives Kijai's PDD acceleration.
  // Keep the exact Ref2VA-pruned pairing and trained recipe: Euler, simple,
  // eight steps, strength 1.0, and video/audio sigma shifts 12/3. Other H3
  // flows use fused/distilled or creative LoRAs and deliberately stay separate.
  const pddNode = modified['17']
  const sigmaShiftNode = modified['18']
  if (pddNode?.class_type !== 'LoraLoaderModelOnly'
    || pddNode?.inputs?.lora_name !== 'MiniMax-H3-Ref2VA-Acc-8Step_pruned_comfy.safetensors'
    || sigmaShiftNode?.class_type !== 'MiniMaxH3SigmaShift') {
    throw new Error('MiniMax H3 Ref2VA PDD acceleration graph is incomplete. Reinstall the bundled workflow.')
  }
  Object.assign(pddNode.inputs, { model: ['2', 0], strength_model: 1 })

  // Match the active attention acceleration in TheAiBlueprint's source graph.
  // SolAttn/EasyCache were bypassed there and must not be stacked with PDD.
  if (useSageAttention) {
    modified['16'] = {
      class_type: 'PathchSageAttentionKJ',
      inputs: { model: ['17', 0], sage_attention: 'auto', allow_compile: false },
      _meta: { title: 'SageAttention Speed Boost' },
    }
  } else {
    delete modified['16']
  }
  Object.assign(sigmaShiftNode.inputs, {
    model: [useSageAttention ? '16' : '17', 0],
    video_shift: 12,
    audio_shift: 3,
  })
  const samplerModel = ['18', 0]
  modified['8'].inputs.model = [...samplerModel]
  modified['10'].inputs.model = [...samplerModel]
  Object.assign(modified['9'].inputs, { sampler_name: 'euler' })
  Object.assign(modified['10'].inputs, { scheduler: 'simple', steps: 8, denoise: 1 })
  const conditioning = modified['6'].inputs
  const normalizeSize = (value, fallback) => Math.max(32, Math.min(4096, Math.round((Number(value) || fallback) / 32) * 32))
  conditioning.width = normalizeSize(width, 608)
  conditioning.height = normalizeSize(height, 352)
  const frames = Math.round(Math.max(5, Math.min(15, Number(duration) || 5)) * 24)
  conditioning.length = frames + ((5 - frames % 17) + 17) % 17
  conditioning.prompt = String(prompt || '')
  Object.assign(modified['1'].inputs, {
    video: referenceVideo,
    force_rate: 24,
    // A single dimension preserves the source aspect ratio without cropping.
    custom_width: conditioning.width,
    custom_height: 0,
    frame_load_cap: Math.round(Math.max(2, Math.min(15, Number(referenceDuration) || 5)) * 24),
    skip_first_frames: Math.round(Math.max(0, Number(referenceStart) || 0) * 24),
    select_every_nth: 1,
    format: 'None',
  })
  conditioning['ref_videos.ref_video_0'] = ['1', 0]
  if (useReferenceAudio) conditioning['ref_video_audios.ref_video_audio_0'] = ['1', 2]
  else delete conditioning['ref_video_audios.ref_video_audio_0']
  for (let index = 0; index < 8; index += 1) {
    const nodeId = `h3_ref_${index}`
    const inputKey = `ref_images.ref_image_${index}`
    delete modified[nodeId]
    delete conditioning[inputKey]
    if (refs[index]) {
      modified[nodeId] = {
        class_type: 'LoadImage',
        inputs: { image: refs[index] },
        _meta: { title: `Reference <Picture ${index + 1}>` },
      }
      conditioning[inputKey] = [nodeId, 0]
    }
  }
  modified['7'].inputs.noise_seed = seed
  modified['14'].inputs.fps = 24
  modified['15'].inputs.filename_prefix = filenamePrefix
  return modified
}
