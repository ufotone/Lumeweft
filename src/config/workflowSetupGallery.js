/**
 * Visual metadata for Workflow Setup (gallery cards).
 * Thumbnails are optional; gradients + icons provide a Comfy-like card feel without assets.
 */
import { ALL_WORKFLOWS, getBundledWorkflowPath } from './workflowRegistry'
import { TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID } from './topazVideoUpscaleConfig'
import { MUSIC_VIDEO_SHOT_WORKFLOW_ID, VOCAL_EXTRACT_WORKFLOW_ID } from './musicVideoShotConfig'
import {
  ELEVENLABS_TTS_WORKFLOW_ID,
  IRODORI_TTS_WORKFLOW_ID,
  IRODORI_VOICE_CLONE_WORKFLOW_ID,
} from './shortFilmConfig'
import { UGC_EXACT_LIPSYNC_WORKFLOW_ID } from './generateWorkspaceConfig'

function coverPath(filename) {
  return getBundledWorkflowPath(`setup-covers/${filename}`)
}

const CLOUD_WORKFLOW_IDS = new Set([
  'kling-o3-i2v',
  'grok-video-i2v',
  'vidu-q2-i2v',
  'seedance2-t2v',
  'seedance2-flf2v',
  'seedance2-r2v',
  TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID,
  'nano-banana-2',
  'gpt-image-2-t2i',
  'gpt-image-2-edit',
  'grok-text-to-image',
  'seedream-5-lite-image-edit',
  'google-gemini-flash-lite',
  'sonilo-v2m',
  ELEVENLABS_TTS_WORKFLOW_ID,
])

/** @type {Record<string, { gradient: string, icon: string, thumbnailSrc?: string, extraBadges?: string[] }>} */
const VISUAL_BY_WORKFLOW_ID = {
  'ainvfx-fluid': {
    gradient: 'from-orange-500/30 via-slate-800/40 to-sf-dark-950',
    icon: 'film',
    extraBadges: ['VFX', 'LTX 2.5', 'IC-LoRA', 'CANVAS'],
  },
  'tk-toolkit': {
    gradient: 'from-amber-500/30 via-violet-900/30 to-sf-dark-950',
    icon: 'boxes',
    extraBadges: ['Toolbox', 'Optional', 'MIT'],
  },
  'wan22-i2v': {
    gradient: 'from-violet-500/35 via-indigo-900/30 to-sf-dark-950',
    icon: 'film',
    extraBadges: ['I2V', 'GGUF', 'Q4_K_M', 'Lightning'],
    thumbnailSrc: coverPath('wan22-i2v.webp'),
  },
  'wan22-t2v': {
    gradient: 'from-violet-500/35 via-fuchsia-900/25 to-sf-dark-950',
    icon: 'film',
    extraBadges: ['T2V', 'GGUF', 'Q4_K_M', 'Lightning'],
  },
  'ltx23-i2v': {
    gradient: 'from-sky-500/30 via-blue-900/25 to-sf-dark-950',
    icon: 'film',
    extraBadges: ['I2V'],
    thumbnailSrc: coverPath('ltx23-i2v.webp'),
  },
  'kling-o3-i2v': {
    gradient: 'from-amber-500/25 via-orange-900/20 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['I2V'],
    thumbnailSrc: coverPath('kling-o3-i2v.webp'),
  },
  'grok-video-i2v': {
    gradient: 'from-zinc-400/20 via-neutral-800/40 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['I2V'],
    thumbnailSrc: coverPath('grok-video-i2v.webp'),
  },
  'vidu-q2-i2v': {
    gradient: 'from-cyan-500/25 via-teal-900/20 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['I2V'],
    thumbnailSrc: coverPath('vidu-q2-i2v.webp'),
  },
  [TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID]: {
    gradient: 'from-amber-500/25 via-yellow-900/20 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['Upscale'],
  },
  [MUSIC_VIDEO_SHOT_WORKFLOW_ID]: {
    gradient: 'from-pink-500/25 via-purple-900/25 to-sf-dark-950',
    icon: 'music',
    extraBadges: ['I2V', 'Lip-sync', 'Director Mode'],
  },
  [UGC_EXACT_LIPSYNC_WORKFLOW_ID]: {
    gradient: 'from-rose-500/30 via-fuchsia-900/25 to-sf-dark-950',
    icon: 'film',
    extraBadges: ['I2V', 'Exact audio', 'Lip-sync'],
    thumbnailSrc: coverPath('ltx23-i2v.webp'),
  },
  [IRODORI_TTS_WORKFLOW_ID]: {
    gradient: 'from-fuchsia-500/25 via-rose-900/25 to-sf-dark-950',
    icon: 'audio',
    extraBadges: ['TTS', 'Local'],
  },
  [IRODORI_VOICE_CLONE_WORKFLOW_ID]: {
    gradient: 'from-violet-500/25 via-fuchsia-900/25 to-sf-dark-950',
    icon: 'audio',
    extraBadges: ['Voice Clone', 'Reference audio', 'Local'],
  },
  [VOCAL_EXTRACT_WORKFLOW_ID]: {
    gradient: 'from-teal-500/25 via-cyan-900/25 to-sf-dark-950',
    icon: 'music',
    extraBadges: ['Preprocess', 'Vocal stem'],
  },
  'caption-qwen-asr': {
    gradient: 'from-blue-500/25 via-indigo-900/25 to-sf-dark-950',
    icon: 'music',
    extraBadges: ['ASR', 'SRT', 'Captions'],
  },
  'multi-angles': {
    gradient: 'from-fuchsia-500/25 via-purple-900/25 to-sf-dark-950',
    icon: 'users',
    extraBadges: ['Qwen 2511', 'GGUF', 'Multi-shot'],
    thumbnailSrc: coverPath('multi-angles.webp'),
  },
  'multi-angles-scene': {
    gradient: 'from-rose-500/25 via-pink-900/20 to-sf-dark-950',
    icon: 'layers',
    extraBadges: ['Qwen 2511', 'GGUF', 'Multi-shot'],
    thumbnailSrc: coverPath('multi-angles-scene.webp'),
  },
  'image-edit': {
    gradient: 'from-emerald-500/25 via-green-900/20 to-sf-dark-950',
    icon: 'image',
    extraBadges: ['Qwen 2509', 'GGUF', 'Lightning'],
    thumbnailSrc: coverPath('image-edit.webp'),
  },
  'image-edit-model-product': {
    gradient: 'from-emerald-500/25 via-green-900/20 to-sf-dark-950',
    icon: 'image',
    extraBadges: ['Qwen 2509', 'GGUF', 'Lightning', 'Model+Product'],
    thumbnailSrc: coverPath('image-edit.webp'),
  },
  'z-image-turbo': {
    gradient: 'from-lime-500/20 via-emerald-900/25 to-sf-dark-950',
    icon: 'sparkles',
    extraBadges: ['T2I', 'GGUF', 'Q4_K_M'],
    thumbnailSrc: coverPath('z-image-turbo.webp'),
  },
  'nano-banana-2': {
    gradient: 'from-yellow-500/20 via-amber-900/25 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['Image edit', 'Reference', 'Keyframes'],
    thumbnailSrc: coverPath('nano-banana-2.webp'),
  },
  'grok-text-to-image': {
    gradient: 'from-stone-400/15 via-neutral-800/35 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['T2I'],
    thumbnailSrc: coverPath('grok-text-to-image.webp'),
  },
  'seedream-5-lite-image-edit': {
    gradient: 'from-orange-500/25 via-red-900/15 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['Edit'],
    thumbnailSrc: coverPath('seedream-5-lite-image-edit.webp'),
  },
  'music-gen': {
    gradient: 'from-indigo-500/30 via-violet-900/30 to-sf-dark-950',
    icon: 'music',
    extraBadges: ['Audio'],
    thumbnailSrc: coverPath('music-gen.webp'),
  },
  'google-gemini-flash-lite': {
    gradient: 'from-sky-500/20 via-cyan-900/20 to-sf-dark-950',
    icon: 'cloud',
    extraBadges: ['Prompt'],
  },
  'qwen-image-2-1-heretic': {
    gradient: 'from-cyan-500/25 via-blue-900/25 to-sf-dark-950',
    icon: 'sparkles',
    extraBadges: ['Qwen 2.1', 'Heretic', 'GGUF', 'RGBA'],
  },
  'qwen-image-2-1-nsfw-lora': {
    gradient: 'from-rose-500/25 via-fuchsia-950/30 to-sf-dark-950',
    icon: 'sparkles',
    extraBadges: ['NSFW', 'Qwen 2.1', 'LoRA', 'Civitai'],
  },
  'haruki-mix-krea2-t2i': {
    gradient: 'from-pink-500/25 via-rose-950/30 to-sf-dark-950',
    icon: 'sparkles',
    extraBadges: ['NSFW', 'Krea 2', 'INT8', 'Civitai'],
  },
  'nsfw-wan-1-3b-e10-t2v': {
    gradient: 'from-rose-500/25 via-red-950/30 to-sf-dark-950',
    icon: 'film',
    extraBadges: ['NSFW', 'Wan 2.1', '1.3B', 'T2V'],
  },
  'qwen-image-2-1-heretic-edit': {
    gradient: 'from-sky-500/25 via-cyan-900/25 to-sf-dark-950',
    icon: 'sparkles',
    extraBadges: ['Edit', 'Qwen 2.1', 'Heretic', 'RGBA'],
  },
  'qwen-image-2-1-character-sheet': {
    gradient: 'from-cyan-500/25 via-indigo-900/25 to-sf-dark-950',
    icon: 'sparkles',
    extraBadges: ['Character Sheet', 'Qwen 2.1', 'Heretic', '3:2'],
  },
  'minimax-h3-media-promptor': {
    gradient: 'from-violet-500/25 via-sky-900/25 to-sf-dark-950',
    icon: 'film',
    extraBadges: ['Image analysis', 'Video analysis', 'Prompt'],
  },
  'mask-gen': {
    gradient: 'from-purple-500/30 via-violet-900/25 to-sf-dark-950',
    icon: 'scanline',
    extraBadges: ['SAM3'],
    thumbnailSrc: coverPath('mask-gen.png'),
    invertColors: true,
  },
}

/**
 * Longer-form copy shown when a card is expanded. Curated per workflow so users
 * get a clear "what does this do / when do I use it" brief.
 */
const LONG_DESCRIPTIONS = {
  'ainvfx-fluid': 'CANVAS → AInVFX Fluid: paint and save first/last keyframes, then turn their shapes into smoke, steam or fire. Uses the LTX 2.5 distilled INT8 model, 8 steps, CFG 1 and 121 frames. Five model files total about 39.4 GB; LTX 2.5 base files require Hugging Face access approval. If automatic download returns 401/403, sign in at each source link and place the downloaded file in its indicated model folder. LTX 2.3 weights cannot substitute. Requires current ComfyUI with LTX 2.5/Gemma 4 support and the official ComfyUI-LTXVideo pack. VRAM requirements have not been verified locally.',
  'tk-toolkit': 'An optional toolbox installed into the user\'s own ComfyUI. It adds visual LoRA management, Civitai metadata and downloads, prompt cards, Danbooru reference search, output browsing, and batch helpers. The integration is installed from the publisher\'s MIT-licensed repository; downloaded models, previews, Danbooru posts, and other remote content keep their own licenses and service terms.',
  'wan22-i2v': 'Runs locally with the WAN 2.2 14B image-to-video High/Low Noise experts in memory-efficient Q4_K_M GGUF form. Give it a still frame and a short prompt to produce an animated clip. The existing 4-step Lightning LoRAs remain enabled; GGUF offloading makes the workflow practical on lower-VRAM machines, though it is still a large download.',
  'wan22-t2v': 'Runs WAN 2.2 14B text-to-video locally with Q4_K_M GGUF High/Low Noise experts and the existing 4-step Lightning LoRAs. Designed for memory-aware local execution with ComfyUI-GGUF offloading.',
  'ltx23-i2v': 'Fast local image-to-video using LTX 2.3. Good for quick iterations and lighter GPUs. Lower fidelity than WAN 2.2 but much faster to generate, and it keeps everything on your machine.',
  [UGC_EXACT_LIPSYNC_WORKFLOW_ID]: 'Recommended local dialogue route for illustrated and live-action characters. LTX 2.3 conditions motion on the finished Irodori-TTS or ElevenLabs clip, freezes that audio during sampling, and keeps the original waveform in the final output. No separate LatentSync extension is required.',
  'kling-o3-i2v': 'Cloud image-to-video using the Kling 3.0 Omni model via the Comfy Partner API. Premium quality motion and coherence, especially for people and characters. Requires a Comfy Partner API key and credits.',
  'grok-video-i2v': 'Cloud image-to-video powered by xAI Grok Imagine Video (Beta). Strong at stylised and cinematic shots. Requires a Grok / Comfy Partner API key.',
  'vidu-q2-i2v': 'Cloud image-to-video with Vidu Q2 Pro Fast. Tuned for quick turnaround and consistent character motion. Requires a Comfy Partner API key.',
  [TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID]: 'Cloud video upscaling with Topaz Video Enhance. Feed it an existing video clip and upscale it with Starlight Precise 2.5 or the Astra variants. Requires a Comfy Partner API key.',
  [MUSIC_VIDEO_SHOT_WORKFLOW_ID]: 'Per-shot music video generator built on LTX 2.3 22B. Takes a reference still and an audio segment and produces a lip-synced shot. Used by Director Mode to render an entire music video one shot at a time. Heavy local workflow — needs a 24GB+ GPU and the LTX 2.3 model stack.',
  [VOCAL_EXTRACT_WORKFLOW_ID]: 'One-time preprocessing workflow that isolates vocals from a mixed song using Mel-Band RoFormer. Runs once when you import a song into a music-video project, so every shot afterward can be conditioned on clean vocals without re-running separation each time.',
  'caption-qwen-asr': 'Local caption and timed-lyrics transcription using Qwen ASR through TTS-Audio-Suite. Used by the timeline caption tool and by Music Video\'s "Transcribe to SRT" button to generate timestamped lyrics before building the director script.',
  'multi-angles': 'Qwen Image Edit 2511 character turnaround using the 2511 Multiple Angles LoRA and a memory-efficient GGUF model. Give it one character image and it generates 8 controlled camera views for shot sheets or look-dev reference sets.',
  'multi-angles-scene': 'Qwen Image Edit 2511 scene turnaround using the 2511 Multiple Angles LoRA and a memory-efficient GGUF model. Produces 8 controlled views of one environment for coverage, storyboards, or establishing shots.',
  'image-edit': 'Local image editing with Qwen Image Edit 2509 in memory-efficient Q4_K_M GGUF form, accelerated by the 4-step Lightning LoRA. Paint a mask (or describe the change) and apply targeted text-prompted edits while keeping the rest intact.',
  'qwen-image-2-1-heretic': 'CANVAS text-to-image generation using the requested Qwen3-VL 8B Heretic Q4_K_M text encoder, the official Qwen Image 2.1 INT8 ConvRot diffusion model, and the official RGBA-capable VAE. The output note includes a persistent transparent-PNG switch. Requires ComfyUI 0.36.0+, ComfyUI-GGUF, and the temporary Qwen3-VL GGUF text-encoder patch.',
  'qwen-image-2-1-nsfw-lora': 'CANVAS adult text-to-image generation using Civitai model version 3351951 at strength 1.0. It reuses the installed Qwen Image 2.1 INT8 ConvRot model, Heretic Q4_K_M encoder/mmproj, and Qwen 2.1 VAE. Published examples use er_sde + beta, CFG 1, and 20–25 steps. Install the LoRA itself through Generate > Community so Civitai authentication and the external-model consent gate remain in effect.',
  'haruki-mix-krea2-t2i': 'CANVAS adult text-to-image generation using HARUKI_MIX KR2 V2.0 INT8 ConvRot, exact Civitai version 3188234. It reuses the official Krea 2 Qwen3-VL 4B FP8 text encoder and Qwen image VAE already used by Dark Beast. Published guidance is Euler with simple, beta, or bong_tangent scheduling, 8 steps, and CFG 1. Install the checkpoint through Generate > Community; redistribution, merging, derivative checkpoint sharing, and paid generation-service use are prohibited by the author.',
  'nsfw-wan-1-3b-e10-t2v': 'CANVAS adult text-to-video generation with the exact requested wan_1.3B_e10.safetensors full checkpoint. It uses the ComfyUI core Wan 2.1 T2V graph with UMT5, the Wan 2.1 VAE, sampling shift 8, 30 steps, CFG 6, uni_pc/simple, 832x480, and 16 fps. The publisher now labels e10 as a legacy image-trained checkpoint with limited native motion and known quality degradation after epoch 3, and recommends exp_e14 for general use; this preset intentionally remains pinned to e10.',
  'qwen-image-2-1-heretic-edit': 'CANVAS image editing with the exact same Qwen Image 2.1 INT8 ConvRot model, Heretic Q4_K_M text encoder, matching mmproj vision tower, and RGBA VAE as the generation flow. image_1 is encoded by TextEncodeQwenImage21 so its canvas and aspect ratio drive the edit. The output note includes the same persistent transparent-PNG switch, and Workflow Setup reuses the already pinned downloads.',
  'qwen-image-2-1-character-sheet': 'Dedicated CANVAS character-sheet generation inspired by NeuroContent\'s public Qwen Image 2.1 workflow. It takes one identity image and creates a 3:2 design board with hero, turnaround, pose, expression, silhouette, and detail studies. This adaptation reuses the existing Heretic Q4_K_M encoder/mmproj stack and follows the published res_2m + beta, 25-step, CFG 1 baseline without adding a second text encoder or the source PE custom-node stack.',
  'image-edit-model-product': 'Specialised Qwen Image Edit 2509 GGUF graph with 4-step Lightning acceleration for putting a product onto a model, or swapping a model/product while keeping the other element anchored.',
  'z-image-turbo': 'Local text-to-image using Q4_K_M GGUF versions of Z Image Turbo and its Qwen 3 4B encoder. It keeps the fast preset behaviour while reducing model memory pressure, making it a good default for quick ideation and reference frames.',
  'nano-banana-2': 'Cloud image generation and reference editing using Google Nano Banana 2 via the Comfy Partner API. Music Video uses it for cloud keyframes when you want stronger reference-image and identity consistency. Requires an API key and credits.',
  'grok-text-to-image': 'Cloud text-to-image using xAI Grok Imagine (Beta). Strong stylistic range and text rendering. Requires a Grok / Comfy Partner API key.',
  'seedream-5-lite-image-edit': 'Cloud image edit using ByteDance Seedream 5.0 Lite. Lower cost per generation and a good fit for batch edits. Requires a Comfy Partner API key.',
  'music-gen': 'Local music generation with ACE-Step. Feed it a short tag list and optional lyrics and it produces a short musical clip you can drop straight into a timeline.',
  'google-gemini-flash-lite': 'Cloud prompt helper using Gemini 3.1 Flash Lite. Feed it a rough brief and optional image reference and it returns a cleaner, more descriptive prompt you can pass downstream into image or video generation. Requires a Comfy Partner API key.',
  'minimax-h3-media-promptor': 'Runs through the local ComfyUI custom node and analyzes a project image or full video before writing a structured MiniMax H3 prompt. The node can use a cloud vision API or local Ollama provider configured in ComfyUI. Video input is sampled across time instead of being reduced to one still frame.',
  'mask-gen': 'Text-prompted video/image masking using SAM 3 plus MatAnyone. Describe the subject you want isolated and it produces an alpha mask you can use for rotoscoping, replacement, or compositing.',
}

export const WORKFLOW_SETUP_STARTER_KITS = Object.freeze([
  Object.freeze({
    id: 'local-workflows',
    label: 'Local Workflows',
    tagline: 'Workflows that run on the user\'s own ComfyUI install and local hardware.',
    description: 'Show only local ComfyUI workflows and their local model/custom-node setup.',
    workflowIds: Object.freeze(ALL_WORKFLOWS.filter((workflow) => !CLOUD_WORKFLOW_IDS.has(workflow.id)).map((workflow) => workflow.id)),
  }),
  Object.freeze({
    id: 'cloud-workflows',
    label: 'Cloud Workflows',
    tagline: 'Workflows that use partner/API nodes and credits instead of local model downloads.',
    description: 'Show only cloud workflows that need partner/API nodes, keys, or credits.',
    workflowIds: Object.freeze(ALL_WORKFLOWS.filter((workflow) => CLOUD_WORKFLOW_IDS.has(workflow.id)).map((workflow) => workflow.id)),
  }),
  Object.freeze({
    id: 'music-video-kit',
    label: 'Music Video Kit',
    tagline: 'Timed lyrics, vocal prep, and LTX audio-conditioned shot generation.',
    description: 'The fastest setup path for Director Mode music videos and lip-sync-oriented shot passes.',
    workflowIds: Object.freeze(['nano-banana-2', 'image-edit', 'caption-qwen-asr', VOCAL_EXTRACT_WORKFLOW_ID, MUSIC_VIDEO_SHOT_WORKFLOW_ID]),
  }),
])

function categoryBaseBadge(category) {
  switch (category) {
    case 'video':
      return 'Video'
    case 'image':
      return 'Image'
    case 'audio':
      return 'Audio'
    case 'text':
      return 'Text'
    default:
      return 'Workflow'
  }
}

export function findWorkflowRegistryEntry(workflowId = '') {
  const id = String(workflowId || '').trim()
  return ALL_WORKFLOWS.find((w) => w.id === id) || null
}

/**
 * @returns {{
 *   workflowId: string,
 *   label: string,
 *   description: string,
 *   longDescription: string,
 *   category: string,
 *   gradient: string,
 *   icon: string,
 *   thumbnailSrc: string,
 *   invertColors: boolean,
 *   badges: string[],
 *   runtime: 'local' | 'cloud'
 * }}
 */
export function getWorkflowSetupGalleryMeta(workflowId = '') {
  const id = String(workflowId || '').trim()
  const registry = findWorkflowRegistryEntry(id)
  const visual = VISUAL_BY_WORKFLOW_ID[id] || {
    gradient: 'from-slate-600/35 to-sf-dark-950',
    icon: 'boxes',
    extraBadges: [],
  }

  const runtime = CLOUD_WORKFLOW_IDS.has(id) ? 'cloud' : 'local'
  const category = registry?.category || 'image'
  const badges = [
    categoryBaseBadge(category),
    runtime === 'cloud' ? 'API' : 'Local',
    ...(Array.isArray(visual.extraBadges) ? visual.extraBadges : []),
  ]

  return {
    workflowId: id,
    label: registry?.label || id,
    description: registry?.description || '',
    longDescription: LONG_DESCRIPTIONS[id] || registry?.description || '',
    category,
    gradient: visual.gradient,
    icon: visual.icon,
    thumbnailSrc: typeof visual.thumbnailSrc === 'string' ? visual.thumbnailSrc : '',
    invertColors: Boolean(visual.invertColors),
    badges,
    runtime,
  }
}
