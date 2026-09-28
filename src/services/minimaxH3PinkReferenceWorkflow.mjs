const BASE_MODEL_NODE = '17'
const SAGE_NODE = '18'
const SIGMA_SHIFT_NODE = '19'

const LEGACY_REFERENCE_PROMPT_MARKERS = [
  'Describe the intended adult scene, coherent action, and synchronized sound.',
  'Describe the desired adult scene, action, and synchronized sound.',
  'Describe any changes to the subject, setting, or style here.',
]

function buildReferencePrompt(prompt, referenceCount) {
  const enteredPrompt = String(prompt || '').trim()
  const isLegacyInstruction = LEGACY_REFERENCE_PROMPT_MARKERS.some(marker => enteredPrompt.includes(marker))
  let result = enteredPrompt

  // Older CANVAS presets stored editing instructions as if they were a real
  // generation prompt. Ref2VA then had no requested change and naturally
  // reconstructed the reference video, including its original subject.
  if (!result || isLegacyInstruction) {
    result = referenceCount > 0
      ? 'Replace the primary subject in <Video 1> with the subject from <Picture 1>. Preserve <Picture 1>\'s face, hair, body, clothing, and visual identity consistently in every frame. Use <Video 1> only for motion, pose, timing, interaction, and camera movement; do not copy the original subject\'s appearance. Render a coherent scene with stable anatomy and synchronized native audio.'
      : 'Create a newly rendered version of <Video 1>. Use <Video 1> for motion, pose, timing, interaction, and camera movement while changing the subject appearance, setting, and lighting according to this prompt. Keep motion coherent and generate synchronized native audio.'
  }

  if (!result.includes('<Video 1>')) {
    result = `Use <Video 1> only as the motion, pose, timing, interaction, and camera reference. ${result}`
  }

  const pictureTags = Array.from({ length: referenceCount }, (_, index) => `<Picture ${index + 1}>`)
  if (pictureTags.length === 0) {
    result = result.split(/(?<=[.!?])\s+/).filter(sentence => !/<Picture \d+>/.test(sentence)).join(' ').trim()
  } else {
    const missingTags = pictureTags.filter(tag => !result.includes(tag))
    if (missingTags.length > 0) {
      result = `Also use ${missingTags.join(', ')} as identity or appearance references. ${result}`
    }
  }
  return result
}

/** Configure the PinkFluffyBunny FL2VA Reference Video preset. */
export function modifyMinimaxH3PinkReferenceWorkflow(workflow, options = {}) {
  const {
    prompt = '', referenceVideo = '', referenceImages = [],
    referenceStart = 0, referenceDuration = 5, useReferenceAudio = false,
    useSageAttention = true,
    allowImageOnly = false,
    minimumReferenceImages = 0,
    maximumReferenceImages = 8,
    minimumDuration = 5,
    maximumDuration = 15,
    width = 608, height = 352, duration = 5, seed = 0,
    filenamePrefix = 'video/CANVAS_minimax_h3_pink_reference',
  } = options
  if (!referenceVideo && !allowImageOnly) throw new Error('参照動画を選択してください。 / A reference video is required.')
  const refs = Array.isArray(referenceImages) ? referenceImages.filter(Boolean) : []
  const minRefs = Math.max(0, Math.floor(Number(minimumReferenceImages) || 0))
  const maxRefs = Math.max(minRefs, Math.min(8, Math.floor(Number(maximumReferenceImages) || 8)))
  if (refs.length < minRefs || refs.length > maxRefs) {
    if (minRefs === 1 && maxRefs === 1) {
      throw new Error('差し替えるキャラクター画像を1枚接続してください。 / Connect exactly one replacement-character image.')
    }
    throw new Error(`参照画像は${minRefs}〜${maxRefs}枚必要です。 / This flow requires ${minRefs}-${maxRefs} reference images.`)
  }
  if (allowImageOnly && refs.length < 2) {
    throw new Error('シーン画像とキャラクターシートの2枚を接続してください。 / Connect both the scene image and character sheet.')
  }
  if (allowImageOnly && refs.length > 3) {
    throw new Error('このフローの参照画像は3枚までです。 / This flow accepts at most three reference images.')
  }

  const modified = JSON.parse(JSON.stringify(workflow))
  if (useSageAttention) {
    modified[SAGE_NODE] = {
      class_type: 'PathchSageAttentionKJ',
      inputs: { model: [BASE_MODEL_NODE, 0], sage_attention: 'auto', allow_compile: false },
      _meta: { title: 'SageAttention Speed Boost' },
    }
  } else {
    delete modified[SAGE_NODE]
  }
  modified[SIGMA_SHIFT_NODE].inputs.model = [useSageAttention ? SAGE_NODE : BASE_MODEL_NODE, 0]

  const conditioning = modified['6'].inputs
  const referenceNodePrefix = String(modified[BASE_MODEL_NODE]?.inputs?.lora_name || '').includes('AfterMidnight')
    ? 'aftermidnight_h3_ref'
    : 'pink_h3_ref'
  const normalizeSize = (value, fallback) => Math.max(32, Math.min(4096, Math.round((Number(value) || fallback) / 32) * 32))
  conditioning.width = normalizeSize(width, 608)
  conditioning.height = normalizeSize(height, 352)
  const minSeconds = Math.max(1, Number(minimumDuration) || 5)
  const maxSeconds = Math.max(minSeconds, Number(maximumDuration) || 15)
  const clampDuration = (value, fallback) => {
    const clamped = Math.max(minSeconds, Math.min(maxSeconds, Number(value) || fallback))
    return minSeconds === 4 && maxSeconds === 5 ? Math.round(clamped) : clamped
  }
  const normalizedDuration = clampDuration(duration, minSeconds)
  const frames = Math.round(normalizedDuration * 24)
  conditioning.length = frames + ((5 - frames % 17) + 17) % 17
  conditioning.prompt = allowImageOnly ? String(prompt || '').trim() : buildReferencePrompt(prompt, refs.length)
  // Identity fidelity is the purpose of this preset. The core node keeps the
  // source image at its higher reference resolution when max is selected.
  conditioning.ref_image_size = refs.length > 0 ? 'max' : 'match'
  if (referenceVideo) {
    Object.assign(modified['1'].inputs, {
      video: referenceVideo,
      force_rate: 24,
      custom_width: conditioning.width,
      custom_height: 0,
      frame_load_cap: Math.round(clampDuration(referenceDuration, normalizedDuration) * 24),
      skip_first_frames: Math.round(Math.max(0, Number(referenceStart) || 0) * 24),
      select_every_nth: 1,
      format: 'None',
    })
    conditioning['ref_videos.ref_video_0'] = ['1', 0]
    if (useReferenceAudio) conditioning['ref_video_audios.ref_video_audio_0'] = ['1', 2]
    else delete conditioning['ref_video_audios.ref_video_audio_0']
  } else {
    delete modified['1']
    delete conditioning['ref_videos.ref_video_0']
    delete conditioning['ref_video_audios.ref_video_audio_0']
  }

  for (let index = 0; index < 8; index += 1) {
    const nodeId = `${referenceNodePrefix}_${index}`
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
