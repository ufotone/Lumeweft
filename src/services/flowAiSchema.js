import { WORKFLOWS, getWorkflowDisplayLabel, getWorkflowHardwareInfo } from '../config/generateWorkspaceConfig'
import {
  TOPAZ_VIDEO_UPSCALE_DEFAULTS,
  TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID,
} from '../config/topazVideoUpscaleConfig'
import { normalizeCreditsEstimate } from '../utils/comfyCredits'
import { ORTENZYA_WORKFLOW_ID, ORTENZYA_SCENARIO_INSTRUCTIONS, ORTENZYA_PROMPT_INSTRUCTIONS } from './ortenzyaCanvas.mjs'

export const FLOW_AI_VERSION = 1
export const FLOW_AI_ASSET_ROOT_FOLDER = 'CANVAS'
export const FLOW_AI_IMAGE_VARIANT_LIMIT = 10
const FLOW_AI_AUTO_OUTPUT_FOLDERS = Object.freeze({
  image: ['CANVAS Images'],
  video: ['CANVAS Videos'],
  audio: ['CANVAS Audio'],
})

export const FLOW_AI_NODE_TYPES = Object.freeze({
  prompt: 'prompt',
  promptAssist: 'prompt-assist',
  h3Optimizer: 'h3-prompt-optimizer',
  textViewer: 'text-viewer',
  textInput: 'text-input',
  textOutput: 'text-output',
  imageInput: 'image-input',
  styleReference: 'style-reference',
  characterInput: 'character-input',
  characterBuilder: 'character-builder',
  imageGen: 'image-gen',
  videoGen: 'video-gen',
  videoUpscale: 'video-upscale',
  musicGen: 'music-gen',
  workflowControl: 'workflow-control',
  output: 'output',
})

const DEFAULT_VIEWPORT = Object.freeze({ x: 0, y: 0, zoom: 0.9 })

const FLOW_IMAGE_WORKFLOWS = Object.freeze(
  [
    ...(WORKFLOWS.image || []),
    { id: 'google-nano-banana-lite', label: 'Google Nano Banana 2 Lite', needsImage: false, description: 'Official Gemini API image generation and optional reference-image editing (paid API)' },
    { id: 'qwen-image-2-1-heretic', label: 'Qwen Image 2.1 Heretic GGUF', needsImage: false, description: 'Local Qwen Image 2.1 generation with the Heretic Q4_K_M text encoder and optional native RGBA transparency' },
    { id: 'qwen-image-2-1-nsfw-lora', label: '[NSFW] Qwen Image 2.1 LoRA', needsImage: false, description: 'Local adult text-to-image generation with the Civitai Qwen Image 2.1 NSFW LoRA and shared Heretic base stack' },
    { id: 'qwen-image-2-1-heretic-edit', label: 'Qwen Image 2.1 Heretic Edit', needsImage: true, description: 'Local Qwen Image 2.1 editing with the same Heretic Q4_K_M encoder, mmproj vision tower, and optional native RGBA transparency' },
    { id: 'qwen-image-2-1-character-sheet', label: 'QWENキャラクターシート', needsImage: true, description: 'Create a detailed 3:2 character design sheet from one reference image with Qwen Image 2.1' },
    { id: 'haruki-mix-krea2-t2i', label: '[NSFW] HARUKI_MIX Krea 2 T2I', needsImage: false, description: 'Local Krea 2 text-to-image generation with HARUKI_MIX KR2 V2.0 INT8 ConvRot' },
  ].map((workflow) => ({
    id: workflow.id,
    label: workflow.label,
    needsImage: Boolean(workflow.needsImage),
    runtime: getWorkflowHardwareInfo(workflow.id)?.runtime || 'local',
    tierId: getWorkflowHardwareInfo(workflow.id)?.tierId || '',
    description: workflow.description || '',
  }))
)

const FLOW_VIDEO_WORKFLOWS = Object.freeze(
  [
    ...(WORKFLOWS.video || []),
    { id: 'google-veo-3-1-lite', label: 'Google Veo 3.1 Lite', needsImage: false, description: 'Official Gemini API text/image-to-video with native audio (paid API)' },
    { id: 'minimax-h3-naughty-times', label: 'MiniMax H3 NaughtyTimes v3', needsImage: true, description: 'Image to video with pruned rank-64 LoRA and native audio' },
    { id: 'ainvfx-fluid', label: 'AInVFX Fluid (LTX 2.5)', needsImage: true, description: 'Painted first and last frames to smoke, steam or fire' },
    { id: 'vdn-h3-t2va', label: 'VDN-H3 8step', needsImage: false, description: 'Text to video with native audio, hybrid attention and a dedicated 8-step adapter' },
    { id: 'fast-minimax-h3-t2va', label: 'Fast MiniMax H3 T2VA (Anime)', needsImage: false, description: 'Anime-oriented fused INT8 text/reference to video with native audio, 4/6/8 steps and SageAttention' },
    { id: 'minimax-h3-360-orbit', label: 'H3バレットタイム', needsImage: true, description: 'One-image frozen-moment 360-degree camera orbit using the dedicated FL2VA LoRA' },
    { id: 'minimax-h3-handheld', label: 'H3ハンドヘルドカメラ', needsImage: false, description: 'Documentary-style handheld shake for text-to-video or an optional start image' },
    { id: 'minimax-h3-character-swap', label: 'MiniMax H3 Character Swap', needsImage: false, description: 'Beginner character replacement from one 4-5 second source shot and one character image' },
    { id: 'minimax-h3-pink-reference', label: 'MiniMax H3 PinkFluffyBunny Reference Video', needsImage: false, description: 'Ref2VA Q4 base with PinkFluffyBunny, required motion video, high-fidelity optional images, SageAttention and native audio' },
    { id: 'minimax-h3-aftermidnight-r2v', label: 'AfterMidnightR2V', needsImage: false, description: 'Ref2VA Q4 with AfterMidnight sexytime rank-64 v1.2, Euler/beta sampling, references and native audio' },
    { id: 'minimax-h3-aftermidnight-3ref', label: 'MiniMax H3 NSFW — Scene + Character + Props', needsImage: false, description: 'Image-only Ref2VA flow with fixed scene, character-sheet, and optional props/stage references' },
    { id: 'nsfw-wan-1-3b-e10-t2v', label: '[NSFW] Wan 1.3B e10 T2V', needsImage: false, description: 'Local adult text-to-video generation with the requested legacy Wan 2.1 1.3B e10 checkpoint' },
  ].map((workflow) => ({
    id: workflow.id,
    label: workflow.label,
    needsImage: Boolean(workflow.needsImage),
    runtime: getWorkflowHardwareInfo(workflow.id)?.runtime || 'local',
    tierId: getWorkflowHardwareInfo(workflow.id)?.tierId || '',
    description: workflow.description || '',
  }))
)

const FLOW_AUDIO_WORKFLOWS = Object.freeze(
  (WORKFLOWS.audio || []).map((workflow) => ({
    id: workflow.id,
    label: workflow.label,
    needsImage: Boolean(workflow.needsImage),
    runtime: getWorkflowHardwareInfo(workflow.id)?.runtime || 'local',
    tierId: getWorkflowHardwareInfo(workflow.id)?.tierId || '',
    description: workflow.description || '',
  }))
)

const FLOW_VIDEO_UPSCALE_WORKFLOWS = Object.freeze([
  {
    id: TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID,
    label: getWorkflowDisplayLabel(TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID) || 'Topaz Video Upscale',
    needsImage: false,
    acceptsVideo: true,
    runtime: getWorkflowHardwareInfo(TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID)?.runtime || 'cloud',
    tierId: getWorkflowHardwareInfo(TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID)?.tierId || 'cloud',
    description: 'Cloud video upscaling with Topaz Starlight and Astra models.',
  },
])

const FLOW_TEXT_WORKFLOWS = Object.freeze([
  {
    id: 'jp-tag-assistant',
    label: getWorkflowDisplayLabel('jp-tag-assistant') || 'JP Tag Assistant',
    needsImage: false,
    runtime: getWorkflowHardwareInfo('jp-tag-assistant')?.runtime || 'local',
    tierId: getWorkflowHardwareInfo('jp-tag-assistant')?.tierId || 'lite',
    description: 'Search the bundled Japanese/English dictionaries without ComfyUI.',
  },
  {
    id: 'google-gemini-flash-lite',
    label: getWorkflowDisplayLabel('google-gemini-flash-lite') || 'Prompt Helper (Gemini 3.1 Flash Lite)',
    needsImage: false,
    acceptsImage: true,
    runtime: getWorkflowHardwareInfo('google-gemini-flash-lite')?.runtime || 'cloud',
    tierId: getWorkflowHardwareInfo('google-gemini-flash-lite')?.tierId || 'cloud',
    description: 'Rewrite rough ideas into stronger prompts with optional image context.',
  },
  {
    id: 'minimax-h3-media-promptor',
    label: getWorkflowDisplayLabel('minimax-h3-media-promptor') || 'Media to Prompt (MiniMax H3 Promptor)',
    needsImage: false,
    acceptsImage: true,
    acceptsVideo: true,
    runtime: getWorkflowHardwareInfo('minimax-h3-media-promptor')?.runtime || 'local',
    tierId: getWorkflowHardwareInfo('minimax-h3-media-promptor')?.tierId || 'lite',
    description: 'Analyze an image or full video and write a structured MiniMax H3 prompt.',
  },
  { id: ORTENZYA_WORKFLOW_ID, label: 'Ortenzya Wordsmith 31B', needsImage: false, runtime: 'local', description: 'Scenario writing and prompt drafts through a local GGUF server.' },
])

function createNodeId(prefix = 'node') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createEdgeId() {
  return `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function randomSeed() {
  return Math.floor(Math.random() * 1000000)
}

export function getFlowImageWorkflowOptions() {
  return FLOW_IMAGE_WORKFLOWS
}

export function getFlowVideoWorkflowOptions() {
  return FLOW_VIDEO_WORKFLOWS
}

export function getFlowAudioWorkflowOptions() {
  return FLOW_AUDIO_WORKFLOWS
}

export function getFlowVideoUpscaleWorkflowOptions() {
  return FLOW_VIDEO_UPSCALE_WORKFLOWS
}

export function getFlowTextWorkflowOptions() {
  return FLOW_TEXT_WORKFLOWS
}

export const FLOW_PROMPT_LANGUAGE_CODES = Object.freeze(['EN', 'JP', 'CH'])

const FLOW_PROMPT_LANGUAGE_LABELS = Object.freeze({
  EN: 'English',
  JP: 'Japanese',
  CH: 'Chinese',
})

const FLOW_PROMPT_LANGUAGE_GROUPS = Object.freeze({
  japaneseOnly: new Set([
    'irodori-tts',
    'irodori-v4-1-anime',
  ]),
  englishJapanese: new Set([
    'jp-tag-assistant',
  ]),
  englishChinese: new Set([
    'z-image-turbo',
    'longcat-text-to-image',
    'longcat-image-edit',
    'ernie-image-turbo',
    'minimax-h3-character-sheet',
    'minimax-h3-gguf-r2v',
    'minimax-h3-character-actor',
    'minimax-h3-character-swap',
    'minimax-h3-gguf-i2v',
    'minimax-h3-nsfw-pink-bunny',
    'minimax-h3-nsfw-motion-8step',
    'minimax-h3-naughty-times',
    'minimax-h3-pink-reference',
    'minimax-h3-aftermidnight-r2v',
    'minimax-h3-aftermidnight-3ref',
    'vdn-h3-t2va',
    'fast-minimax-h3-t2va',
    'wan22-i2v',
    'wan22-t2v',
    'nsfw-wan-1-3b-e10-t2v',
    'minimax-h3-media-promptor',
  ]),
  multilingual: new Set([
    'google-nano-banana-lite',
    'nano-banana-2',
    'google-gemini-flash-lite',
    'google-veo-3-1-lite',
    'gpt-image-2-t2i',
    'gpt-image-2-edit',
    'grok-text-to-image',
    'grok-video-i2v',
    'seedream-5-lite-image-edit',
    'seedance2-t2v',
    'seedance2-mini-r2v',
    'seedance2-flf2v',
    'seedance2-r2v',
    'kling-o3-i2v',
    'vidu-q2-i2v',
    'image-edit',
    'multi-angles',
    'multi-angles-scene',
    'dark-beast-krea2-i2i',
    'haruki-mix-krea2-t2i',
    'anima-lora-upscale',
    'qwen-image-2-1-heretic',
    'qwen-image-2-1-nsfw-lora',
    'qwen-image-2-1-heretic-edit',
    'qwen-image-2-1-character-sheet',
    ORTENZYA_WORKFLOW_ID,
  ]),
})

export function getFlowPromptLanguages(workflowId = '', nodeType = '') {
  const normalizedWorkflowId = String(workflowId || '').trim()
  if (nodeType === FLOW_AI_NODE_TYPES.h3Optimizer) return [...FLOW_PROMPT_LANGUAGE_CODES]
  if (FLOW_PROMPT_LANGUAGE_GROUPS.japaneseOnly.has(normalizedWorkflowId)) return ['JP']
  if (FLOW_PROMPT_LANGUAGE_GROUPS.englishJapanese.has(normalizedWorkflowId)) return ['EN', 'JP']
  if (FLOW_PROMPT_LANGUAGE_GROUPS.englishChinese.has(normalizedWorkflowId)) return ['EN', 'CH']
  if (FLOW_PROMPT_LANGUAGE_GROUPS.multilingual.has(normalizedWorkflowId)) return [...FLOW_PROMPT_LANGUAGE_CODES]
  return ['EN']
}

export function getFlowPromptLanguageLabel(languageCode = '') {
  return FLOW_PROMPT_LANGUAGE_LABELS[String(languageCode || '').trim()] || String(languageCode || '').trim()
}

export function resolveFlowPromptLanguages(document, promptNodeOrId) {
  const nodes = Array.isArray(document?.nodes) ? document.nodes : []
  const edges = Array.isArray(document?.edges) ? document.edges : []
  const promptNodeId = typeof promptNodeOrId === 'string' ? promptNodeOrId : promptNodeOrId?.id
  if (!promptNodeId) return ['EN']

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const outgoingByNodeId = new Map()
  for (const edge of edges) {
    if (!edge?.source || !edge?.target) continue
    const outgoing = outgoingByNodeId.get(edge.source) || []
    outgoing.push(edge.target)
    outgoingByNodeId.set(edge.source, outgoing)
  }

  const resolved = new Set()
  const visited = new Set([promptNodeId])
  const pending = [...(outgoingByNodeId.get(promptNodeId) || [])]
  while (pending.length > 0) {
    const nodeId = pending.shift()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)
    const node = nodeById.get(nodeId)
    if (!node) continue

    const workflowId = String(node?.data?.workflowId || '').trim()
    const isLanguageTarget = node.type === FLOW_AI_NODE_TYPES.h3Optimizer || Boolean(workflowId)
    if (isLanguageTarget) {
      for (const language of getFlowPromptLanguages(workflowId, node.type)) resolved.add(language)
      continue
    }

    pending.push(...(outgoingByNodeId.get(nodeId) || []))
  }

  const ordered = FLOW_PROMPT_LANGUAGE_CODES.filter((language) => resolved.has(language))
  return ordered.length > 0 ? ordered : ['EN']
}

export function getDefaultWorkflowId(nodeType) {
  switch (nodeType) {
    case FLOW_AI_NODE_TYPES.promptAssist:
      return FLOW_TEXT_WORKFLOWS[0]?.id || 'google-gemini-flash-lite'
    case FLOW_AI_NODE_TYPES.imageGen:
      return FLOW_IMAGE_WORKFLOWS[0]?.id || 'z-image-turbo'
    case FLOW_AI_NODE_TYPES.videoGen:
      return FLOW_VIDEO_WORKFLOWS[0]?.id || 'ltx23-i2v'
    case FLOW_AI_NODE_TYPES.videoUpscale:
      return FLOW_VIDEO_UPSCALE_WORKFLOWS[0]?.id || TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID
    case FLOW_AI_NODE_TYPES.musicGen:
      return FLOW_AUDIO_WORKFLOWS[0]?.id || 'music-gen'
    default:
      return ''
  }
}

const DEFAULT_IMAGE_VARIANT_BEHAVIOR = Object.freeze({
  mode: 'repeat',
  max: FLOW_AI_IMAGE_VARIANT_LIMIT,
})

const FIXED_IMAGE_VARIANT_BEHAVIOR = Object.freeze({
  mode: 'fixed',
  fixedCount: 8,
  max: 1,
})

const SINGLE_IMAGE_VARIANT_BEHAVIOR = Object.freeze({
  mode: 'fixed',
  fixedCount: 1,
  max: 1,
})

const FLOW_IMAGE_VARIANT_BEHAVIORS = Object.freeze({
  'google-nano-banana-lite': SINGLE_IMAGE_VARIANT_BEHAVIOR,
  'minimax-h3-character-sheet': SINGLE_IMAGE_VARIANT_BEHAVIOR,
  'qwen-image-2-1-character-sheet': SINGLE_IMAGE_VARIANT_BEHAVIOR,
  'z-image-turbo': Object.freeze({
    mode: 'native',
    max: FLOW_AI_IMAGE_VARIANT_LIMIT,
  }),
  'grok-text-to-image': Object.freeze({
    mode: 'native',
    max: FLOW_AI_IMAGE_VARIANT_LIMIT,
  }),
  'seedream-5-lite-image-edit': Object.freeze({
    mode: 'native',
    max: FLOW_AI_IMAGE_VARIANT_LIMIT,
  }),
  'multi-angles': FIXED_IMAGE_VARIANT_BEHAVIOR,
  'multi-angles-scene': FIXED_IMAGE_VARIANT_BEHAVIOR,
})

export function getFlowImageVariantBehavior(workflowId = '') {
  return FLOW_IMAGE_VARIANT_BEHAVIORS[String(workflowId || '').trim()] || DEFAULT_IMAGE_VARIANT_BEHAVIOR
}

export function normalizeFlowImageVariantCount(value, workflowId = '') {
  const behavior = getFlowImageVariantBehavior(workflowId)
  if (behavior.mode === 'fixed') return 1
  const numericValue = Math.round(Number(value) || 1)
  const safeMax = Math.max(1, Math.round(Number(behavior.max) || FLOW_AI_IMAGE_VARIANT_LIMIT))
  return Math.max(1, Math.min(safeMax, numericValue))
}

export function getFlowOutputFolderSegments(folderName = '', assetKind = '') {
  const normalized = String(folderName || '').trim()
  if (normalized) {
    return [FLOW_AI_ASSET_ROOT_FOLDER, normalized]
  }
  return FLOW_AI_AUTO_OUTPUT_FOLDERS[String(assetKind || '').trim()] || [FLOW_AI_ASSET_ROOT_FOLDER]
}

export function getFlowOutputDestinationLabel(folderName = '', assetKind = '') {
  return `Assets / ${getFlowOutputFolderSegments(folderName, assetKind).join(' / ')}`
}

export const FLOW_AI_NODE_LIBRARY = Object.freeze([
  {
    type: FLOW_AI_NODE_TYPES.prompt,
    label: 'Prompt',
    category: 'Inputs',
    description: 'Reusable text prompt block for image, video, or music nodes.',
    accentClass: 'text-violet-300',
    supported: true,
    outputs: [{ id: 'out:text', type: 'text', label: 'Text' }],
    inputs: [{ id: 'in:control', type: 'control', label: 'Prompt Settings' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.imageInput,
    label: 'Image Input',
    category: 'Inputs',
    description: 'Pick an image or video asset from the current project.',
    accentClass: 'text-emerald-300',
    supported: true,
    outputs: [
      { id: 'out:image', type: 'image', label: 'Image' },
      { id: 'out:video', type: 'video', label: 'Video' },
      { id: 'out:audio', type: 'audio', label: 'Audio' },
    ],
    inputs: [],
  },
  {
    type: FLOW_AI_NODE_TYPES.styleReference,
    label: 'Style Reference',
    category: 'Inputs',
    description: 'Feed one or more reference images into edit-capable image nodes.',
    accentClass: 'text-fuchsia-300',
    supported: true,
    outputs: [{ id: 'out:image', type: 'image', label: 'Style' }],
    inputs: [],
  },
  {
    type: FLOW_AI_NODE_TYPES.characterInput,
    label: 'Character File',
    category: 'Inputs',
    description: 'Reuse a portable OmniChar-compatible .char actor from this project.',
    accentClass: 'text-lime-300',
    supported: true,
    outputs: [{ id: 'out:character', type: 'character', label: 'Character' }],
    inputs: [],
  },
  {
    type: FLOW_AI_NODE_TYPES.characterBuilder,
    label: 'Create Character File',
    category: 'Backstage',
    description: 'Lock face, body, clothing and a description into a reusable .char actor.',
    accentClass: 'text-lime-300',
    supported: true,
    inputs: [
      { id: 'in:face', type: 'face', label: 'Face', multiple: true },
      { id: 'in:body', type: 'body', label: 'Body', multiple: true },
      { id: 'in:cloth', type: 'cloth', label: 'Clothing', multiple: true },
      { id: 'in:text', type: 'text', label: 'Description' },
    ],
    outputs: [{ id: 'out:character', type: 'character', label: 'Character' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.promptAssist,
    label: 'Prompt Assist',
    category: 'Helpers',
    description: 'Refine a rough brief into a stronger prompt with Gemini.',
    accentClass: 'text-sky-200',
    supported: true,
    inputs: [
      { id: 'in:text', type: 'text', label: 'Brief' },
      { id: 'in:image', type: 'image', label: 'Reference' },
      { id: 'in:video', type: 'video', label: 'Video' },
    ],
    outputs: [{ id: 'out:text', type: 'text', label: 'Prompt' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.textViewer,
    label: 'Text Viewer',
    category: 'Helpers',
    description: 'Inspect text in the graph and pass it downstream unchanged.',
    accentClass: 'text-violet-200',
    supported: true,
    inputs: [{ id: 'in:text', type: 'text', label: 'Text' }],
    outputs: [{ id: 'out:text', type: 'text', label: 'Text' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.h3Optimizer, label: 'H3プロンプト最適化', category: 'Helpers',
    description: '日本語を含む通常の文章をMiniMax H3の映像・台詞・音声構文へ整形します。',
    accentClass: 'text-sky-200', supported: true,
    inputs: [{ id: 'in:text', type: 'text', label: 'Prompt' }],
    outputs: [{ id: 'out:text', type: 'text', label: 'H3 Prompt' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.textInput, label: 'テキスト読み込み', category: 'Inputs',
    description: '素材ブラウザに保存したテキストを読み込み、別のフローで再利用します。',
    accentClass: 'text-violet-200', supported: true, inputs: [],
    outputs: [{ id: 'out:text', type: 'text', label: 'Text' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.textOutput, label: 'テキスト書き出し', category: 'Outputs',
    description: '接続した文章をUTF-8テキスト素材としてプロジェクトに保存します。',
    accentClass: 'text-emerald-200', supported: true,
    inputs: [{ id: 'in:text', type: 'text', label: 'Text' }],
    outputs: [{ id: 'out:text', type: 'text', label: 'Text' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.workflowControl,
    label: 'Workflow Control',
    category: 'Helpers',
    description: 'Template-owned controls for a guided generation workflow.',
    accentClass: 'text-fuchsia-200',
    supported: true,
    hiddenFromPalette: true,
    inputs: [],
    outputs: [{ id: 'out:control', type: 'control', label: 'Settings' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.imageGen,
    label: 'Image Gen',
    category: 'Generate',
    description: 'Run a built-in local or cloud image workflow.',
    accentClass: 'text-sky-300',
    supported: true,
    inputs: [
      { id: 'in:text', type: 'text', label: 'Prompt' },
      { id: 'in:negative-text', type: 'negative-text', label: 'Negative' },
      { id: 'in:control', type: 'control', label: 'Controls', multiple: true },
      { id: 'in:image', type: 'image', label: 'Input' },
      { id: 'in:mask', type: 'mask', label: 'Mask' },
      { id: 'in:style', type: 'style', label: 'Style', multiple: true },
    ],
    outputs: [{ id: 'out:image', type: 'image', label: 'Image' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.videoGen,
    label: 'Video Gen',
    category: 'Generate',
    description: 'Run a built-in local or cloud image-to-video workflow.',
    accentClass: 'text-cyan-300',
    supported: true,
    inputs: [
      { id: 'in:text', type: 'text', label: 'Prompt' },
      { id: 'in:image', type: 'image', label: 'Start Frame' },
      { id: 'in:last-image', type: 'image', label: 'Last Frame' },
      { id: 'in:video', type: 'video', label: 'Reference Video' },
      { id: 'in:style', type: 'style', label: 'References', multiple: true },
      { id: 'in:voice', type: 'audio', label: 'Audio References', multiple: true },
      { id: 'in:character', type: 'character', label: 'Fixed Character' },
    ],
    outputs: [{ id: 'out:video', type: 'video', label: 'Video' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.videoUpscale,
    label: 'Upscale Video',
    category: 'Generate',
    description: 'Run a cloud video upscale workflow on an upstream video clip.',
    accentClass: 'text-amber-300',
    supported: true,
    inputs: [{ id: 'in:video', type: 'video', label: 'Video' }],
    outputs: [{ id: 'out:video', type: 'video', label: 'Video' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.musicGen,
    label: 'Music',
    category: 'Generate',
    description: 'Generate music from tags and optional lyrics.',
    accentClass: 'text-amber-300',
    supported: true,
    inputs: [{ id: 'in:text', type: 'text', label: 'Lyrics' }],
    outputs: [{ id: 'out:audio', type: 'audio', label: 'Audio' }],
  },
  {
    type: FLOW_AI_NODE_TYPES.output,
    label: 'Asset Output',
    category: 'Outputs',
    description: 'Send final image, video, or audio results into the Assets panel.',
    accentClass: 'text-slate-200',
    supported: true,
    inputs: [
      { id: 'in:image', type: 'image', label: 'Image' },
      { id: 'in:video', type: 'video', label: 'Video' },
      { id: 'in:audio', type: 'audio', label: 'Audio' },
    ],
    outputs: [],
  },
])

export const FLOW_AI_TEMPLATES = Object.freeze([
  {
    id: 'h3-character-builder',
    label: 'H3 Character Builder (.char)',
    description: 'Create and save a reusable OmniChar-compatible .char asset from face, body and clothing references.',
    category: 'utility',
  },
  {
    id: 'minimax-h3-character-actor',
    label: 'H3 Fixed Characte (.char) movie',
    description: 'Generate a movie from a reusable .char asset with the lightweight H3 Q4 Ref2VA path.',
    category: 't2v',
  },
  {
    id: 'google-nano-banana-lite',
    label: 'Google Nano Banana 2 Lite',
    description: 'Generate or edit a 1K image through the official paid Gemini API.',
    category: 't2i',
  },
  {
    id: 'google-veo-3-1-lite',
    label: 'Google Veo 3.1 Lite',
    description: 'Generate a 4–8 second 720p video through the official paid Gemini API.',
    category: 't2v',
  },
  {
    id: 'anima-lora-upscale',
    label: 'ANIMA Image Gen',
    description: 'Generate with an ANIMA checkpoint, stack up to five LoRAs, and optionally upscale using ComfyUI core nodes only.',
    category: 't2i',
  },
  { id: 'nsfw-minimax-h3-naughty-times', label: '[NSFW] H3 NaughtyTimes I2V', description: 'Image to video with NaughtyTimes v3 and native audio.', category: 'i2v', section: 'nsfw' },
  {
    id: 'blank',
    label: 'Blank Canvas',
    description: 'Start with a clean canvas and add nodes yourself.',
    category: 'utility',
  },
  {
    id: 'qwen-image-2-1-heretic',
    label: 'Qwen 2.1 Image Gen',
    description: 'Generate Qwen Image 2.1 images locally with the Heretic Q4_K_M text encoder and an optional transparent-PNG switch.',
    category: 't2i',
  },
  {
    id: 'nsfw-qwen-image-2-1-lora',
    label: '[NSFW] Qwen 2.1 LoRA T2I',
    description: 'Generate adult images with the exact Civitai Qwen Image 2.1 LoRA and the shared Heretic GGUF base stack.',
    category: 't2i',
    section: 'nsfw',
  },
  {
    id: 'qwen-image-2-1-heretic-edit',
    label: 'Qwen 2.1 Image Edit',
    description: 'Edit a project image with the same Qwen Image 2.1 model, Heretic encoder, mmproj vision tower, and transparent-PNG switch.',
    category: 'i2i',
  },
  {
    id: 'qwen-image-2-1-character-sheet',
    label: 'Qwen 2.1 Character Sheet',
    description: '参照画像1枚から、ヒーロー表示・三面図・表情・シルエット・ディテールをまとめた3:2デザインシートを生成します。',
    category: 'i2i',
  },
  {
    id: 'character-sheet',
    label: 'MiniMax H3 Character Sheet',
    description: 'Create a four-view character sheet from one to three reference images.',
    category: 'i2i',
  },
  {
    id: 'anima-lora-dataset',
    label: 'Anima LoRA Factory',
    description: 'Generate an eight-angle character dataset for Anima LoRA training.',
    category: 'utility',
  },
  {
    id: 'sdxl-lora-dataset',
    label: 'SDXL LoRA Factory',
    description: 'Generate an eight-angle character dataset for SDXL LoRA training.',
    category: 'utility',
  },
  {
    id: 'text-to-video',
    label: 'Z-Image + LTX T2V',
    description: 'Generate a keyframe image, then animate it into a video.',
    category: 't2v',
  },
  {
    id: 'music-cue',
    label: 'MusicGen Music',
    description: 'Write tags/lyrics and generate a music stem.',
    category: 'audio',
  },
  {
    id: 'character-reference-edit',
    label: 'Qwen Character Edit',
    description: 'Keep the character from Reference 1 while borrowing clothing or accessories from References 2–6.',
    category: 'i2i',
  },
  {
    id: 'nsfw-dark-beast-krea2-i2i',
    label: '[NSFW] KREA 2 Dark Beast T2I / I2I',
    description: 'Generate from text, or optionally connect one adult source image for latent I2I editing.',
    category: 't2i',
    section: 'nsfw',
  },
  {
    id: 'nsfw-haruki-mix-krea2-t2i',
    label: '[NSFW] HARUKI_MIX Krea 2 T2I',
    description: 'Generate fictional adult characters with HARUKI_MIX KR2 V2.0 and the shared Krea 2 encoder and VAE.',
    category: 't2i',
    section: 'nsfw',
  },
  {
    id: 'nsfw-wan-1-3b-e10-t2v',
    label: '[NSFW] Wan 1.3B e10 T2V',
    description: 'Generate short adult text-to-video clips with the exact requested legacy e10 full checkpoint.',
    category: 't2v',
    section: 'nsfw',
  },
  {
    id: 'image-to-video',
    label: 'MiniMax H3 I2V',
    description: 'Animate a project image with the default MiniMax H3 Fused Turbo + SLA low-VRAM workflow.',
    category: 'i2v',
  },
  {
    id: 'ainvfx-fluid', label: 'LTX 2.5 Fluid I2V',
    description: 'Paint a first and last keyframe, then generate smoke, steam or fire with LTX 2.5.',
    category: 'i2v',
  },
  {
    id: 'start-last-frame-video',
    label: 'MiniMax H3 First/Last I2V',
    description: 'Generate the motion between two project images with MiniMax H3 GGUF.',
    category: 'i2v',
  },
  {
    id: 'vdn-h3-t2va',
    label: 'MiniMax H3 VDN T2V',
    description: 'Generate a continuous shot with native audio using MiniMax H3 hybrid attention.',
    category: 't2v',
  },
  {
    id: 'fast-minimax-h3-t2va',
    label: 'MiniMax H3 Fast T2V',
    description: 'Anime-oriented text to video with native audio, 4/6/8 steps, and optional image and audio references.',
    category: 't2v',
  },
  {
    id: 'reference-video-to-video',
    label: 'MiniMax H3 Reference R2V',
    description: 'Generate a new video from a motion reference and up to eight optional images with local MiniMax H3 Ref2VA GGUF.',
    category: 'video-tools',
  },
  {
    id: 'minimax-h3-360-orbit',
    label: 'H3バレットタイム',
    description: 'Orbit a frozen human-centered scene through 360 degrees, returning to the same source frame after about three seconds.',
    category: 'i2v',
  },
  {
    id: 'minimax-h3-handheld',
    label: 'H3ハンドヘルドカメラ',
    description: 'Add stronger organic handheld shake to a text-driven or image-guided MiniMax H3 shot.',
    category: 'i2v',
  },
  {
    id: 'minimax-h3-character-swap',
    label: 'MiniMax H3 Character Swap',
    description: 'Replace one person in a short source shot with one character image. Fixed to the recommended 4-5 second range.',
    category: 'video-tools',
  },
  {
    id: 'nsfw-anime-talking-video',
    label: '[NSFW] Irodori + LTX Talking I2V',
    description: 'Animate an ANIMA-style image with Irodori v4.1 Anime dialogue and Exact Audio lip-sync.',
    category: 'i2v',
    section: 'nsfw',
  },
  {
    id: 'nsfw-ortenzya-scenario',
    label: '[NSFW] Ortenzya Prompt Draft',
    description: 'Ortenzyaでシナリオを作成・編集し、ショットごとの画像・動画用プロンプトの下書きへ変換。',
    category: 'utility',
    section: 'nsfw',
  },
  {
    id: 'nsfw-minimax-h3-pink-bunny',
    label: '[NSFW] H3 PinkFluffy I2V',
    description: 'Animate an adult source image with the local rank-128 LoRA, 20 steps, and no Turbo adapter.',
    category: 'i2v',
    section: 'nsfw',
  },
  {
    id: 'nsfw-minimax-h3-pink-reference',
    label: '[NSFW] H3 PinkFluffy R2V',
    description: 'Drive PinkFluffyBunny with a required reference video and up to eight optional identity or style images.',
    category: 'video-tools',
    section: 'nsfw',
  },
  {
    id: 'nsfw-minimax-h3-aftermidnight-r2v',
    label: '[NSFW] H3 AfterMidnight R2V',
    description: 'Run the AfterMidnight Ref2VA sexytime v1.2 LoRA with its required Euler and beta recipe.',
    category: 'video-tools',
    section: 'nsfw',
  },
  {
    id: 'nsfw-minimax-h3-scene-character-props',
    label: '[NSFW] H3 Three-Reference I2V',
    description: 'Generate a video from a scene image, a character sheet, and an optional props or additional stage reference.',
    category: 'i2v',
    section: 'nsfw',
  },
  {
    id: 'nsfw-anime-endpoints-flf2v',
    label: '[NSFW] Qwen + H3 Endpoint R2V',
    description: 'Extract both endpoint frames, anime-stylize them, then generate a first/last-frame NSFW video.',
    category: 'video-tools',
    section: 'nsfw',
  },
  {
    id: 'nsfw-anime-endpoints-r2v',
    label: '[NSFW] Qwen + H3 Motion R2V',
    description: 'Anime-stylize both endpoint frames while retaining the original video as the motion and camera guide.',
    category: 'video-tools',
    section: 'nsfw',
  },
  {
    id: 'nsfw-minimax-h3-motion-8step',
    label: '[NSFW] H3 Motion I2V',
    description: 'Animate an adult source image with the dedicated 8-step motion enhancer in place of vanilla LightX2V.',
    category: 'i2v',
    section: 'nsfw',
  },
  {
    id: 'media-to-prompt',
    label: 'MiniMax H3 Media Prompt',
    description: 'Analyze a project image or full video and generate a MiniMax H3 prompt.',
    category: 'utility',
  },
  {
    id: 'jp-tag-search',
    label: 'JP Tag Search',
    description: '日本語または英語からDanbooruタグを検索し、プロンプトへ接続します。',
    category: 'utility',
  },
])

export const FLOW_AI_TEMPLATE_INFO = Object.freeze({
  'h3-character-builder': Object.freeze({
    title: 'H3 Character Builder (.char)',
    author: 'OmniChar / Inline Studio concept; Lumeweft CANVAS adaptation',
    repositoryUrl: 'https://www.omnichar.org/getting-started',
    license: 'OmniChar and Lumeweft source are GPL-3.0; reference-image rights apply separately.',
    description: 'Creates a reusable INLINECHAR v1 .char asset from face, body, clothing and a locked description. The saved file can be selected by any H3 Fixed Characte (.char) movie flow.',
    notice: 'The original PNG references and locked description are the source of truth. This edition does not yet write YuNet, SFace or DINOv2 scoring caches; compatible readers can regenerate those caches from the stored references.',
  }),
  'minimax-h3-character-actor': Object.freeze({
    title: 'H3 Fixed Characte (.char) movie',
    author: 'OmniChar / Inline Studio concept; Lumeweft CANVAS adaptation',
    repositoryUrl: 'https://www.omnichar.org/getting-started',
    license: 'OmniChar and Lumeweft source are GPL-3.0; MiniMax H3 model terms and reference-image rights apply separately.',
    description: 'Loads a saved INLINECHAR v1 .char asset and expands its face, body, clothing and locked description into the existing local Q4 Ref2VA workflow. The .char can be reused across any number of shots.',
    notice: 'This lightweight edition uses the matched PDD 8-step LoRA and SageAttention instead of OmniChar\'s 24 GB native FP8/32B stack. It does not yet write YuNet, SFace or DINOv2 scoring caches; compatible readers can regenerate those caches from the stored references.',
  }),
  'qwen-image-2-1-heretic': Object.freeze({
    title: 'Qwen Image 2.1 Heretic GGUF',
    author: 'Qwen / pottokao; Lumeweft CANVAS integration',
    repositoryUrl: 'https://huggingface.co/pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF',
    license: 'Text encoder: Apache-2.0 community derivative. Qwen Image 2.1 weights: Qwen Research License. Review each source before commercial use.',
    description: 'Uses the requested Heretic Q4_K_M Qwen3-VL text encoder with the official Qwen Image 2.1 INT8 ConvRot diffusion model and VAE. The output note owns a persistent transparent-PNG switch; Lumeweft adds the official RGBA prompt wrapper only at run time.',
    notice: 'Requires ComfyUI 0.36.0 or newer, ComfyUI-GGUF, the temporary Qwen3-VL GGUF text-encoder patch, and the matching mmproj file beside the GGUF encoder. The community encoder is refusal-ablated and used at your own risk.',
  }),
  'nsfw-qwen-image-2-1-lora': Object.freeze({
    title: 'NSFW LoRA — Qwen Image 2.1',
    author: 'TheseAlpacas; Lumeweft CANVAS integration',
    repositoryUrl: 'https://civitai.red/models/2958918/nsfw-lora-or-qwen-image-21?modelVersionId=3351951',
    license: 'Civitai permits image use, commercial use, derivatives, and different-license derivatives for this model; the Qwen Research License still applies to the base weights.',
    description: 'Applies Civitai model version 3351951 through LoraLoaderModelOnly at strength 1.0 to the existing Qwen Image 2.1 INT8 ConvRot base. The Heretic Q4_K_M encoder, matching mmproj, and Qwen Image 2.1 VAE are shared with the existing local Qwen 2.1 flows.',
    notice: 'Published examples use er_sde + beta, CFG 1, 20–25 steps, and LoRA strength 1.0. Install the exact LoRA through Generate > Community using the linked Civitai/Civitai Red URL; adult subjects only.',
  }),
  'qwen-image-2-1-heretic-edit': Object.freeze({
    title: 'Qwen Image 2.1 Heretic Edit',
    author: 'Qwen / pottokao; Lumeweft CANVAS integration',
    repositoryUrl: 'https://huggingface.co/pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF',
    license: 'Text encoder: Apache-2.0 community derivative. Qwen Image 2.1 weights: Qwen Research License. Review each source before commercial use.',
    description: 'Uses the same Heretic Q4_K_M Qwen3-VL encoder, matching mmproj vision tower, official Qwen Image 2.1 INT8 ConvRot diffusion model, and RGBA VAE to edit image_1. The encoder-produced latent preserves the source canvas and aspect ratio.',
    notice: 'Requires ComfyUI 0.36.0 or newer, ComfyUI-GGUF, the temporary Qwen3-VL GGUF text-encoder patch, and the matching mmproj file beside the GGUF encoder. Mention the edit target as <image1> in prompts when useful.',
  }),
  'qwen-image-2-1-character-sheet': Object.freeze({
    title: 'QWENキャラクターシート',
    author: 'NeuroContent (source workflow); Qwen / pottokao; Lumeweft CANVAS adaptation',
    repositoryUrl: 'https://civitai.com/models/2960750/qwen-image-21-character-design-sheet-maker-workflow',
    license: 'Civitai workflow permissions and the Qwen Research License apply; the Heretic community encoder is provided under its own terms.',
    description: 'A dedicated Qwen Image 2.1 character-sheet preset, separate from the MiniMax H3 sheet. It uses one project image as the sole identity source and lays out a central hero, front/side/back turnaround, pose studies, expressions, silhouettes, and close-up details on a 3:2 canvas.',
    notice: 'The source workflow recommends res_2m + beta and a 3.4-megapixel canvas. This Lumeweft adaptation reuses the installed Heretic Q4_K_M encoder and mmproj rather than requiring the source workflow\'s separate BF16 encoder and PE custom-node stack.',
  }),
  'jp-tag-search': Object.freeze({
    title: '日本語タグ検索 / JP Tag Search',
    author: 'dr1610 (source dictionaries); Lumeweft native implementation',
    repositoryUrl: 'https://github.com/dr1610/a1111-sd-webui-jp-tag-assistant',
    license: 'Dictionary bundling permitted directly by the author via social media, confirmed by the Lumeweft maintainer on 2026-09-14; source code not included',
    description: 'Searches the four bundled CSV dictionaries in Lumeweft and passes prompt-ready English tags into CANVAS. It does not require ComfyUI or copy the upstream Python/JavaScript implementation.',
    notice: 'The related-tag co-occurrence archive is intentionally omitted, so this native edition provides Japanese/English lookup but not upstream related-tag recommendations. Keep the original permission record with release records.',
  }),
  'anima-lora-upscale': Object.freeze({
    title: 'ANIMA Multi-LoRA + Upscale',
    author: 'Yunmiyun_UwU (original workflow); Lumeweft core-node adaptation',
    repositoryUrl: 'https://civitai.com/models/2637356/anima-lora-upscaler-resizer',
    license: 'Civitai workflow permissions allow derivatives; checkpoint, LoRA, and upscaler licenses apply separately',
    description: 'A CANVAS-native adaptation of the ANIMA + multi-LoRA + optional upscaler flow. Lumeweft expands five friendly LoRA slots into ordinary core LoraLoader nodes and owns the resize and bypass behavior.',
    notice: 'RES4LYF is an approved exception and preserves the source Clownshar sampler with exponential/res_2s. Power LoRA Loader, rgthree bypass, mxToolkit sizing, and other convenience nodes remain replaced by Lumeweft-owned controls and core nodes.',
  }),
  'nsfw-minimax-h3-naughty-times': Object.freeze({
    title: 'MiniMax H3 NaughtyTimes v3', author: 'SexGod1979', repositoryUrl: 'https://huggingface.co/SexGod1979/NaughtyTimes-MiniMax-H3',
    license: 'Repository declares Apache-2.0; base model terms apply separately',
    description: 'Published pruned_NOADALN rank-64 v3 LoRA with the pruned Q4 GGUF FL2VA base and native audio.',
    notice: 'The model card still describes unpruned training, although a pruned_NOADALN file is now published. Local quality is unverified. Twenty steps is a Lumeweft starting point, not an author-provided recipe.',
  }),
  'nsfw-dark-beast-krea2-i2i': Object.freeze({
    title: 'NSFW T2I / I2I — Dark Beast KREA 2',
    author: 'cire-sama / aleks86k; Lumeweft T2I / latent-I2I adaptation',
    repositoryUrl: 'https://civitai.red/models/2242173/dark-beast-or-h3-director-edition?modelVersionId=3078453',
    license: 'Civitai version permissions and the Krea 2 Community License apply; review both before use',
    description: 'Uses the exact linked version 3078453, whose published base is Krea 2. It generates from an empty latent when no image is connected, or VAE-encodes an optional source image for latent I2I.',
    notice: 'Despite the parent model page name, version 3078453 is not MiniMax H3. An optional source enables conventional latent I2I rather than prompt-addressable multi-reference editing. Lower denoise preserves more of the source; higher values change it more strongly. Adult subjects only.',
  }),
  'nsfw-haruki-mix-krea2-t2i': Object.freeze({
    title: 'HARUKI_MIX KR2 V2.0 — NSFW T2I',
    author: 'HARUKI_KAWAI; Lumeweft CANVAS integration',
    repositoryUrl: 'https://civitai.red/models/856375/harukimix?modelVersionId=3188234',
    license: 'Credit is optional and generated images may be sold. The author prohibits paid generation services, model merging, redistribution, and derivative model sharing; Krea 2 terms also apply.',
    description: 'Uses exact Civitai model version 3188234, a Krea 2 INT8 ConvRot checkpoint tuned for photorealistic fictional characters and improved NSFW anatomy. It reuses the same official Krea 2 Qwen3-VL 4B FP8 encoder and Qwen image VAE as the Dark Beast flow.',
    notice: 'Published guidance is Euler with simple, beta, or bong_tangent scheduling, 8 steps, and CFG 1. This preset uses Euler/simple at 816×1104. Generated characters must be fictional adults.',
  }),
  'nsfw-wan-1-3b-e10-t2v': Object.freeze({
    title: 'NSFW Wan 1.3B e10 — Text to Video',
    author: 'NSFW-API; Lumeweft CANVAS integration',
    repositoryUrl: 'https://huggingface.co/NSFW-API/NSFW_Wan_1.3b/blob/main/wan_1.3B_e10.safetensors',
    license: 'Repository metadata declares CreativeML Open RAIL-M; Wan 2.1 support weights keep their own terms.',
    description: 'Loads wan_1.3B_e10.safetensors as a complete Wan 2.1 T2V 1.3B diffusion model, with the official ComfyUI UMT5 encoder, Wan 2.1 VAE, sampling shift 8, 30 steps, CFG 6, and uni_pc/simple defaults.',
    notice: 'The publisher now classifies e10 as a legacy image-trained checkpoint with limited native motion and reports quality degradation after epoch 3. The newer exp_e14 is recommended upstream, but this preset intentionally uses the exact e10 file requested here. Fictional consenting adults only.',
  }),
  'image-to-video': Object.freeze({
    title: 'MiniMax H3 Fused Turbo + SLA',
    author: 'MATLOWAI (fused model), patientx / ethanfel (SLA node)',
    repositoryUrl: 'https://huggingface.co/MATLOWAI/minimax-h3-fused-turbo-int8-convrot',
    license: 'MiniMax H3 Community License; bundled Turbo component is Apache-2.0; review upstream notices for all merged components',
    description: 'Default local MiniMax H3 image-to-video route: fused RefDelta/Turbo/Mystic INT8 ConvRot model, H3 SLA block-sparse attention, exact low-VRAM feed-forward chunking, INT8 video VAE and native audio.',
    notice: 'Uses the published 4-step recipe: res_multistep/simple, Sigma Shift 12/3, SLA 0.90 with block size 64. The 21 GB model and 32B NVFP4 encoder can offload but still require substantial host RAM; use the NSFW Q4 GGUF presets when minimizing memory is more important.',
  }),
  'nsfw-minimax-h3-pink-bunny': Object.freeze({
    title: 'MiniMax H3 PinkFluffyBunny (Quality)',
    author: 'SexGod1979',
    repositoryUrl: 'https://huggingface.co/SexGod1979/PinkFluffyBunny-MiniMax-H3',
    license: 'Repository declares Apache-2.0; MiniMax H3 base weights use the MiniMax H3 Community License',
    description: 'Quality-first FL2VA image animation using the locally available rank-128 v2 LoRA and the smaller Q4_0 GGUF base. The standard Turbo LoRA is replaced, not stacked.',
    notice: 'The LoRA author says v2 was trained on the unpruned FL2VA model and recommends image conditioning without Turbo. The Q4_0 pruned base is a low-memory compatibility option and may reduce LoRA fidelity; use the unpruned FL2VA base externally when maximum compatibility matters.',
  }),
  'nsfw-minimax-h3-pink-reference': Object.freeze({
    title: 'MiniMax H3 PinkFluffyBunny Reference Video',
    author: 'SexGod1979 (LoRA); Lumeweft reference-video adaptation',
    repositoryUrl: 'https://huggingface.co/SexGod1979/PinkFluffyBunny-MiniMax-H3',
    license: 'LoRA repository declares Apache-2.0; MiniMax H3 base weights use the MiniMax H3 Community License',
    description: 'The Ref2VA Q4 base receives the local PinkFluffyBunny v2 rank-128 LoRA, then optional SageAttention and H3 Sigma Shift. Connected images use max reference resolution and explicit <Picture i> prompt labels; the reference video uses <Video 1>.',
    notice: 'This is a compatibility adaptation: PinkFluffyBunny was trained on FL2VA, while strong image-and-video reference conditioning requires the Ref2VA base. LoRA fidelity can differ from the original FL2VA image-only preset. Turbo is not stacked.',
  }),
  'nsfw-minimax-h3-aftermidnight-r2v': Object.freeze({
    title: 'AfterMidnightR2V',
    author: 'SexGod1979',
    repositoryUrl: 'https://huggingface.co/SexGod1979/AfterMidnight-MiniMax-H3-NSFW',
    license: 'LoRA repository declares Apache-2.0; MiniMax H3 base weights use the MiniMax H3 Community License',
    description: 'Ref2VA Q4 generation with the latest AfterMidnight sexytime rank-64 v1.2 LoRA at strength 1.0. One reference video is required; up to eight identity or style images and the video soundtrack are optional.',
    notice: 'The author requires Euler sampling with the beta scheduler to avoid audio problems. Only the sexytime flavor is loaded; do not stack the softer flavor or Turbo. Connected images use max reference resolution and explicit <Picture i> labels.',
  }),
  'nsfw-anime-endpoints-flf2v': Object.freeze({
    title: 'Anime Endpoints -> First/Last Video',
    author: 'Lumeweft composition; Qwen Image Edit and PinkFluffyBunny by their respective authors',
    repositoryUrl: 'https://huggingface.co/SexGod1979/PinkFluffyBunny-MiniMax-H3',
    license: 'Each selected image model and LoRA retains its own license; MiniMax H3 base weights use the MiniMax H3 Community License',
    description: 'Extracts the first and last frames from one project video, stylizes each endpoint with the local image-edit workflow, then connects the two generated images to MiniMax H3 first_frame and last_frame conditioning.',
    notice: 'The default endpoint renderer is Qwen Image Edit because it preserves an existing frame more reliably than a text-only ANIMA checkpoint. The image nodes remain editable, so another installed image-edit model may be selected. The final PinkFluffyBunny graph is a Q4 compatibility adaptation and has not been claimed pixel-locked.',
  }),
  'nsfw-anime-endpoints-r2v': Object.freeze({
    title: 'Anime Endpoints + Reference Motion Video',
    author: 'Lumeweft composition; Qwen Image Edit and AfterMidnight by their respective authors',
    repositoryUrl: 'https://huggingface.co/SexGod1979/AfterMidnight-MiniMax-H3-NSFW',
    license: 'Each selected image model and LoRA retains its own license; MiniMax H3 base weights use the MiniMax H3 Community License',
    description: 'Extracts and anime-stylizes the source endpoints, then supplies them as <Picture 1>/<Picture 2> while the original clip remains <Video 1> for motion, timing, interaction and camera guidance.',
    notice: 'Ref2VA image references are strong appearance references, not strict temporal first/last slots. Use the companion first/last recipe when endpoint placement matters more than copying the source motion.',
  }),
  'nsfw-minimax-h3-scene-character-props': Object.freeze({
    title: 'MiniMax H3 NSFW — Scene + Character + Props',
    author: 'Lumeweft composition using AfterMidnight MiniMax H3 NSFW',
    repositoryUrl: 'https://huggingface.co/SexGod1979/AfterMidnight-MiniMax-H3-NSFW',
    license: 'AfterMidnight declares Apache-2.0; MiniMax H3 base weights use the MiniMax H3 Community License',
    description: 'Uses three ordered image references: Picture 1 defines the scene and composition, Picture 2 defines the adult character from a character sheet, and optional Picture 3 defines props or additional stage details.',
    notice: 'The picture-role instructions are applied internally. The visible prompt is only for the desired adult content, action, camera and sound.',
  }),
  'nsfw-minimax-h3-motion-8step': Object.freeze({
    title: 'MiniMax H3 Motion Enhancer (8-step)',
    author: 'rzgar',
    repositoryUrl: 'https://huggingface.co/rzgar/minimax-h3_fl2v_8Step_motion_enhancer',
    license: 'Apache-2.0 adapter; MiniMax H3 base weights use the MiniMax H3 Community License',
    description: 'Low-memory Q4_0 GGUF image-to-video with native audio and the dedicated FL2V 8-step motion enhancer.',
    notice: 'The adapter model card explicitly says to disable the vanilla LightX2V LoRA. This preset replaces it and retains the eight-step scheduler.',
  }),
  'vdn-h3-t2va': Object.freeze({
    title: 'VDN-H3 8step', author: 'OpenVDN (model), Saganaki22 (ComfyUI port)',
    repositoryUrl: 'https://github.com/Saganaki22/ComfyUI-VDN-H3', license: 'Apache-2.0 (node code); MiniMax H3 Community License (model weights)',
    description: 'Dedicated text-to-video preset with native audio. Uses the plain FL2VA INT8 ConvRot base and stage-dmd-step-250 VDN branch/adapters, er_sde / beta at 8 steps. Streamed branch weights and merged adapters reduce VRAM usage.',
    notice: 'No community Turbo, fused Turbo/Mystic model or Scheduled SOL attention is stacked. Defaults to 608×352 and 5 seconds; supports 5–15 seconds. End-to-end speed and memory use depend on hardware. Reference conditioning is not included in this preset.',
  }),
  'fast-minimax-h3-t2va': Object.freeze({
    title: 'Fast MiniMax H3 T2VA (Anime)',
    author: 'aziib (workflow), MATLOWAI (fused Turbo/Mystic model)',
    repositoryUrl: 'https://civitai.com/models/2906467/fast-minimax-h3?modelVersionId=3291309',
    license: 'Original workflow terms on Civitai; model weights use the MiniMax H3 Community License',
    description: 'Based on the supplied Fast MiniMax H3 ReferenceToVideo workflow. Anime-oriented default prompt; text-only generation or up to two image and two audio references. Uses the MATLOWAI fused INT8 Turbo/Mystic model, Euler and the published 4/6/8-step sigma schedules.',
    notice: 'SageAttention and Triton are required. Installer: https://github.com/DazzleML/comfyui-triton-and-sageattention-installer. The linked Reddit Kijai experimental model uses a different sampling recipe.',
  }),
  'ainvfx-fluid': Object.freeze({
    title: 'AInVFX Fluid', author: 'Adrien Toupet / AInVFX',
    repositoryUrl: 'https://huggingface.co/AInVFX/ainvfx-fluid',
    license: 'LTX-2.x Community License (LoRA and base model)',
    description: 'Two painted keyframes at indices 0 and 120, with 119 black frames between. LTX 2.5 distilled INT8, 8 steps, CFG 1, Euler ancestral. Lumeweft owns the painter and control composition; official LTXVideo nodes supply IC-LoRA operations.',
    notice: 'Smoke, steam and fire. 121 frames at 24/25/50 fps; dimensions must be multiples of 64. Base weights require Hugging Face access approval. A painted photo is reinterpreted, not preserved pixel-for-pixel. For a locked plate, generate over black and composite in Edit. Output is not an alpha matte.',
  }),
  'reference-video-to-video': Object.freeze({
    title: 'Reference Video -> Video (MiniMax H3 GGUF)',
    author: 'TheAiBlueprint (original workflow)',
    repositoryUrl: 'https://civitai.com/models/2838553/minimax-h3-reference-to-video-or-8-images-2x-speed-boost',
    license: 'Original workflow terms on Civitai; model weights use the MiniMax H3 Community License',
    description: 'Adapted for the local CANVAS GGUF loaders. Uses Ref2VA with a 24 fps reference video, optional images, and native audio. SageAttention is enabled by default with the same auto setting as the original 2X Speed Boost workflow. Actual end-to-end speed depends on hardware and reference length. SolAttn and EasyCache remain off, as in the source graph.',
  }),
  'minimax-h3-character-swap': Object.freeze({
    title: 'MiniMax H3 Character Swap',
    author: 'Akatz Labs; Lumeweft CANVAS integration',
    repositoryUrl: 'https://huggingface.co/akatz-ai/MiniMax-H3-Character-Swap-LoRA',
    license: 'MiniMax H3 Community License Agreement. Its standard territorial grant excludes the US, EU, UK, and Republic of Korea and describes separate authorization; review the complete terms before use.',
    description: 'A beginner-facing Ref2VA character-replacement flow with one source video, one replacement-character image, LoRA strength 1.0, 24 fps, and a fixed 4-5 second duration. It uses the existing low-memory Ref2VA Q4 runtime without a Turbo LoRA.',
    notice: 'Experimental. Short continuous shots are the published recommendation. Hard cuts, exact facial expressions, timing, framing, and audio/lip sync can drift. The local Q4 base is a compatibility adaptation of the published INT8 training base, so output fidelity is not guaranteed.',
  }),
  'minimax-h3-360-orbit': Object.freeze({
    title: 'H3バレットタイム',
    author: 'Pablo Dawson; Lumeweft CANVAS integration',
    repositoryUrl: 'https://huggingface.co/pablodawson/MiniMax-H3-360-Orbit-LoRA',
    license: 'MiniMax H3 Community License Agreement. Review the complete model license before use.',
    description: 'Dedicated FL2VA flow using the publisher prompt, the same image as first and last frame, 768×768, 73 frames at 24 fps, 28 sampling steps, BasicGuider (no CFG), LoRA strength 1.0, and silent output.',
    notice: 'Experimental and narrow-domain. Trained on 28 human-centered square clips. Other subjects, aspect ratios, shot lengths, and added motion are untested; blinks or subtle subject motion may still occur. This LoRA is isolated to this flow and is not applied to other H3 workflows.',
  }),
  'minimax-h3-handheld': Object.freeze({
    title: 'H3ハンドヘルドカメラ',
    author: 'neph1; Hugging Face mirror and Lumeweft CANVAS integration',
    repositoryUrl: 'https://huggingface.co/neph1/minimax_h3_handheld_shaky_camera',
    license: 'MiniMax H3 Community License Agreement. Review the complete model license before use.',
    description: 'Experimental camera-motion flow using handheld_h3_100 at the publisher showcase strength of 1.7. It supports text-only shots or one optional first frame, uses the standard pruned FL2VA INT8 base, 20-step res_multistep/simple sampling, and native audio.',
    notice: 'Experimental. The publisher says it strengthens MiniMax H3 handheld shake for both static and moving shots, may work without its trained phrase, and is not guaranteed to work with other LoRAs. This adapter is therefore isolated to this flow. Avoid writing the literal word “camera” when the model starts drawing a camera into the scene.',
  }),
  'character-sheet': Object.freeze({
    title: 'H3 Character Sheet',
    author: 'PoopMan333 (original workflow)',
    repositoryUrl: 'https://huggingface.co/PoopMan333/H3_Character_Sheet_Generator',
    license: 'Workflow attribution; model weights use the MiniMax H3 Community License',
    description: 'Adapted for CANVAS from the H3 Character Sheet Generator workflow. Model and workflow terms are separate and both must be reviewed.',
  }),
  'anima-lora-dataset': Object.freeze({
    title: 'Anima LoRA Factory',
    presentation: 'recipe',
    recipeKind: 'lora-dataset',
    author: 'UNfukashigi',
    repositoryUrl: 'https://github.com/UNfukashigi/Anima-LoRA-Factory',
    license: 'Apache License 2.0 (factory software)',
    description: 'CANVAS uses its existing Qwen multiple-angle workflow to prepare eight character views, then exports those images for use in the original Anima LoRA Factory GUI.',
    notice: 'The Apache-2.0 license applies to the factory software. Anima base models, training images, generated images, and third-party dependencies can have separate terms.',
    datasetExport: true,
  }),
  'sdxl-lora-dataset': Object.freeze({
    title: 'SDXL LoRA Factory',
    presentation: 'recipe',
    recipeKind: 'lora-dataset',
    author: 'UNfukashigi',
    repositoryUrl: 'https://github.com/UNfukashigi/SDXL-LoRA-Factory',
    license: 'Apache License 2.0 (factory software)',
    description: 'CANVAS uses its existing Qwen multiple-angle workflow to prepare eight character views, then exports those images for use in the original SDXL LoRA Factory GUI.',
    notice: 'The Apache-2.0 license applies to the factory software. SDXL checkpoints, training images, generated images, and third-party dependencies can have separate terms.',
    datasetExport: true,
  }),
})

export function getFlowNodeDefinition(type) {
  return FLOW_AI_NODE_LIBRARY.find((entry) => entry.type === type) || null
}

export function getFlowNodeSupportsExecution(type) {
  return (
    type === FLOW_AI_NODE_TYPES.promptAssist
    || type === FLOW_AI_NODE_TYPES.h3Optimizer
    || type === FLOW_AI_NODE_TYPES.textOutput
    || type === FLOW_AI_NODE_TYPES.characterBuilder
    || type === FLOW_AI_NODE_TYPES.imageGen
    || type === FLOW_AI_NODE_TYPES.videoGen
    || type === FLOW_AI_NODE_TYPES.videoUpscale
    || type === FLOW_AI_NODE_TYPES.musicGen
  )
}

export function parsePortType(handleId = '') {
  const normalized = String(handleId || '').trim()
  if (!normalized.includes(':')) return ''
  return normalized.split(':')[1]
}

export function isSingletonTargetHandle(handleId = '') {
  return !['in:style', 'in:voice', 'in:control', 'in:face', 'in:body', 'in:cloth'].includes(String(handleId || '').trim())
}

export function isValidFlowConnection(connection) {
  const sourceType = parsePortType(connection?.sourceHandle)
  const targetType = parsePortType(connection?.targetHandle)
  if (!sourceType || !targetType) return false
  if (sourceType === targetType) return true
  if (targetType === 'negative-text') return sourceType === 'text'
  if (targetType === 'voice') return sourceType === 'audio'
  if (targetType === 'style') return sourceType === 'image'
  if (targetType === 'mask') return sourceType === 'image'
  if (['face', 'body', 'cloth'].includes(targetType)) return sourceType === 'image'
  if (targetType === 'any') return ['image', 'video', 'audio', 'text'].includes(sourceType)
  return false
}

function createBaseNodeData(type) {
  switch (type) {
    case FLOW_AI_NODE_TYPES.h3Optimizer:
      return { label: 'H3プロンプト最適化', inlinePrompt: '', h3Mode: 'T2VA', duration: 5, referenceNotes: '', localLlmEndpoint: 'http://localhost:1234', localLlmModel: '', maxTokens: 4096, seed: randomSeed(), outputText: '', outputAssetIds: [], status: 'idle', error: '' }
    case FLOW_AI_NODE_TYPES.textInput:
      return { label: 'テキスト読み込み', assetId: '', status: 'idle', error: '' }
    case FLOW_AI_NODE_TYPES.textOutput:
      return { label: 'テキスト書き出し', filename: 'text', folderName: 'Texts', outputAssetIds: [], outputText: '', status: 'idle', error: '' }
    case FLOW_AI_NODE_TYPES.promptAssist:
      return {
        label: 'Prompt Assist',
        workflowId: getDefaultWorkflowId(type),
        inlinePrompt: 'Turn this into a vivid, production-ready image generation prompt.',
        systemPrompt: '',
        duration: 15,
        outputLanguage: 'English',
        imageAnalysisMode: 'Comprehensive',
        videoAnalysisMode: 'Comprehensive',
        frameTime: 0,
        seed: randomSeed(),
        outputText: '',
        outputAssetIds: [],
        status: 'idle',
        statusMessage: 'Write a brief or connect a Prompt node, then run to refine it.',
        error: '',
        dependencyStatus: 'unknown',
        lastPromptId: null,
        lastRunAt: null,
      }
    case FLOW_AI_NODE_TYPES.textViewer:
      return {
        label: 'Text Viewer',
        note: '',
        status: 'idle',
        statusMessage: 'Connect a text-producing node to inspect it here.',
        error: '',
      }
    case FLOW_AI_NODE_TYPES.prompt:
      return {
        label: 'Prompt',
        basePrompt: '',
        promptText: '',
        promptPlaceholder: 'Describe the scene, action, performance, or change you want.',
        note: '',
        status: 'idle',
        statusMessage: '',
        error: '',
      }
    case FLOW_AI_NODE_TYPES.workflowControl:
      return {
        label: 'Workflow Control',
        controlKind: '',
        status: 'idle',
        statusMessage: '',
        error: '',
      }
    case FLOW_AI_NODE_TYPES.imageInput:
      return {
        label: 'Image Input',
        assetId: '',
        frameTime: 0,
        note: '',
        status: 'idle',
        statusMessage: 'Pick an asset from the project.',
        error: '',
      }
    case FLOW_AI_NODE_TYPES.styleReference:
      return {
        label: 'Style Reference',
        assetId: '',
        note: '',
        status: 'idle',
        statusMessage: 'Optional reference for edit-capable image workflows.',
        error: '',
      }
    case FLOW_AI_NODE_TYPES.characterInput:
      return { label: 'Character File', assetId: '', status: 'idle', statusMessage: 'Choose a .char actor from this project.', error: '' }
    case FLOW_AI_NODE_TYPES.characterBuilder:
      return { label: 'Create Character File', characterName: 'Character', inlinePrompt: '', outputAssetIds: [], status: 'idle', statusMessage: 'Connect at least one face reference, then run.', error: '' }
    case FLOW_AI_NODE_TYPES.imageGen:
      return {
        label: 'Image Gen',
        workflowId: getDefaultWorkflowId(type),
        inlinePrompt: '',
        negativePrompt: 'blurry, low quality, watermark',
        width: 1280,
        height: 720,
        variantCount: 1,
        seed: randomSeed(),
        status: 'idle',
        statusMessage: '',
        error: '',
        outputAssetIds: [],
        dependencyStatus: 'unknown',
      }
    case FLOW_AI_NODE_TYPES.videoGen:
      return {
        label: 'Video Gen',
        workflowId: getDefaultWorkflowId(type),
        inlinePrompt: '',
        negativePrompt: 'blurry, low quality, watermark',
        width: 1280,
        height: 720,
        duration: 5,
        fps: 24,
        seed: randomSeed(),
        wanQualityPreset: 'balanced',
        status: 'idle',
        statusMessage: '',
        error: '',
        outputAssetIds: [],
        dependencyStatus: 'unknown',
      }
    case FLOW_AI_NODE_TYPES.videoUpscale:
      return {
        label: 'Upscale Video',
        workflowId: getDefaultWorkflowId(type),
        upscaleModel: TOPAZ_VIDEO_UPSCALE_DEFAULTS.model,
        targetResolution: TOPAZ_VIDEO_UPSCALE_DEFAULTS.resolution,
        upscaleCreativity: TOPAZ_VIDEO_UPSCALE_DEFAULTS.creativity,
        estimatedCredits: null,
        estimatedCreditsSource: null,
        status: 'idle',
        statusMessage: 'Connect a video result and run to upscale it.',
        error: '',
        outputAssetIds: [],
        dependencyStatus: 'unknown',
      }
    case FLOW_AI_NODE_TYPES.musicGen:
      return {
        label: 'Music',
        workflowId: getDefaultWorkflowId(type),
        tags: 'cinematic, pulsing, uplifting',
        lyrics: '',
        duration: 8,
        bpm: 120,
        keyscale: 'C Major',
        seed: randomSeed(),
        status: 'idle',
        statusMessage: '',
        error: '',
        outputAssetIds: [],
        dependencyStatus: 'unknown',
      }
    case FLOW_AI_NODE_TYPES.output:
      return {
        label: 'Asset Output',
        folderName: '',
        note: '',
        status: 'idle',
        statusMessage: 'Sends connected results to the Assets panel.',
        error: '',
        resolvedAssetIds: [],
      }
    default:
      return {
        label: getFlowNodeDefinition(type)?.label || 'Node',
        status: 'idle',
        statusMessage: '',
        error: '',
      }
  }
}

export function createFlowNode(type, options = {}) {
  const definition = getFlowNodeDefinition(type)
  if (!definition) {
    throw new Error(`Unknown CANVAS node type: ${type}`)
  }

  const node = {
    id: options.id || createNodeId(type.replace(/[^a-z0-9]+/gi, '_')),
    type,
    position: options.position || { x: 80, y: 80 },
    data: {
      muted: false,
      ...createBaseNodeData(type),
      ...options.data,
    },
  }
  if (options.style && typeof options.style === 'object') node.style = { ...options.style }
  return node
}

export function createFlowEdge(options = {}) {
  return {
    id: options.id || createEdgeId(),
    source: options.source,
    target: options.target,
    sourceHandle: options.sourceHandle || null,
    targetHandle: options.targetHandle || null,
    animated: false,
  }
}

function buildBlankTemplate() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: 120 },
    data: {
      basePrompt: 'Cinematic composition, coherent subjects, natural lighting, and clean detail.',
      promptText: 'A cinematic hero frame with dramatic lighting.',
    },
  })
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 420, y: 100 },
    data: { label: 'Keyframe', workflowId: 'z-image-turbo' },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 760, y: 120 },
  })

  return {
    nodes: [promptNode, imageNode, outputNode],
    edges: [
      createFlowEdge({
        source: promptNode.id,
        sourceHandle: 'out:text',
        target: imageNode.id,
        targetHandle: 'in:text',
      }),
      createFlowEdge({
        source: imageNode.id,
        sourceHandle: 'out:image',
        target: outputNode.id,
        targetHandle: 'in:image',
      }),
    ],
  }
}

function buildTextToVideoTemplate() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: 120 },
    data: {
      basePrompt: 'Cinematic composition, coherent subject identity, natural lighting, physically plausible motion, and a continuous shot.',
      promptText: 'A superhero dog lands on a rooftop at sunset.',
    },
  })
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 420, y: 80 },
    data: { label: 'Keyframe', workflowId: 'z-image-turbo', width: 1280, height: 720 },
  })
  const videoNode = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 760, y: 80 },
    data: { label: 'Animate', workflowId: 'ltx23-i2v', duration: 5, fps: 24 },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1100, y: 120 },
  })

  return {
    nodes: [promptNode, imageNode, videoNode, outputNode],
    edges: [
      createFlowEdge({
        source: promptNode.id,
        sourceHandle: 'out:text',
        target: imageNode.id,
        targetHandle: 'in:text',
      }),
      createFlowEdge({
        source: promptNode.id,
        sourceHandle: 'out:text',
        target: videoNode.id,
        targetHandle: 'in:text',
      }),
      createFlowEdge({
        source: imageNode.id,
        sourceHandle: 'out:image',
        target: videoNode.id,
        targetHandle: 'in:image',
      }),
      createFlowEdge({
        source: videoNode.id,
        sourceHandle: 'out:video',
        target: outputNode.id,
        targetHandle: 'in:video',
      }),
    ],
  }
}

function buildGoogleImageTemplate() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 60, y: 90 },
    data: { basePrompt: '', promptText: 'A cinematic portrait with natural light and precise detail.' },
  })
  const referenceNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 60, y: 330 },
    data: { label: 'Optional reference image' },
  })
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 450, y: 120 },
    data: { label: 'Nano Banana 2 Lite', workflowId: 'google-nano-banana-lite', width: 1024, height: 1024, variantCount: 1 },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 820, y: 140 },
    data: { folderName: 'Google Gemini Images' },
  })
  return {
    nodes: [promptNode, referenceNode, imageNode, outputNode],
    edges: [
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: imageNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: referenceNode.id, sourceHandle: 'out:image', target: imageNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: imageNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildGoogleVideoTemplate() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 60, y: 90 },
    data: { basePrompt: '', promptText: 'A cinematic continuous shot with natural motion and synchronized ambience.' },
  })
  const startFrameNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 60, y: 330 },
    data: { label: 'Optional start frame' },
  })
  const videoNode = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 450, y: 120 },
    data: { label: 'Veo 3.1 Lite', workflowId: 'google-veo-3-1-lite', width: 1280, height: 720, duration: 4, fps: 24 },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 820, y: 140 },
    data: { folderName: 'Google Gemini Videos' },
  })
  return {
    nodes: [promptNode, startFrameNode, videoNode, outputNode],
    edges: [
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: videoNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: startFrameNode.id, sourceHandle: 'out:image', target: videoNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: videoNode.id, sourceHandle: 'out:video', target: outputNode.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildAnimaLoraUpscaleTemplate() {
  const checkpointNode = createFlowNode(FLOW_AI_NODE_TYPES.workflowControl, {
    position: { x: 40, y: 40 },
    style: { width: 310, height: 180 },
    data: { label: 'Load Checkpoint', controlKind: 'checkpoint', checkpointName: '' },
  })
  const upscaleNode = createFlowNode(FLOW_AI_NODE_TYPES.workflowControl, {
    position: { x: 40, y: 230 },
    style: { width: 310, height: 180 },
    data: {
      label: 'Image Upscale', controlKind: 'upscale', upscaleEnabled: false,
      upscaleModel: 'RealESRGAN\\RealESRGAN_x4plus.pth',
    },
  })
  const loraNode = createFlowNode(FLOW_AI_NODE_TYPES.workflowControl, {
    position: { x: 40, y: 420 },
    style: { width: 330, height: 350 },
    data: {
      label: 'Multi-LoRA', controlKind: 'lora-stack',
      loras: Array.from({ length: 5 }, () => ({ enabled: false, name: '', strength: 1 })),
    },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 380, y: 40 },
    style: { width: 320, height: 200 },
    data: {
      label: 'Positive Prompt',
      promptRole: 'anima-positive',
      basePrompt: 'masterpiece, best quality, amazing quality, detailed eyes, dynamic lighting, depth of field',
      promptText: '',
      promptPlaceholder: 'Describe the character, pose, costume, and setting.',
    },
  })
  const negativeNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 380, y: 260 },
    style: { width: 320, height: 200 },
    data: {
      label: 'Negative Prompt',
      promptRole: 'anima-negative',
      basePrompt: 'ugly, bad, wrong, low quality, monochrome, simple background, worst quality, lowres, blurry, jpeg artifacts, bad anatomy, watermark, artist name',
      promptText: '',
      promptPlaceholder: 'Add exclusions specific to this image.',
    },
  })
  const sizeNode = createFlowNode(FLOW_AI_NODE_TYPES.workflowControl, {
    position: { x: 380, y: 480 },
    style: { width: 320, height: 190 },
    data: { label: 'Image Size', controlKind: 'image-size', width: 768, height: 1280 },
  })
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 730, y: 140 },
    style: { width: 330, height: 330 },
    data: {
      label: 'RES4LYF Sampler',
      workflowId: 'anima-lora-upscale',
      steps: 15,
      cfg: 5,
      eta: 0.5,
      denoise: 1,
      samplerName: 'exponential/res_2s',
      scheduler: 'karras',
      samplerMode: 'standard',
      bongmath: true,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1090, y: 180 },
    data: { label: 'ANIMA Images', folderName: 'ANIMA Multi-LoRA' },
  })
  return {
    nodes: [checkpointNode, upscaleNode, loraNode, promptNode, negativeNode, sizeNode, imageNode, outputNode],
    edges: [
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: imageNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: negativeNode.id, sourceHandle: 'out:text', target: imageNode.id, targetHandle: 'in:negative-text' }),
      createFlowEdge({ source: checkpointNode.id, sourceHandle: 'out:control', target: imageNode.id, targetHandle: 'in:control' }),
      createFlowEdge({ source: upscaleNode.id, sourceHandle: 'out:control', target: imageNode.id, targetHandle: 'in:control' }),
      createFlowEdge({ source: loraNode.id, sourceHandle: 'out:control', target: imageNode.id, targetHandle: 'in:control' }),
      createFlowEdge({ source: sizeNode.id, sourceHandle: 'out:control', target: imageNode.id, targetHandle: 'in:control' }),
      createFlowEdge({ source: imageNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildMusicTemplate() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: 120 },
    data: { label: 'Lyrics', basePrompt: '', promptText: 'Rise up, lights on, city in motion, we are not done yet.' },
  })
  const musicNode = createFlowNode(FLOW_AI_NODE_TYPES.musicGen, {
    position: { x: 420, y: 100 },
    data: { label: 'Cue', duration: 16, bpm: 118 },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 760, y: 120 },
  })

  return {
    nodes: [promptNode, musicNode, outputNode],
    edges: [
      createFlowEdge({
        source: promptNode.id,
        sourceHandle: 'out:text',
        target: musicNode.id,
        targetHandle: 'in:text',
      }),
      createFlowEdge({
        source: musicNode.id,
        sourceHandle: 'out:audio',
        target: outputNode.id,
        targetHandle: 'in:audio',
      }),
    ],
  }
}

function buildQwenImage21HereticTemplate() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: 100 },
    style: { width: 360, height: 250 },
    data: {
      label: 'Prompt / プロンプト',
      basePrompt: '',
      promptText: 'デフォルメされたキャラクターの全身イラスト。正面向き、輪郭が明瞭で高精細。',
      promptPlaceholder: '生成したい画像を日本語または英語で記述します。',
      acceptsPromptControls: true,
    },
  })
  const outputNote = createFlowNode(FLOW_AI_NODE_TYPES.workflowControl, {
    position: { x: 70, y: 410 },
    style: { width: 360, height: 220 },
    data: {
      label: '出力ノート / Output Note',
      controlKind: 'transparent-png',
      transparentPng: false,
      note: '透過PNGをONにすると、実行時にRGBA・アルファチャンネル・透過背景の定型指示をプロンプトへ自動追加します。保存形式はPNGです。',
    },
  })
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 520, y: 170 },
    style: { width: 350, height: 360 },
    data: {
      label: 'Qwen Image 2.1 Heretic',
      workflowId: 'qwen-image-2-1-heretic',
      width: 1024,
      height: 1024,
      steps: 25,
      cfg: 1,
      samplerName: 'euler',
      scheduler: 'simple',
      negativePrompt: '',
      variantCount: 1,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 950, y: 220 },
    data: { label: 'PNG Output', folderName: 'Qwen Image 2.1' },
  })

  return {
    nodes: [promptNode, outputNote, imageNode, outputNode],
    edges: [
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: imageNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: outputNote.id, sourceHandle: 'out:control', target: promptNode.id, targetHandle: 'in:control' }),
      createFlowEdge({ source: imageNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildQwenImage21NsfwLoraTemplate() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: 110 },
    style: { width: 390, height: 300 },
    data: {
      label: 'Adult Prompt / 成人向けプロンプト',
      basePrompt: '',
      promptText: 'An intimate cinematic portrait of consenting adult partners, realistic anatomy, natural skin texture, detailed lighting.',
      promptPlaceholder: '成人のみを対象に、生成したい画像を日本語または英語で記述します。',
    },
  })
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 550, y: 140 },
    style: { width: 360, height: 390 },
    data: {
      label: 'Qwen Image 2.1 NSFW LoRA',
      workflowId: 'qwen-image-2-1-nsfw-lora',
      width: 832,
      height: 1248,
      steps: 25,
      cfg: 1,
      samplerName: 'er_sde',
      scheduler: 'beta',
      negativePrompt: '',
      variantCount: 1,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 990, y: 230 },
    data: { label: 'NSFW PNG Output', folderName: 'NSFW - Qwen Image 2.1 LoRA' },
  })

  return {
    nodes: [promptNode, imageNode, outputNode],
    edges: [
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: imageNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: imageNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildQwenImage21HereticEditTemplate() {
  const inputNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 80 },
    data: {
      label: '編集元画像 / Edit Target (image_1)',
      assetRole: 'edit-target',
      acceptedAssetTypes: ['image'],
    },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: 300 },
    style: { width: 380, height: 250 },
    data: {
      label: '編集指示 / Edit Prompt',
      basePrompt: '',
      promptText: '<image1>の被写体と構図を保ちながら、服装を変更する。',
      promptPlaceholder: 'image_1への変更内容を日本語または英語で記述します。',
      acceptsPromptControls: true,
    },
  })
  const outputNote = createFlowNode(FLOW_AI_NODE_TYPES.workflowControl, {
    position: { x: 70, y: 600 },
    style: { width: 380, height: 220 },
    data: {
      label: '出力ノート / Output Note',
      controlKind: 'transparent-png',
      transparentPng: false,
      note: '透過PNGをONにすると、編集指示へRGBA・アルファチャンネル・透過背景の定型文を実行時だけ追加します。OFFでは元画像の背景を含む通常編集です。',
    },
  })
  const editNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 540, y: 220 },
    style: { width: 360, height: 360 },
    data: {
      label: 'Qwen Image 2.1 Heretic Edit',
      workflowId: 'qwen-image-2-1-heretic-edit',
      resolution: 1024,
      steps: 25,
      cfg: 1,
      samplerName: 'euler',
      scheduler: 'simple',
      negativePrompt: '',
      variantCount: 1,
      preserveInputResolution: true,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 990, y: 280 },
    data: { label: 'Edited PNG Output', folderName: 'Qwen Image 2.1 Edits' },
  })

  return {
    nodes: [inputNode, promptNode, outputNote, editNode, outputNode],
    edges: [
      createFlowEdge({ source: inputNode.id, sourceHandle: 'out:image', target: editNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: editNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: outputNote.id, sourceHandle: 'out:control', target: promptNode.id, targetHandle: 'in:control' }),
      createFlowEdge({ source: editNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildQwenImage21CharacterSheetTemplate() {
  const inputNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 110 },
    data: {
      label: 'キャラクター参照画像 / Character Reference',
      assetRole: 'character-sheet-source',
      acceptedAssetTypes: ['image'],
    },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: 390 },
    style: { width: 430, height: 380 },
    data: {
      label: 'キャラクター名・追加指示 / Name & Direction',
      basePrompt: 'Use <image1> as the sole identity and design source. Create a polished production character design sheet in a 3:2 landscape composition on warm off-white paper. Preserve the exact face, hairstyle, body proportions, clothing, colors, materials, accessories, markings, asymmetries, and original rendering medium. Include one dominant full-body hero view; front, side, and back turnaround views at identical scale; three action or camera-angle studies; three readable silhouettes; three expression studies; and six close-up detail tiles for the most identity-critical facial, hair, costume, accessory, and material features. Use thin dividers, restrained typography, short legible English labels, and a coherent closed palette derived from the reference. Keep all views anatomically complete and consistent. Do not redesign, beautify, age-shift, simplify, add accessories, duplicate limbs, merge views, overlap panels, or add logos and watermarks.',
      promptText: 'Character name: CHARACTER. Keep the reference image\'s visual style and make every view useful as a downstream image/video identity reference.',
      promptPlaceholder: 'キャラクター名と、シートへ加えたい指示を入力します。',
    },
  })
  const sheetNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 570, y: 230 },
    style: { width: 380, height: 390 },
    data: {
      label: 'QWENキャラクターシート',
      workflowId: 'qwen-image-2-1-character-sheet',
      width: 2240,
      height: 1504,
      resolution: 1536,
      steps: 25,
      cfg: 1,
      samplerName: 'res_2m',
      scheduler: 'beta',
      negativePrompt: '',
      variantCount: 1,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1030, y: 300 },
    data: { label: 'QWEN Character Sheet Output', folderName: 'QWEN Character Sheets' },
  })

  return {
    nodes: [inputNode, promptNode, sheetNode, outputNode],
    edges: [
      createFlowEdge({ source: inputNode.id, sourceHandle: 'out:image', target: sheetNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: sheetNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: sheetNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildCharacterReferenceEditTemplate() {
  const primaryNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 40 },
    data: {
      label: 'Character Reference 1 (required)',
      labelKey: 'canvas.characterReferenceEdit.primary',
      assetRole: 'character-reference-primary',
      acceptedAssetTypes: ['image'],
    },
  })
  const additionalReferences = Array.from({ length: 5 }, (_, index) => {
    const referenceNumber = index + 2
    const column = referenceNumber <= 3 ? 70 : 350
    const row = referenceNumber <= 3 ? referenceNumber - 2 : referenceNumber - 4
    return createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
      position: { x: column, y: 230 + row * 190 },
      data: {
        label: `Reference ${referenceNumber}: Clothing / Accessory (optional)`,
        labelKey: `canvas.characterReferenceEdit.reference${referenceNumber}`,
        assetRole: `character-reference-${referenceNumber}`,
      },
    })
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 650, y: 40 },
    style: { width: 340, height: 230 },
    data: {
      label: 'Requested Change',
      labelKey: 'canvas.characterReferenceEdit.prompt',
      basePrompt: 'Picture 1 is Reference 1 and defines the exact character identity and the base image to edit. Pictures 2 and 3, when present, are numbered reference sheets; the visible REFERENCE 2 through REFERENCE 6 labels identify each separate source image. When the user names Reference N or 参照N, use only that numbered panel for the requested clothing, accessory, prop, color, material, or design detail. Preserve Reference 1 facial identity, facial structure, eyes, hairstyle, distinctive features, age, body proportions, pose, and composition unless the user explicitly requests a change. Transfer only the requested elements from References 2–6 onto the character from Reference 1. Do not copy another person, face, body, pose, background, or unrequested garment from the additional references. Do not duplicate the character or retain old clothing that conflicts with the requested outfit.',
      promptText: '',
      promptPlaceholder: 'Example: Apply the jacket from Reference 2, the bag from Reference 4, and the hat from Reference 6 to the character in Reference 1.',
      promptPlaceholderKey: 'canvas.characterReferenceEdit.promptPlaceholder',
    },
  })
  const editNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 1030, y: 170 },
    style: { width: 330, height: 300 },
    data: {
      label: 'Character Edit',
      labelKey: 'canvas.characterReferenceEdit.generator',
      workflowId: 'image-edit',
      preserveInputResolution: true,
      variantCount: 1,
      referencePacking: 'numbered-six',
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1400, y: 210 },
    data: {
      label: 'Character Variations',
      labelKey: 'canvas.characterReferenceEdit.output',
      folderName: 'Character Reference Edits',
    },
  })

  return {
    nodes: [primaryNode, ...additionalReferences, promptNode, editNode, outputNode],
    edges: [
      createFlowEdge({ source: primaryNode.id, sourceHandle: 'out:image', target: editNode.id, targetHandle: 'in:image' }),
      ...additionalReferences.map(referenceNode => createFlowEdge({ source: referenceNode.id, sourceHandle: 'out:image', target: editNode.id, targetHandle: 'in:style' })),
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: editNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: editNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildDarkBeastKrea2I2ITemplate() {
  const inputNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 80, y: 150 },
    data: {
      label: 'Adult Source Image (optional)',
      acceptedAssetTypes: ['image'],
      assetRole: 'dark-beast-source',
    },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: -70 },
    style: { width: 350, height: 200 },
    data: {
      label: 'NSFW Generation / Edit Prompt',
      basePrompt: 'Generate only clearly fictional adult subjects with coherent anatomy and detail. Follow the requested subject, clothing, accessories, styling, lighting, composition, and scene. When a source image is connected, preserve its recognizable identity, pose, composition, and background unless explicitly changed.',
      promptText: '',
      promptPlaceholder: 'Describe the image to generate. Optionally connect a source image; keep denoise low for stronger source preservation.',
    },
  })
  const editNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 500, y: 80 },
    style: { width: 350, height: 360 },
    data: {
      label: 'Dark Beast KREA 2 T2I / I2I',
      workflowId: 'dark-beast-krea2-i2i',
      width: 960,
      height: 1440,
      steps: 16,
      cfg: 1,
      denoise: 0.55,
      samplerName: 'euler',
      scheduler: 'simple',
      variantCount: 1,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 920, y: 150 },
    data: { label: 'Dark Beast Result', folderName: 'NSFW - Dark Beast KREA 2' },
  })

  return {
    nodes: [inputNode, promptNode, editNode, outputNode],
    edges: [
      createFlowEdge({ source: inputNode.id, sourceHandle: 'out:image', target: editNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: editNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: editNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildHarukiMixKrea2Template() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: 100 },
    style: { width: 390, height: 300 },
    data: {
      label: 'HARUKI_MIX Prompt / プロンプト',
      basePrompt: 'Generate only clearly fictional adult characters. Favor photorealistic detail, coherent anatomy, natural skin texture, believable lighting, and a single well-composed image.',
      promptText: 'A fictional adult Japanese woman in a cinematic interior portrait, natural expression, detailed lighting.',
      promptPlaceholder: '架空の成人キャラクター、構図、服装、場面、成人向け表現を日本語または英語で記述します。',
    },
  })
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 560, y: 120 },
    style: { width: 360, height: 390 },
    data: {
      label: 'HARUKI_MIX KR2 V2.0',
      workflowId: 'haruki-mix-krea2-t2i',
      width: 816,
      height: 1104,
      steps: 8,
      cfg: 1,
      samplerName: 'euler',
      scheduler: 'simple',
      variantCount: 1,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1000, y: 210 },
    data: { label: 'HARUKI_MIX Output', folderName: 'NSFW - HARUKI_MIX Krea 2' },
  })

  return {
    nodes: [promptNode, imageNode, outputNode],
    edges: [
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: imageNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: imageNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildNsfwWan13bE10Template() {
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: 80 },
    style: { width: 400, height: 320 },
    data: {
      label: 'Wan 1.3B e10 Prompt / プロンプト',
      basePrompt: 'Fictional consenting adults only. Keep anatomy, motion, lighting, and temporal continuity coherent. Describe a single short shot with clear subject action and camera movement.',
      promptText: 'A cinematic shot of fictional consenting adult partners, natural coherent motion, realistic anatomy, detailed lighting.',
      promptPlaceholder: '架空の成人のみを対象に、場面・動作・カメラワークを日本語または英語で記述します。',
    },
  })
  const videoNode = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 570, y: 110 },
    style: { width: 370, height: 420 },
    data: {
      label: 'NSFW Wan 1.3B e10 T2V',
      workflowId: 'nsfw-wan-1-3b-e10-t2v',
      width: 832,
      height: 480,
      duration: 5,
      fps: 16,
      steps: 30,
      cfg: 6,
      samplerName: 'uni_pc',
      scheduler: 'simple',
      negativePrompt: 'overexposed, static, blurred details, subtitles, painting, worst quality, low quality, jpeg artifacts, distorted anatomy, malformed hands, malformed face, extra limbs, fused fingers, frozen frame, cluttered background',
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1030, y: 210 },
    data: { label: 'Wan e10 Video Output', folderName: 'NSFW - Wan 1.3B e10' },
  })

  return {
    nodes: [promptNode, videoNode, outputNode],
    edges: [
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: videoNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: videoNode.id, sourceHandle: 'out:video', target: outputNode.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildCharacterSheetTemplate() {
  const primaryNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 80 },
    data: { label: 'Primary Character' },
  })
  const referenceTwoNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 250 },
    data: { label: 'Reference 2 (optional)' },
  })
  const referenceThreeNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 420 },
    data: { label: 'Reference 3 (optional)' },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: -110 },
    data: {
      label: 'Character Notes',
      basePrompt: 'Keep the character identity, clothing, proportions, colors, and accessories consistent across every view. Produce a clean four-panel character turnaround.',
      promptText: '',
      promptPlaceholder: 'Add expressions, costume details, or turnaround requirements.',
    },
  })
  const generatorNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 450, y: 150 },
    data: {
      label: 'H3 Character Sheet',
      workflowId: 'minimax-h3-character-sheet',
      width: 480,
      height: 864,
      variantCount: 1,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 820, y: 190 },
  })

  return {
    nodes: [primaryNode, referenceTwoNode, referenceThreeNode, promptNode, generatorNode, outputNode],
    edges: [
      createFlowEdge({ source: primaryNode.id, sourceHandle: 'out:image', target: generatorNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: referenceTwoNode.id, sourceHandle: 'out:image', target: generatorNode.id, targetHandle: 'in:style' }),
      createFlowEdge({ source: referenceThreeNode.id, sourceHandle: 'out:image', target: generatorNode.id, targetHandle: 'in:style' }),
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: generatorNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: generatorNode.id, sourceHandle: 'out:image', target: outputNode.id, targetHandle: 'in:image' }),
    ],
  }
}

function buildLoraDatasetTemplate(factory = 'anima') {
  const sourceNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 120 },
    data: { label: 'Character Source Image', datasetRole: 'source' },
  })
  const inpaintPromptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: -110 },
    data: {
      label: 'Inpaint Prompt (optional)',
      basePrompt: 'Replace only the masked area while preserving character identity and every unmasked detail.',
      promptText: '',
      promptPlaceholder: 'Describe the logo, prop, clothing, or design to add.',
      excludeFromDatasetExport: true,
    },
  })
  const inpaintMaskNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 350 },
    data: {
      label: 'Inpaint Mask (optional)',
      assetRole: 'mask',
      excludeFromDatasetExport: true,
      statusMessage: 'Choose a black-and-white mask. White areas will be replaced.',
    },
  })
  const inpaintReferenceNode = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
    position: { x: 70, y: 580 },
    data: {
      label: 'Inpaint Reference (optional)',
      excludeFromDatasetExport: true,
    },
  })
  const inpaintNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 430, y: 170 },
    data: {
      label: 'Masked Inpaint Edit (optional)',
      workflowId: 'image-edit',
      width: 1024,
      height: 1024,
      variantCount: 1,
      enabled: false,
      optionalStage: 'inpaint',
      preserveInputResolution: true,
      datasetRole: 'source-transform',
      statusMessage: 'Off — the original character image will pass through unchanged.',
    },
  })
  const angleNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 790, y: 170 },
    data: {
      label: 'Generate 8 Camera Angles',
      workflowId: 'multi-angles',
      width: 1024,
      height: 1024,
      variantCount: 1,
    },
  })
  const factoryLabel = factory === 'sdxl' ? 'SDXL' : 'Anima'
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1150, y: 190 },
    data: {
      label: `${factoryLabel} Training Images`,
      folderName: `LoRA Training Sets - ${factoryLabel}`,
      numberedRunFolders: true,
    },
  })

  return {
    nodes: [sourceNode, inpaintPromptNode, inpaintMaskNode, inpaintReferenceNode, inpaintNode, angleNode, outputNode],
    edges: [
      createFlowEdge({
        source: sourceNode.id,
        sourceHandle: 'out:image',
        target: inpaintNode.id,
        targetHandle: 'in:image',
      }),
      createFlowEdge({
        source: inpaintPromptNode.id,
        sourceHandle: 'out:text',
        target: inpaintNode.id,
        targetHandle: 'in:text',
      }),
      createFlowEdge({
        source: inpaintMaskNode.id,
        sourceHandle: 'out:image',
        target: inpaintNode.id,
        targetHandle: 'in:mask',
      }),
      createFlowEdge({
        source: inpaintReferenceNode.id,
        sourceHandle: 'out:image',
        target: inpaintNode.id,
        targetHandle: 'in:style',
      }),
      createFlowEdge({
        source: inpaintNode.id,
        sourceHandle: 'out:image',
        target: angleNode.id,
        targetHandle: 'in:image',
      }),
      createFlowEdge({
        source: angleNode.id,
        sourceHandle: 'out:image',
        target: outputNode.id,
        targetHandle: 'in:image',
      }),
    ],
  }
}

function buildImageToVideoTemplate() {
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 80, y: 160 },
    data: { label: 'Source Image' },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: 20 },
    data: {
      label: 'Motion + Audio Prompt',
      basePrompt: 'Cinematic natural motion. Preserve the subject identity and composition. Keep anatomy and temporal continuity stable. Generate synchronized native audio with natural environmental ambience.',
      promptText: 'The subject performs a subtle, natural movement.',
      promptPlaceholder: 'Describe only the action, performance, camera movement, and desired sound.',
    },
  })
  const videoNode = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 430, y: 100 },
    data: {
      label: 'MiniMax H3 Fused Turbo + SLA',
      workflowId: 'minimax-h3-gguf-i2v',
      width: 1152,
      height: 640,
      duration: 5,
      fps: 24,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 790, y: 140 },
  })

  return {
    nodes: [imageNode, promptNode, videoNode, outputNode],
    edges: [
      createFlowEdge({
        source: imageNode.id,
        sourceHandle: 'out:image',
        target: videoNode.id,
        targetHandle: 'in:image',
      }),
      createFlowEdge({
        source: promptNode.id,
        sourceHandle: 'out:text',
        target: videoNode.id,
        targetHandle: 'in:text',
      }),
      createFlowEdge({
        source: videoNode.id,
        sourceHandle: 'out:video',
        target: outputNode.id,
        targetHandle: 'in:video',
      }),
    ],
  }
}

function buildAinvfxFluidTemplate() {
  const template = buildStartLastFrameVideoTemplate()
  const [first, last, prompt, video, output] = template.nodes
  first.position = { x: 40, y: 120 }
  last.position = { x: 40, y: 500 }
  prompt.position = { x: 420, y: -160 }
  video.position = { x: 420, y: 160 }
  output.position = { x: 820, y: 200 }
  Object.assign(first.data, { label: 'Paint first frame', labelKey: 'canvas.fluid.first', assetRole: 'fluid-keyframe' })
  Object.assign(last.data, { label: 'Paint last frame', labelKey: 'canvas.fluid.last', assetRole: 'fluid-keyframe' })
  Object.assign(prompt.data, { label: 'Smoke / Steam / Fire', labelKey: 'canvas.fluid.prompt', basePrompt: 'ainvfxfluid', promptText: 'smoke plume', promptPlaceholder: 'Describe the smoke, steam, or fire behavior.' })
  Object.assign(video.data, { label: 'AInVFX Fluid', labelKey: 'canvas.fluid.generator', workflowId: 'ainvfx-fluid', width: 512, height: 512, fps: 25, duration: 121 / 25, seed: 42, fluidStrength: 1, negativePrompt: 'blurry, low quality, distorted, watermark' })
  Object.assign(output.data, { label: 'VFX Takes', labelKey: 'canvas.fluid.output', folderName: 'AInVFX Fluid' })
  return template
}

function buildStartLastFrameVideoTemplate() {
  const startNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 80, y: 100 },
    data: { label: 'Start Frame' },
  })
  const lastNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 80, y: 300 },
    data: { label: 'Last Frame' },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: -80 },
    data: {
      label: 'Motion + Audio Prompt',
      basePrompt: 'Create a smooth, physically coherent transition from the start frame to the last frame. Preserve subject identity and scene continuity. Generate synchronized native audio with natural environmental ambience.',
      promptText: 'Natural movement connects the two frames.',
      promptPlaceholder: 'Describe the performance, transition, camera movement, and sound.',
    },
  })
  const videoNode = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 440, y: 120 },
    data: {
      label: 'MiniMax H3 Start / Last',
      workflowId: 'minimax-h3-gguf-i2v',
      width: 608,
      height: 352,
      duration: 5,
      fps: 24,
      requiresLastFrame: true,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 800, y: 160 },
  })

  return {
    nodes: [startNode, lastNode, promptNode, videoNode, outputNode],
    edges: [
      createFlowEdge({
        source: startNode.id,
        sourceHandle: 'out:image',
        target: videoNode.id,
        targetHandle: 'in:image',
      }),
      createFlowEdge({
        source: lastNode.id,
        sourceHandle: 'out:image',
        target: videoNode.id,
        targetHandle: 'in:last-image',
      }),
      createFlowEdge({
        source: promptNode.id,
        sourceHandle: 'out:text',
        target: videoNode.id,
        targetHandle: 'in:text',
      }),
      createFlowEdge({
        source: videoNode.id,
        sourceHandle: 'out:video',
        target: outputNode.id,
        targetHandle: 'in:video',
      }),
    ],
  }
}

function buildMinimaxH3360OrbitTemplate() {
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 60, y: 230 },
    data: { label: 'Frozen Scene / 静止シーン', assetRole: 'orbit-source' },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 60, y: -120 },
    style: { width: 390, height: 300 },
    data: {
      label: 'Publisher 360 Orbit Prompt',
      basePrompt: 'One frozen instant. Only the camera moves. In a continuous 360 orbit. Preserve every person and object in exactly the same world position, orientation, shape and pose throughout the shot. Airborne objects remain suspended at the captured height and angle: no wobbling, shaking, spinning, drifting, falling or continued action. Keep faces, hands, clothing, liquids and the background motionless while retaining their natural appearance. Camera parallax is the only source of apparent movement. No cuts, zoom, morphing or added objects.',
      promptText: '',
      promptPlaceholder: 'Keep the publisher prompt unchanged for the trained behavior.',
      note: 'Best results: one human-centered square image. The same image is used internally for the first and last frame.',
    },
  })
  const videoNode = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 500, y: 80 },
    data: {
      label: 'H3バレットタイム（固定レシピ）',
      workflowId: 'minimax-h3-360-orbit',
      width: 768,
      height: 768,
      duration: 73 / 24,
      fps: 24,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 860, y: 120 },
    data: { label: 'H3バレットタイム', folderName: 'H3バレットタイム' },
  })

  return {
    nodes: [imageNode, promptNode, videoNode, outputNode],
    edges: [
      createFlowEdge({ source: imageNode.id, sourceHandle: 'out:image', target: videoNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: videoNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: videoNode.id, sourceHandle: 'out:video', target: outputNode.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildMinimaxH3HandheldTemplate() {
  const imageNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 60, y: 320 },
    data: { label: 'Optional Start Frame / 任意の開始画像', assetRole: 'handheld-start' },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 60, y: -100 },
    style: { width: 400, height: 320 },
    data: {
      label: 'Handheld Shot Prompt',
      basePrompt: 'Natural documentary realism. Subtle handheld shake and organic operator micro-movements throughout one continuous shot.',
      promptText: 'A candid subject moves naturally through the scene while the framing follows at human shoulder height. Audio: realistic location ambience.',
      promptPlaceholder: 'Describe the subject, action, framing, and sound. “camera” can materialize as an object, so omit it when unnecessary.',
      note: 'The start image is optional. Strength 1.7 is fixed to the publisher showcase setting; other LoRAs are not stacked.',
    },
  })
  const videoNode = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 510, y: 90 },
    data: {
      label: 'H3ハンドヘルドカメラ',
      workflowId: 'minimax-h3-handheld',
      width: 640,
      height: 480,
      duration: 3.75,
      fps: 24,
    },
  })
  const outputNode = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 870, y: 130 },
    data: { label: 'Handheld Video', folderName: 'H3ハンドヘルドカメラ' },
  })
  return {
    nodes: [imageNode, promptNode, videoNode, outputNode],
    edges: [
      createFlowEdge({ source: imageNode.id, sourceHandle: 'out:image', target: videoNode.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: videoNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: videoNode.id, sourceHandle: 'out:video', target: outputNode.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildVdnH3Template() {
  const prompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: 100 },
    data: {
      basePrompt: 'Live-action cinematic drama. Natural facial expressions, coherent motion, stable anatomy, continuous single shot, and synchronized native audio.',
      promptText: 'An adult traveler pauses beside a rain-streaked cafe window at dusk. The camera slowly tracks closer as they turn toward the street. Audio: quiet rain, distant traffic and soft footsteps.',
      promptPlaceholder: 'Describe the scene, performance, camera movement, and sound.',
    },
  })
  const video = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 450, y: 100 },
    data: { label: 'VDN-H3 8step', workflowId: 'vdn-h3-t2va', width: 608, height: 352, duration: 5, fps: 24 },
  })
  const output = createFlowNode(FLOW_AI_NODE_TYPES.output, { position: { x: 830, y: 100 } })
  return {
    nodes: [prompt, video, output],
    edges: [
      createFlowEdge({ source: prompt.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: video.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildFastH3Template() {
  const images = [0, 1].map(index => createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
    position: { x: 50, y: index * 300 },
    data: { label: 'Optional Reference Image', labelKey: 'canvas.fastH3.image' + (index + 1) },
  }))
  const audios = [0, 1].map(index => createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 400, y: index * 300 },
    data: { label: 'Optional Reference Audio', labelKey: 'canvas.fastH3.audio' + (index + 1), assetRole: 'reference-audio' },
  }))
  const prompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 740, y: -250 },
    data: {
      basePrompt: 'Anime cinematic scene. Smooth character animation, expressive eyes, clean linework, rich painted backgrounds, coherent motion, stable identity, and synchronized native audio.',
      promptText: 'A young adult traveler walks through a sunlit coastal town, hair and clothes moving gently in the breeze. The camera slowly tracks alongside. Audio: soft footsteps, wind and distant seabirds.',
      promptPlaceholder: 'Describe the character performance, setting, camera movement, and sound.',
    },
  })
  const video = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 750, y: 100 },
    data: { label: 'Fast MiniMax H3 T2VA', workflowId: 'fast-minimax-h3-t2va', width: 864, height: 480, duration: 5, fps: 24, fastH3Steps: 4 },
  })
  const output = createFlowNode(FLOW_AI_NODE_TYPES.output, { position: { x: 1120, y: 100 } })
  return {
    nodes: [...images, ...audios, prompt, video, output],
    edges: [
      ...images.map(node => createFlowEdge({ source: node.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style' })),
      ...audios.map(node => createFlowEdge({ source: node.id, sourceHandle: 'out:audio', target: video.id, targetHandle: 'in:voice' })),
      createFlowEdge({ source: prompt.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: video.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildReferenceVideoTemplate({ pink = false, afterMidnight = false, characterSwap = false } = {}) {
  const source = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 60, y: 100 },
    data: { label: 'Reference Video', labelKey: 'canvas.h3Reference.videoInput', assetRole: 'reference-video' },
  })
  const reference = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
    position: { x: 60, y: 410 },
    data: {
      label: characterSwap ? 'Replacement Character Image' : afterMidnight ? 'Subject Identity Image (Recommended)' : 'Optional Reference Image',
      labelKey: 'canvas.h3Reference.imageInput',
      ...(characterSwap ? { assetRole: 'character-swap-image' } : {}),
    },
  })
  const prompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 420, y: -220 },
    data: {
      label: characterSwap ? 'Target Person' : afterMidnight ? 'Generation Content' : 'Performance / Scene Direction',
      ...(afterMidnight ? {
        labelKey: 'canvas.h3Reference.contentPrompt',
        promptRole: 'aftermidnight-content',
        promptPlaceholderKey: 'canvas.h3Reference.contentPromptPlaceholder',
      } : {}),
      basePrompt: characterSwap
        ? 'Replace only the selected person in <Video 1> with the character from <Picture 1>. Preserve the replacement character\'s identity, outfit, and visual style. Preserve the source camera, background, lighting, objects, other people, motion, position, scale, pose, and timing. Do not show the reference image background or a character-sheet layout.'
        : afterMidnight
        ? 'Replace the primary subject in <Video 1> with the subject from <Picture 1>. Preserve <Picture 1>\'s face, hair, body, clothing, and visual identity consistently in every frame. Use <Video 1> only for motion, pose, timing, interaction, and camera movement; do not copy the original subject\'s appearance. Perform the referenced action naturally and coherently. Render a coherent scene with stable anatomy and synchronized native audio.'
        : pink
        ? 'Use <Picture 1> as the subject identity, face, hair, body, clothing, and appearance reference. Use <Video 1> only for motion, timing, pose, interaction, and camera movement. Do not preserve the original video subject\'s appearance. Maintain stable anatomy and generate synchronized native audio.'
        : 'Use <Video 1> as the motion, timing, pose, interaction, and camera reference. Re-render the scene with coherent motion, natural lighting, stable anatomy, and synchronized native audio.',
      promptText: characterSwap ? 'Replace the main person.' : afterMidnight ? '1girl, adult, naked' : 'Perform the referenced action naturally and coherently.',
      promptPlaceholder: characterSwap
        ? 'Identify the person to replace, for example: Replace the woman in the red coat.'
        : afterMidnight
        ? 'Describe only the subjects, appearance, scene, action, and sound you want to generate.'
        : 'Describe only the desired performance, scene changes, camera direction, and sound.',
    },
  })
  const video = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 440, y: 120 },
    data: {
      label: characterSwap ? 'H3 Character Swap' : afterMidnight ? 'AfterMidnightR2V' : pink ? 'H3 PinkFluffy Reference Video' : 'MiniMax H3 Ref2VA GGUF', labelKey: 'canvas.h3Reference.generator',
      workflowId: characterSwap ? 'minimax-h3-character-swap' : afterMidnight ? 'minimax-h3-aftermidnight-r2v' : pink ? 'minimax-h3-pink-reference' : 'minimax-h3-gguf-r2v', width: 608, height: 352, duration: 5, fps: 24,
      referenceStart: 0, referenceDuration: 5, useReferenceAudio: false,
      useSageAttention: characterSwap ? false : true,
    },
  })
  const output = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 820, y: 140 },
    data: characterSwap
      ? { label: 'Character Swap Output', folderName: 'MiniMax H3 Character Swap' }
      : afterMidnight
      ? { label: 'AfterMidnightR2V Output', folderName: 'NSFW - AfterMidnightR2V' }
      : pink ? { label: 'NSFW PinkFluffy Reference Output', folderName: 'NSFW - MiniMax H3 PinkFluffy Reference' } : {},
  })
  return {
    nodes: [source, reference, prompt, video, output],
    edges: [
      createFlowEdge({ source: source.id, sourceHandle: 'out:video', target: video.id, targetHandle: 'in:video' }),
      createFlowEdge({ source: reference.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style' }),
      createFlowEdge({ source: prompt.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: video.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildH3CharacterBuilderTemplate() {
  const faceA = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, { position: { x: 30, y: 20 }, data: { label: 'Face Reference 1', assetRole: 'character-face' } })
  const faceB = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, { position: { x: 30, y: 260 }, data: { label: 'Face Reference 2 (Optional)', assetRole: 'character-face' } })
  const body = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, { position: { x: 30, y: 500 }, data: { label: 'Body Reference (Optional)', assetRole: 'character-body' } })
  const cloth = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, { position: { x: 30, y: 740 }, data: { label: 'Clothing Reference (Optional)', assetRole: 'character-cloth' } })
  const description = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 360, y: 30 },
    data: { label: 'Locked Character Description', basePrompt: '', promptText: 'Describe the fixed face, hair, body proportions, clothing, colors, and distinguishing details.' },
  })
  const character = createFlowNode(FLOW_AI_NODE_TYPES.characterBuilder, {
    position: { x: 700, y: 220 }, data: { label: 'Create .char Actor', characterName: 'My Character' },
  })
  return {
    nodes: [faceA, faceB, body, cloth, description, character],
    edges: [
      createFlowEdge({ source: faceA.id, sourceHandle: 'out:image', target: character.id, targetHandle: 'in:face' }),
      createFlowEdge({ source: faceB.id, sourceHandle: 'out:image', target: character.id, targetHandle: 'in:face' }),
      createFlowEdge({ source: body.id, sourceHandle: 'out:image', target: character.id, targetHandle: 'in:body' }),
      createFlowEdge({ source: cloth.id, sourceHandle: 'out:image', target: character.id, targetHandle: 'in:cloth' }),
      createFlowEdge({ source: description.id, sourceHandle: 'out:text', target: character.id, targetHandle: 'in:text' }),
    ],
  }
}

function buildH3CharacterActorTemplate() {
  const character = createFlowNode(FLOW_AI_NODE_TYPES.characterInput, {
    position: { x: 40, y: 180 }, data: { label: 'Character File (.char)' },
  })
  const shot = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 40, y: -100 }, data: { label: 'Shot Prompt', basePrompt: '', promptText: 'The character walks naturally into frame. Cinematic camera movement and synchronized native audio.' },
  })
  const video = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 430, y: 100 },
    data: { label: 'H3 Fixed Characte (.char) movie', workflowId: 'minimax-h3-character-actor', width: 608, height: 352, duration: 5, fps: 24, useSageAttention: true },
  })
  const output = createFlowNode(FLOW_AI_NODE_TYPES.output, { position: { x: 790, y: 120 }, data: { label: 'Fixed Character Movie Output', folderName: 'H3 Fixed Character Movies' } })
  return {
    nodes: [character, shot, video, output],
    edges: [
      createFlowEdge({ source: character.id, sourceHandle: 'out:character', target: video.id, targetHandle: 'in:character' }),
      createFlowEdge({ source: shot.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: video.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildNsfwThreeReferenceVideoTemplate() {
  const scene = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
    position: { x: 40, y: 20 },
    data: {
      label: 'Scene Reference',
      labelKey: 'canvas.h3ThreeReference.scene',
      assetRole: 'scene-reference',
    },
  })
  const character = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
    position: { x: 40, y: 260 },
    data: {
      label: 'Character Sheet',
      labelKey: 'canvas.h3ThreeReference.character',
      assetRole: 'character-sheet-reference',
    },
  })
  const props = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
    position: { x: 40, y: 500 },
    data: {
      label: 'Props / Additional Stage (Optional)',
      labelKey: 'canvas.h3ThreeReference.props',
      assetRole: 'props-stage-reference',
    },
  })
  const prompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 410, y: -120 },
    data: {
      label: 'Generation Content',
      labelKey: 'canvas.h3Reference.contentPrompt',
      promptRole: 'h3-three-reference-content',
      basePrompt: 'Adult subjects only. Use <Picture 1> as the scene, composition, lighting, and environment reference. Use <Picture 2> as the exact adult character identity, face, hair, body, clothing, and design reference from the character sheet. When <Picture 3> is supplied, use it for props, furniture, objects, or additional stage details without replacing the scene or character identity. Create a coherent new video from these still references with stable anatomy, consistent identity, natural motion, intentional camera work, and synchronized native audio.',
      promptText: '1girl, adult, naked',
      promptPlaceholder: 'Describe only the desired adult content, action, camera, and sound.',
      promptPlaceholderKey: 'canvas.h3ThreeReference.promptPlaceholder',
    },
  })
  const video = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 470, y: 220 },
    data: {
      label: 'AfterMidnight Three-Reference Video',
      labelKey: 'canvas.h3ThreeReference.generator',
      workflowId: 'minimax-h3-aftermidnight-3ref',
      width: 608,
      height: 352,
      duration: 5,
      fps: 24,
      useSageAttention: true,
    },
  })
  const output = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 850, y: 240 },
    data: { label: 'Three-Reference NSFW Output', folderName: 'NSFW - H3 Scene Character Props' },
  })
  return {
    nodes: [scene, character, props, prompt, video, output],
    edges: [
      createFlowEdge({ source: scene.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style' }),
      createFlowEdge({ source: character.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style' }),
      createFlowEdge({ source: props.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style' }),
      createFlowEdge({ source: prompt.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: video.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildAnimeEndpointVideoTemplate({ motionReference = false } = {}) {
  const source = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 40, y: 180 },
    data: {
      label: 'Source Reference Video',
      labelKey: 'canvas.nodes.video-input.label',
      assetRole: 'endpoint-video',
      acceptedAssetTypes: ['video'],
    },
  })
  const stylePrompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 40, y: -90 },
    data: {
      label: 'Anime Endpoint Style',
      basePrompt: 'Transform the supplied video frame into a polished anime illustration. Preserve the adult subjects, pose, framing, camera angle, scene geometry, clothing design, facial identity, lighting direction, and all important objects. Keep the same character design and linework across both endpoint images.',
      promptText: 'Clean detailed anime rendering, expressive faces, coherent anatomy, cinematic color and stable character design.',
      promptPlaceholder: 'Describe the anime style, character treatment, costume and scene changes.',
    },
  })
  const firstImage = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 410, y: 40 },
    data: {
      label: 'Anime First Frame', workflowId: 'image-edit', frameTimeMode: 'first',
      preserveInputResolution: true, variantCount: 1, seed: 24680,
    },
  })
  const lastImage = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: 410, y: 350 },
    data: {
      label: 'Anime Last Frame', workflowId: 'image-edit', frameTimeMode: 'last',
      preserveInputResolution: true, variantCount: 1, seed: 24680,
    },
  })
  const videoPrompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 790, y: -120 },
    data: {
      label: 'Generation Content',
      labelKey: 'canvas.h3Reference.contentPrompt',
      promptRole: 'anime-endpoint-content',
      basePrompt: motionReference
        ? 'Use <Picture 1> as the anime appearance at the beginning and <Picture 2> as the desired anime appearance at the end. Use <Video 1> only for motion, pose, timing, interaction, and camera movement. Do not copy the live-action or original rendered appearance from <Video 1>. Perform the referenced action naturally and coherently. Keep character design, anatomy, clothing, linework, palette, and scene continuity stable. Generate synchronized native audio.'
        : 'Begin from the supplied first frame and converge smoothly on the supplied last frame. Perform the requested action naturally and coherently. Preserve the anime character design, identity, anatomy, clothing, linework, palette, scene geometry, and camera continuity. Generate synchronized native audio.',
      promptText: '1girl, adult, naked',
      promptPlaceholder: 'Describe only the subjects, appearance, scene, action, and sound you want to generate.',
      promptPlaceholderKey: 'canvas.h3Reference.contentPromptPlaceholder',
    },
  })
  const video = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 820, y: 170 },
    data: motionReference
      ? {
          label: 'AfterMidnight Anime Motion Reference', workflowId: 'minimax-h3-aftermidnight-r2v',
          width: 608, height: 352, duration: 5, fps: 24,
          referenceStart: 0, referenceDuration: 5, useReferenceAudio: false, useSageAttention: true,
        }
      : {
          label: 'PinkFluffyBunny First / Last', workflowId: 'minimax-h3-nsfw-pink-bunny',
          width: 608, height: 352, duration: 5, fps: 24, requiresLastFrame: true,
        },
  })
  const endpointOutput = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 790, y: 510 },
    data: { label: 'Anime Endpoint Images', folderName: 'NSFW - Anime Endpoints' },
  })
  const videoOutput = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1190, y: 190 },
    data: {
      label: motionReference ? 'Anime Motion Reference Output' : 'Anime First Last Output',
      folderName: motionReference ? 'NSFW - Anime Endpoints R2V' : 'NSFW - Anime Endpoints FLF2V',
    },
  })

  const edges = [
    createFlowEdge({ source: source.id, sourceHandle: 'out:image', target: firstImage.id, targetHandle: 'in:image' }),
    createFlowEdge({ source: source.id, sourceHandle: 'out:image', target: lastImage.id, targetHandle: 'in:image' }),
    createFlowEdge({ source: stylePrompt.id, sourceHandle: 'out:text', target: firstImage.id, targetHandle: 'in:text' }),
    createFlowEdge({ source: stylePrompt.id, sourceHandle: 'out:text', target: lastImage.id, targetHandle: 'in:text' }),
    createFlowEdge({ source: firstImage.id, sourceHandle: 'out:image', target: lastImage.id, targetHandle: 'in:style' }),
    createFlowEdge({ source: firstImage.id, sourceHandle: 'out:image', target: endpointOutput.id, targetHandle: 'in:image' }),
    createFlowEdge({ source: lastImage.id, sourceHandle: 'out:image', target: endpointOutput.id, targetHandle: 'in:image' }),
    createFlowEdge({ source: videoPrompt.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
    createFlowEdge({ source: video.id, sourceHandle: 'out:video', target: videoOutput.id, targetHandle: 'in:video' }),
  ]
  if (motionReference) {
    edges.push(
      createFlowEdge({ source: source.id, sourceHandle: 'out:video', target: video.id, targetHandle: 'in:video' }),
      createFlowEdge({ source: firstImage.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style' }),
      createFlowEdge({ source: lastImage.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style' }),
    )
  } else {
    edges.push(
      createFlowEdge({ source: firstImage.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: lastImage.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:last-image' }),
    )
  }

  return { nodes: [source, stylePrompt, firstImage, lastImage, videoPrompt, video, endpointOutput, videoOutput], edges }
}

function buildNsfwAnimeTalkingVideoTemplate() {
  const image = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 60, y: 80 },
    data: { label: 'ANIMA / Anime Character Image' },
  })
  const motionPrompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 60, y: -160 },
    data: {
      label: 'Performance Direction',
      basePrompt: 'Anime-style character speaking naturally to camera. Preserve the face, hairstyle, costume, linework, proportions, and background composition. Maintain stable identity, expressive eyes, clean mouth movement, and a continuous shot.',
      promptText: 'Subtle head and upper-body movement.',
      promptPlaceholder: 'Describe the acting, expression, gesture, and camera movement.',
    },
  })
  const dialogue = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 420, y: -160 },
    data: { label: 'Japanese Dialogue', basePrompt: '', promptText: 'こんにちは。今日はあなたに話したいことがあります。' },
  })
  const voice = createFlowNode(FLOW_AI_NODE_TYPES.musicGen, {
    position: { x: 420, y: 120 },
    data: { label: 'Irodori v4.1 Anime Voice', workflowId: 'irodori-v4-1-anime', tags: '', lyrics: '', duration: 0 },
  })
  const lipSync = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 780, y: 80 },
    data: {
      label: 'Exact Audio Lip-Sync', workflowId: 'ltx23-latentsync', width: 1280, height: 720,
      duration: 5, fps: 25, lipsExpression: 1.5, lipSyncSteps: 20,
    },
  })
  const output = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 1140, y: 100 },
    data: { label: 'Talking Video Output', folderName: 'NSFW - Anime Talking Video' },
  })
  return {
    nodes: [image, motionPrompt, dialogue, voice, lipSync, output],
    edges: [
      createFlowEdge({ source: image.id, sourceHandle: 'out:image', target: lipSync.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: motionPrompt.id, sourceHandle: 'out:text', target: lipSync.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: dialogue.id, sourceHandle: 'out:text', target: voice.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: voice.id, sourceHandle: 'out:audio', target: lipSync.id, targetHandle: 'in:voice' }),
      createFlowEdge({ source: lipSync.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildNsfwMinimaxH3Template(kind = 'pink-bunny') {
  const isMotion = kind === 'motion-8step'
  const source = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 70, y: 140 },
    data: { label: 'Adult Source Image' },
  })
  const prompt = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 70, y: -80 },
    data: {
      label: 'Motion + Native Audio Prompt',
      basePrompt: 'Adult subjects only. Preserve identity, anatomy, composition, lighting, and camera continuity from the source image. Maintain coherent motion. Generate synchronized native audio with natural ambience and vocal performance appropriate to the scene.',
      promptText: 'Natural, coherent movement and performance.',
      promptPlaceholder: 'Describe only the action, acting, camera movement, and sound.',
    },
  })
  const video = createFlowNode(FLOW_AI_NODE_TYPES.videoGen, {
    position: { x: 450, y: 90 },
    data: {
      label: isMotion ? 'H3 Motion Enhancer 8-step' : 'H3 PinkFluffyBunny Quality',
      workflowId: isMotion ? 'minimax-h3-nsfw-motion-8step' : 'minimax-h3-nsfw-pink-bunny',
      width: 608, height: 352, duration: 5, fps: 24,
    },
  })
  const output = createFlowNode(FLOW_AI_NODE_TYPES.output, {
    position: { x: 820, y: 120 },
    data: { label: 'NSFW Video Output', folderName: isMotion ? 'NSFW - MiniMax H3 Motion' : 'NSFW - MiniMax H3 PinkFluffyBunny' },
  })
  return {
    nodes: [source, prompt, video, output],
    edges: [
      createFlowEdge({ source: source.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:image' }),
      createFlowEdge({ source: prompt.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: video.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video' }),
    ],
  }
}

function buildMediaToPromptTemplate() {
  const mediaNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: 80, y: 120 },
    data: { label: 'Image or Video' },
  })
  const assistNode = createFlowNode(FLOW_AI_NODE_TYPES.promptAssist, {
    position: { x: 430, y: 100 },
    data: {
      label: 'MiniMax H3 Media Promptor',
      workflowId: 'minimax-h3-media-promptor',
      inlinePrompt: '',
      duration: 15,
    },
  })
  const viewerNode = createFlowNode(FLOW_AI_NODE_TYPES.textViewer, {
    position: { x: 790, y: 120 },
    data: { label: 'Generated Prompt' },
  })

  return {
    nodes: [mediaNode, assistNode, viewerNode],
    edges: [
      createFlowEdge({
        source: mediaNode.id,
        sourceHandle: 'out:image',
        target: assistNode.id,
        targetHandle: 'in:image',
      }),
      createFlowEdge({
        source: mediaNode.id,
        sourceHandle: 'out:video',
        target: assistNode.id,
        targetHandle: 'in:video',
      }),
      createFlowEdge({
        source: assistNode.id,
        sourceHandle: 'out:text',
        target: viewerNode.id,
        targetHandle: 'in:text',
      }),
    ],
  }
}

function buildJpTagSearchTemplate() {
  const queryNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: 80, y: 120 },
    data: {
      label: '日本語・英語の検索語 / Search terms',
      basePrompt: '',
      promptText: '少女 黒髪 笑顔',
    },
  })
  const searchNode = createFlowNode(FLOW_AI_NODE_TYPES.promptAssist, {
    position: { x: 450, y: 100 },
    data: {
      label: 'JP Tag Assistant',
      workflowId: 'jp-tag-assistant',
      inlinePrompt: '',
      jpTagLimit: 12,
      jpTagUseMachineLabels: true,
      jpTagExcludeLicensed: true,
      jpTagInsertSpaces: false,
    },
  })
  const viewerNode = createFlowNode(FLOW_AI_NODE_TYPES.textViewer, {
    position: { x: 820, y: 120 },
    data: { label: '英語タグ / English tags' },
  })

  return {
    nodes: [queryNode, searchNode, viewerNode],
    edges: [
      createFlowEdge({ source: queryNode.id, sourceHandle: 'out:text', target: searchNode.id, targetHandle: 'in:text' }),
      createFlowEdge({ source: searchNode.id, sourceHandle: 'out:text', target: viewerNode.id, targetHandle: 'in:text' }),
    ],
  }
}

export function createFlowDocument(options = {}) {
  const templateId = String(options.templateId || 'blank').trim()

  let template = buildBlankTemplate()
  if (templateId === 'nsfw-ortenzya-scenario') {
    const brief = createFlowNode(FLOW_AI_NODE_TYPES.prompt, { position: { x: 40, y: 100 }, data: { label: '設定・指示文', basePrompt: '', promptText: '舞台：夜の港町\n登場人物：旅人と案内人\n雰囲気：静かな緊張感\n長さ：3シーン\n展開：偶然の出会いから、秘密の目的が明らかになる。' } })
    const scenario = createFlowNode(FLOW_AI_NODE_TYPES.promptAssist, { position: { x: 410, y: 100 }, data: { label: 'NSFWシナリオ作成', workflowId: ORTENZYA_WORKFLOW_ID, inlinePrompt: '', systemPrompt: ORTENZYA_SCENARIO_INSTRUCTIONS, localLlmEndpoint: 'http://localhost:1234', localLlmModel: '', maxTokens: 4096 } })
    const drafts = createFlowNode(FLOW_AI_NODE_TYPES.promptAssist, { position: { x: 800, y: 100 }, data: { label: 'シナリオ → プロンプト下書き', workflowId: ORTENZYA_WORKFLOW_ID, inlinePrompt: '', systemPrompt: ORTENZYA_PROMPT_INSTRUCTIONS, localLlmEndpoint: 'http://localhost:1234', localLlmModel: '', maxTokens: 4096 } })
    const viewer = createFlowNode(FLOW_AI_NODE_TYPES.textViewer, { position: { x: 1190, y: 100 }, data: { label: 'プロンプト下書き' } })
    const link = (source, target) => createFlowEdge({ source: source.id, sourceHandle: 'out:text', target: target.id, targetHandle: 'in:text' })
    template = { nodes: [brief, scenario, drafts, viewer], edges: [link(brief, scenario), link(scenario, drafts), link(drafts, viewer)] }
  }
  if (templateId === 'text-to-video') template = buildTextToVideoTemplate()
  if (templateId === 'google-nano-banana-lite') template = buildGoogleImageTemplate()
  if (templateId === 'google-veo-3-1-lite') template = buildGoogleVideoTemplate()
  if (templateId === 'anima-lora-upscale') template = buildAnimaLoraUpscaleTemplate()
  if (templateId === 'image-to-video') template = buildImageToVideoTemplate()
  if (templateId === 'vdn-h3-t2va') template = buildVdnH3Template()
  if (templateId === 'fast-minimax-h3-t2va') template = buildFastH3Template()
  if (templateId === 'minimax-h3-360-orbit') template = buildMinimaxH3360OrbitTemplate()
  if (templateId === 'minimax-h3-handheld') template = buildMinimaxH3HandheldTemplate()
  if (templateId === 'h3-character-builder') template = buildH3CharacterBuilderTemplate()
  if (templateId === 'minimax-h3-character-actor') template = buildH3CharacterActorTemplate()
  if (templateId === 'reference-video-to-video') template = buildReferenceVideoTemplate()
  if (templateId === 'minimax-h3-character-swap') template = buildReferenceVideoTemplate({ characterSwap: true })
  if (templateId === 'nsfw-minimax-h3-pink-reference') template = buildReferenceVideoTemplate({ pink: true })
  if (templateId === 'nsfw-minimax-h3-aftermidnight-r2v') template = buildReferenceVideoTemplate({ afterMidnight: true })
  if (templateId === 'nsfw-minimax-h3-scene-character-props') template = buildNsfwThreeReferenceVideoTemplate()
  if (templateId === 'nsfw-anime-endpoints-flf2v') template = buildAnimeEndpointVideoTemplate()
  if (templateId === 'nsfw-anime-endpoints-r2v') template = buildAnimeEndpointVideoTemplate({ motionReference: true })
  if (templateId === 'nsfw-anime-talking-video') template = buildNsfwAnimeTalkingVideoTemplate()
  if (templateId === 'nsfw-minimax-h3-naughty-times') {
    template = buildNsfwMinimaxH3Template('pink-bunny')
    for (const node of template.nodes) {
      if (node.type === FLOW_AI_NODE_TYPES.imageInput) node.data.label = 'Source Image'
      if (node.type === FLOW_AI_NODE_TYPES.prompt) {
        node.data.basePrompt = 'Preserve the character identity, anatomy, composition, and visual style. Maintain coherent motion and generate synchronized native audio.'
        node.data.promptText = 'Gentle head movement and a slow camera push-in. Audio: soft environmental ambience.'
      }
      if (node.type === FLOW_AI_NODE_TYPES.videoGen) {
        node.data.workflowId = 'minimax-h3-naughty-times'
        node.data.label = 'MiniMax H3 NaughtyTimes v3'
      }
      if (node.type === FLOW_AI_NODE_TYPES.output) node.data.folderName = 'NSFW - MiniMax H3 NaughtyTimes'
    }
  }
  if (templateId === 'nsfw-minimax-h3-pink-bunny') template = buildNsfwMinimaxH3Template('pink-bunny')
  if (templateId === 'nsfw-minimax-h3-motion-8step') template = buildNsfwMinimaxH3Template('motion-8step')
  if (templateId === 'ainvfx-fluid') template = buildAinvfxFluidTemplate()
  if (templateId === 'start-last-frame-video') template = buildStartLastFrameVideoTemplate()
  if (templateId === 'music-cue') template = buildMusicTemplate()
  if (templateId === 'qwen-image-2-1-heretic') template = buildQwenImage21HereticTemplate()
  if (templateId === 'nsfw-qwen-image-2-1-lora') template = buildQwenImage21NsfwLoraTemplate()
  if (templateId === 'qwen-image-2-1-heretic-edit') template = buildQwenImage21HereticEditTemplate()
  if (templateId === 'qwen-image-2-1-character-sheet') template = buildQwenImage21CharacterSheetTemplate()
  if (templateId === 'character-reference-edit') template = buildCharacterReferenceEditTemplate()
  if (templateId === 'nsfw-dark-beast-krea2-i2i') template = buildDarkBeastKrea2I2ITemplate()
  if (templateId === 'nsfw-haruki-mix-krea2-t2i') template = buildHarukiMixKrea2Template()
  if (templateId === 'nsfw-wan-1-3b-e10-t2v') template = buildNsfwWan13bE10Template()
  if (templateId === 'media-to-prompt') template = buildMediaToPromptTemplate()
  if (templateId === 'jp-tag-search') template = buildJpTagSearchTemplate()
  if (templateId === 'character-sheet') template = buildCharacterSheetTemplate()
  if (templateId === 'anima-lora-dataset') template = buildLoraDatasetTemplate('anima')
  if (templateId === 'sdxl-lora-dataset') template = buildLoraDatasetTemplate('sdxl')

  return {
    id: options.id || createNodeId('flow'),
    version: FLOW_AI_VERSION,
    name: options.name || FLOW_AI_TEMPLATES.find((entry) => entry.id === templateId)?.label || 'Flow',
    templateId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: options.nodes || template.nodes,
    edges: options.edges || template.edges,
    viewport: options.viewport || { ...DEFAULT_VIEWPORT },
  }
}

export function createDefaultFlowAiProjectData() {
  const starter = createFlowDocument({
    name: 'Blank Canvas',
    templateId: 'blank',
  })
  return {
    version: FLOW_AI_VERSION,
    activeDocumentId: starter.id,
    documents: [starter],
  }
}

export function normalizeFlowNode(node = {}) {
  const type = String(node?.type || '').trim()
  const definition = getFlowNodeDefinition(type)
  if (!definition) return null
  const baseData = createBaseNodeData(type)
  const rawData = node.data && typeof node.data === 'object' ? node.data : {}
  const rawStyle = node?.style && typeof node.style === 'object' ? node.style : {}
  const legacyWidth = Number(rawData.nodeWidth)
  const legacyHeight = Number(rawData.nodeHeight)
  const styleWidth = Number(rawStyle.width)
  const styleHeight = Number(rawStyle.height)
  const resolvedWidth = Number.isFinite(styleWidth) && styleWidth > 0
    ? styleWidth
    : (Number.isFinite(legacyWidth) && legacyWidth > 0 ? legacyWidth : null)
  const resolvedHeight = Number.isFinite(styleHeight) && styleHeight > 0
    ? styleHeight
    : (Number.isFinite(legacyHeight) && legacyHeight > 0 ? legacyHeight : null)
  const normalizedData = {
    ...baseData,
    ...rawData,
    muted: rawData.muted === true,
    outputAssetIds: Array.isArray(node?.data?.outputAssetIds) ? node.data.outputAssetIds.filter(Boolean) : baseData.outputAssetIds,
    resolvedAssetIds: Array.isArray(node?.data?.resolvedAssetIds) ? node.data.resolvedAssetIds.filter(Boolean) : baseData.resolvedAssetIds,
  }
  delete normalizedData.nodeWidth
  delete normalizedData.nodeHeight

  if (type === FLOW_AI_NODE_TYPES.output) {
    const rawLabel = String(rawData.label || '').trim()
    const rawStatusMessage = String(rawData.statusMessage || '').trim()
    normalizedData.label = !rawLabel || rawLabel === 'Output' ? baseData.label : rawData.label
    normalizedData.statusMessage = (
      !rawStatusMessage || rawStatusMessage === 'Connect final image, video, or audio nodes here.'
    )
      ? baseData.statusMessage
      : rawData.statusMessage
    normalizedData.folderName = String(rawData.folderName || '').trim()
  }

  if (type === FLOW_AI_NODE_TYPES.imageGen) {
    normalizedData.variantCount = normalizeFlowImageVariantCount(rawData.variantCount, normalizedData.workflowId)
  }

  if (type === FLOW_AI_NODE_TYPES.videoUpscale) {
    normalizedData.upscaleModel = String(rawData.upscaleModel || baseData.upscaleModel).trim() || baseData.upscaleModel
    normalizedData.targetResolution = String(rawData.targetResolution || baseData.targetResolution).trim() || baseData.targetResolution
    normalizedData.upscaleCreativity = String(rawData.upscaleCreativity || baseData.upscaleCreativity).trim() || baseData.upscaleCreativity
    normalizedData.estimatedCredits = normalizeCreditsEstimate(rawData.estimatedCredits)
    normalizedData.estimatedCreditsSource = String(rawData.estimatedCreditsSource || '').trim() || null
  }

  if (type === FLOW_AI_NODE_TYPES.promptAssist) {
    normalizedData.outputText = typeof rawData.outputText === 'string' ? rawData.outputText : baseData.outputText
    normalizedData.systemPrompt = typeof rawData.systemPrompt === 'string' ? rawData.systemPrompt : baseData.systemPrompt
    normalizedData.frameTime = Number(rawData.frameTime) || 0
  }

  const nextStyle = { ...rawStyle }
  if (resolvedWidth && resolvedWidth > 0) nextStyle.width = resolvedWidth
  else delete nextStyle.width
  if (resolvedHeight && resolvedHeight > 0) nextStyle.height = resolvedHeight
  else delete nextStyle.height

  const result = {
    id: String(node.id || createNodeId(type.replace(/[^a-z0-9]+/gi, '_'))),
    type,
    position: {
      x: Number(node?.position?.x) || 0,
      y: Number(node?.position?.y) || 0,
    },
    data: normalizedData,
  }
  if (Object.keys(nextStyle).length > 0) {
    result.style = nextStyle
  }
  return result
}

function upgradeLegacyLoraInpaintStage(document, nodes, edges) {
  const templateId = String(document?.templateId || '').trim()
  if (!['anima-lora-dataset', 'sdxl-lora-dataset'].includes(templateId)) {
    return { nodes, edges }
  }
  if (nodes.some((node) => node?.data?.optionalStage === 'inpaint')) {
    return { nodes, edges }
  }

  const sourceNode = nodes.find((node) => (
    node.type === FLOW_AI_NODE_TYPES.imageInput
    && String(node?.data?.label || '').trim() === 'Character Source Image'
  ))
  const angleNode = nodes.find((node) => (
    node.type === FLOW_AI_NODE_TYPES.imageGen
    && node?.data?.workflowId === 'multi-angles'
  ))
  const legacyEdge = edges.find((edge) => (
    edge.source === sourceNode?.id
    && edge.target === angleNode?.id
    && edge.targetHandle === 'in:image'
  ))
  if (!sourceNode || !angleNode || !legacyEdge) return { nodes, edges }

  const sourceX = Number(sourceNode.position?.x) || 70
  const sourceY = Number(sourceNode.position?.y) || 120
  const inpaintNode = createFlowNode(FLOW_AI_NODE_TYPES.imageGen, {
    position: { x: sourceX + 360, y: sourceY + 50 },
    data: {
      label: 'Masked Inpaint Edit (optional)',
      workflowId: 'image-edit',
      width: 1024,
      height: 1024,
      variantCount: 1,
      enabled: false,
      optionalStage: 'inpaint',
      preserveInputResolution: true,
      datasetRole: 'source-transform',
      statusMessage: 'Off — the original character image will pass through unchanged.',
    },
  })
  const promptNode = createFlowNode(FLOW_AI_NODE_TYPES.prompt, {
    position: { x: sourceX, y: sourceY - 230 },
    data: {
      label: 'Inpaint Prompt (optional)',
      basePrompt: 'Replace only the masked area while preserving character identity and every unmasked detail.',
      promptText: '',
      promptPlaceholder: 'Describe the logo, prop, clothing, or design to add.',
      excludeFromDatasetExport: true,
    },
  })
  const maskNode = createFlowNode(FLOW_AI_NODE_TYPES.imageInput, {
    position: { x: sourceX, y: sourceY + 230 },
    data: {
      label: 'Inpaint Mask (optional)',
      assetRole: 'mask',
      excludeFromDatasetExport: true,
      statusMessage: 'Choose a black-and-white mask. White areas will be replaced.',
    },
  })
  const referenceNode = createFlowNode(FLOW_AI_NODE_TYPES.styleReference, {
    position: { x: sourceX, y: sourceY + 460 },
    data: { label: 'Inpaint Reference (optional)', excludeFromDatasetExport: true },
  })
  const upgradedNodes = nodes.map((node) => (
    node.id === sourceNode.id
      ? { ...node, data: { ...node.data, datasetRole: 'source' } }
      : node.id === angleNode.id
        ? { ...node, position: { x: Math.max(Number(node.position?.x) || 0, sourceX + 720), y: sourceY + 50 } }
        : node.type === FLOW_AI_NODE_TYPES.output
          ? { ...node, position: { x: Math.max(Number(node.position?.x) || 0, sourceX + 1080), y: sourceY + 70 } }
        : node
  ))
  const upgradedEdges = edges.filter((edge) => edge.id !== legacyEdge.id)
  upgradedEdges.push(
    createFlowEdge({ source: sourceNode.id, sourceHandle: 'out:image', target: inpaintNode.id, targetHandle: 'in:image' }),
    createFlowEdge({ source: promptNode.id, sourceHandle: 'out:text', target: inpaintNode.id, targetHandle: 'in:text' }),
    createFlowEdge({ source: maskNode.id, sourceHandle: 'out:image', target: inpaintNode.id, targetHandle: 'in:mask' }),
    createFlowEdge({ source: referenceNode.id, sourceHandle: 'out:image', target: inpaintNode.id, targetHandle: 'in:style' }),
    createFlowEdge({ source: inpaintNode.id, sourceHandle: 'out:image', target: angleNode.id, targetHandle: 'in:image' }),
  )
  return {
    nodes: [...upgradedNodes, promptNode, maskNode, referenceNode, inpaintNode],
    edges: upgradedEdges,
  }
}

function upgradeLegacyAnimaCanvas(document, nodes, edges) {
  if (String(document?.templateId || '').trim() !== 'anima-lora-upscale') return { nodes, edges }
  if (nodes.some((node) => node.type === FLOW_AI_NODE_TYPES.workflowControl)) return { nodes, edges }

  const legacyImage = nodes.find((node) => node.type === FLOW_AI_NODE_TYPES.imageGen && node?.data?.workflowId === 'anima-lora-upscale')
  if (!legacyImage) return { nodes, edges }
  const legacyPrompt = nodes.find((node) => node.type === FLOW_AI_NODE_TYPES.prompt)
  const legacyOutput = nodes.find((node) => node.type === FLOW_AI_NODE_TYPES.output)
  const upgraded = buildAnimaLoraUpscaleTemplate()
  for (const node of upgraded.nodes) {
    if (node.type === FLOW_AI_NODE_TYPES.imageGen) {
      node.data = { ...node.data, ...legacyImage.data, label: 'RES4LYF Sampler' }
    } else if (node.type === FLOW_AI_NODE_TYPES.prompt && node.data.label === 'Positive Prompt' && legacyPrompt) {
      node.data.promptText = legacyPrompt.data?.promptText || node.data.promptText
    } else if (node.type === FLOW_AI_NODE_TYPES.output && legacyOutput) {
      node.data = { ...node.data, ...legacyOutput.data }
    } else if (node.type === FLOW_AI_NODE_TYPES.workflowControl) {
      if (node.data.controlKind === 'checkpoint') node.data.checkpointName = legacyImage.data?.checkpointName || ''
      if (node.data.controlKind === 'image-size') {
        node.data.width = Number(legacyImage.data?.width) || 768
        node.data.height = Number(legacyImage.data?.height) || 1280
      }
      if (node.data.controlKind === 'lora-stack' && Array.isArray(legacyImage.data?.loras)) node.data.loras = legacyImage.data.loras
      if (node.data.controlKind === 'upscale') {
        node.data.upscaleEnabled = Boolean(legacyImage.data?.upscaleEnabled)
        node.data.upscaleModel = legacyImage.data?.upscaleModel || node.data.upscaleModel
      }
    } else if (node.type === FLOW_AI_NODE_TYPES.prompt && node.data.label === 'Negative Prompt') {
      node.data.promptText = legacyImage.data?.negativePrompt || node.data.promptText
    }
  }
  return upgraded
}

const LEGACY_VISIBLE_PROMPT_REPLACEMENTS = new Map([
  ['A cinematic hero frame with dramatic lighting', 'A cinematic hero frame with dramatic lighting.'],
  ['masterpiece, best quality, amazing quality, detailed eyes, dynamic lighting, depth of field', ''],
  ['ugly, bad, wrong, low quality, monochrome, simple background, worst quality, lowres, blurry, jpeg artifacts, bad anatomy, watermark, artist name', ''],
  ['Keep the character identity, clothing, proportions, colors, and accessories consistent across every view.', ''],
  ['Replace only the masked area with the requested logo, prop, clothing, or design while preserving the character identity and every unmasked detail.', ''],
  ['Cinematic natural motion. Preserve the subject and composition. Audio: subtle environmental ambience synchronized with the scene.', 'The subject performs a subtle, natural movement.'],
  ['Create a smooth, physically coherent transition from the start frame to the last frame. Preserve subject identity and scene continuity. Audio: subtle environmental ambience synchronized with the motion.', 'Natural movement connects the two frames.'],
  ['ainvfxfluid, smoke plume', 'smoke plume'],
  ['Live-action cinematic drama. An adult traveler pauses beside a rain-streaked cafe window at dusk. The camera slowly tracks closer as they turn toward the street. Natural facial expressions, coherent motion, continuous single shot. Audio: quiet rain, distant traffic and soft footsteps.', 'An adult traveler pauses beside a rain-streaked cafe window at dusk. The camera slowly tracks closer as they turn toward the street. Audio: quiet rain, distant traffic and soft footsteps.'],
  ['Anime cinematic scene. A young adult traveler walks through a sunlit coastal town, hair and clothes moving gently in the breeze. Smooth character animation, expressive eyes, clean linework, rich painted backgrounds. The camera slowly tracks alongside. Audio: soft footsteps, wind and distant seabirds.', 'A young adult traveler walks through a sunlit coastal town, hair and clothes moving gently in the breeze. The camera slowly tracks alongside. Audio: soft footsteps, wind and distant seabirds.'],
  ['Use <Picture 1> as the adult subject identity, face, hair, body, and clothing reference. Use <Video 1> as the motion, timing, pose, interaction, and camera reference. Describe the intended adult scene, coherent action, and synchronized sound.', 'Perform the referenced action naturally and coherently.'],
  ['Replace the primary subject in <Video 1> with the subject from <Picture 1>. Preserve <Picture 1>\'s face, hair, body, clothing, and visual identity consistently in every frame. Use <Video 1> only for motion, pose, timing, interaction, and camera movement; do not copy the original subject\'s appearance. Render a coherent scene with stable anatomy and synchronized native audio.', 'Perform the referenced action naturally and coherently.'],
  ['Use <Picture 1> as the subject identity, face, hair, body, and clothing reference. Use <Video 1> as the motion, timing, pose, and camera reference. Describe the desired adult scene, action, and synchronized sound.', 'Perform the referenced action naturally and coherently.'],
  ['Use <Video 1> as the motion, timing, and camera reference. Recreate the action in a cinematic scene with natural movement and coherent lighting. Audio: synchronized environmental ambience. Describe any changes to the subject, setting, or style here.', 'Perform the referenced action naturally and coherently.'],
  ['Anime-style character speaking naturally to camera. Preserve the face, hairstyle, costume, linework, proportions, and background composition. Subtle head and upper-body motion, stable identity, expressive eyes, clean mouth movement, continuous shot.', 'Subtle head and upper-body movement.'],
  ['Adult subjects only. Preserve identity, anatomy, composition, lighting, and camera continuity from the source image. Describe the intended motion precisely. Audio: synchronized natural ambience and vocal performance appropriate to the scene.', 'Natural, coherent movement and performance.'],
  ['Preserve the character, composition and visual style. Gentle head movement and a slow camera push-in. Audio: soft environmental ambience.', 'Gentle head movement and a slow camera push-in. Audio: soft environmental ambience.'],
])

function upgradeLegacyPromptBases(document, nodes) {
  const templateId = String(document?.templateId || '').trim()
  if (!FLOW_AI_TEMPLATES.some(template => template.id === templateId)) return
  const templatePrompts = createFlowDocument({ templateId }).nodes.filter(node => node.type === FLOW_AI_NODE_TYPES.prompt)
  if (templatePrompts.length === 0) return
  const rawNodesById = new Map((Array.isArray(document?.nodes) ? document.nodes : []).map(node => [String(node?.id || ''), node]))
  const prompts = nodes.filter(node => node.type === FLOW_AI_NODE_TYPES.prompt)

  prompts.forEach((node, index) => {
    const rawData = rawNodesById.get(node.id)?.data
    const legacyText = String(rawData?.promptText ?? node.data.promptText ?? '')
    if (LEGACY_VISIBLE_PROMPT_REPLACEMENTS.has(legacyText)) {
      node.data.promptText = LEGACY_VISIBLE_PROMPT_REPLACEMENTS.get(legacyText)
    }
    if (rawData && Object.prototype.hasOwnProperty.call(rawData, 'basePrompt')) return
    const expected = templatePrompts.find(candidate => (
      node.data?.promptRole && candidate.data?.promptRole === node.data.promptRole
    ) || (
      node.data?.label && candidate.data?.label === node.data.label
    )) || templatePrompts[index]
    const basePrompt = String(expected?.data?.basePrompt || '').trim()
    if (!basePrompt) return
    node.data.basePrompt = basePrompt
    node.data.promptPlaceholder = expected.data.promptPlaceholder || node.data.promptPlaceholder || ''
  })
}

function upgradeAnimeEndpointContentPrompt(document, nodes, edges) {
  const templateId = String(document?.templateId || '').trim()
  if (!['nsfw-anime-endpoints-flf2v', 'nsfw-anime-endpoints-r2v'].includes(templateId)) return
  const videoNode = nodes.find(node => node.type === FLOW_AI_NODE_TYPES.videoGen)
  const promptEdge = edges.find(edge => edge.target === videoNode?.id && edge.targetHandle === 'in:text')
  const promptNode = nodes.find(node => node.id === promptEdge?.source && node.type === FLOW_AI_NODE_TYPES.prompt)
  if (!promptNode) return

  const expected = buildAnimeEndpointVideoTemplate({ motionReference: templateId === 'nsfw-anime-endpoints-r2v' })
    .nodes.find(node => node?.data?.promptRole === 'anime-endpoint-content')
  if (!expected) return

  const previousDefault = String(promptNode.data?.promptText || '').trim()
  if ([
    'Follow the source performance and camera path while rendering a coherent anime scene.',
    'Create coherent natural movement that connects the two endpoint images.',
  ].includes(previousDefault)) {
    promptNode.data.promptText = expected.data.promptText
  }
  promptNode.data.label = expected.data.label
  promptNode.data.labelKey = expected.data.labelKey
  promptNode.data.promptRole = expected.data.promptRole
  promptNode.data.basePrompt = expected.data.basePrompt
  promptNode.data.promptPlaceholder = expected.data.promptPlaceholder
  promptNode.data.promptPlaceholderKey = expected.data.promptPlaceholderKey
}

function upgradeAfterMidnightContentPrompt(document, nodes, edges) {
  if (String(document?.templateId || '').trim() !== 'nsfw-minimax-h3-aftermidnight-r2v') return
  const videoNode = nodes.find(node => node?.data?.workflowId === 'minimax-h3-aftermidnight-r2v')
  const promptEdge = edges.find(edge => edge.target === videoNode?.id && edge.targetHandle === 'in:text')
  const promptNode = nodes.find(node => node.id === promptEdge?.source && node.type === FLOW_AI_NODE_TYPES.prompt)
  if (!promptNode) return

  const expected = buildReferenceVideoTemplate({ afterMidnight: true })
    .nodes.find(node => node?.data?.promptRole === 'aftermidnight-content')
  if (!expected) return

  if (String(promptNode.data?.promptText || '').trim() === 'Perform the referenced action naturally and coherently.') {
    promptNode.data.promptText = expected.data.promptText
  }
  promptNode.data.label = expected.data.label
  promptNode.data.labelKey = expected.data.labelKey
  promptNode.data.promptRole = expected.data.promptRole
  promptNode.data.basePrompt = expected.data.basePrompt
  promptNode.data.promptPlaceholder = expected.data.promptPlaceholder
  promptNode.data.promptPlaceholderKey = expected.data.promptPlaceholderKey
}

function upgradeCharacterReferenceEdit(document, nodes, edges) {
  if (String(document?.templateId || '').trim() !== 'character-reference-edit') return { nodes, edges }
  const generatorNode = nodes.find(node => (
    node.type === FLOW_AI_NODE_TYPES.imageGen && node?.data?.workflowId === 'image-edit'
  ))
  if (!generatorNode) return { nodes, edges }

  const expected = buildCharacterReferenceEditTemplate()
  const expectedPrompt = expected.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.prompt)
  const primaryEdge = edges.find(edge => edge.target === generatorNode.id && edge.targetHandle === 'in:image')
  const primaryNode = nodes.find(node => node.id === primaryEdge?.source)
  if (primaryNode) {
    Object.assign(primaryNode.data, {
      labelKey: 'canvas.characterReferenceEdit.primary',
      assetRole: 'character-reference-primary',
      acceptedAssetTypes: ['image'],
    })
  }

  const promptEdge = edges.find(edge => edge.target === generatorNode.id && edge.targetHandle === 'in:text')
  const promptNode = nodes.find(node => node.id === promptEdge?.source && node.type === FLOW_AI_NODE_TYPES.prompt)
  if (promptNode && expectedPrompt) {
    promptNode.data.label = expectedPrompt.data.label
    promptNode.data.labelKey = expectedPrompt.data.labelKey
    promptNode.data.basePrompt = expectedPrompt.data.basePrompt
    promptNode.data.promptPlaceholder = expectedPrompt.data.promptPlaceholder
    promptNode.data.promptPlaceholderKey = expectedPrompt.data.promptPlaceholderKey
  }
  generatorNode.data.referencePacking = 'numbered-six'

  const styleEdges = edges.filter(edge => edge.target === generatorNode.id && edge.targetHandle === 'in:style')
  const styleNodes = styleEdges.map(edge => nodes.find(node => node.id === edge.source)).filter(Boolean)
  const assignedNumbers = new Set()
  styleNodes.slice(0, 5).forEach((node, index) => {
    const existingNumber = Number(String(node?.data?.assetRole || '').match(/^character-reference-([2-6])$/)?.[1])
    const referenceNumber = existingNumber >= 2 && existingNumber <= 6 && !assignedNumbers.has(existingNumber)
      ? existingNumber
      : index + 2
    assignedNumbers.add(referenceNumber)
    node.data.label = `Reference ${referenceNumber}: Clothing / Accessory (optional)`
    node.data.labelKey = `canvas.characterReferenceEdit.reference${referenceNumber}`
    node.data.assetRole = `character-reference-${referenceNumber}`
  })

  const addedNodes = []
  const addedEdges = []
  for (let referenceNumber = 2; referenceNumber <= 6; referenceNumber += 1) {
    if (assignedNumbers.has(referenceNumber)) continue
    const expectedNode = expected.nodes.find(node => node?.data?.assetRole === `character-reference-${referenceNumber}`)
    if (!expectedNode) continue
    addedNodes.push(expectedNode)
    addedEdges.push(createFlowEdge({
      source: expectedNode.id,
      sourceHandle: 'out:image',
      target: generatorNode.id,
      targetHandle: 'in:style',
    }))
  }
  return { nodes: [...nodes, ...addedNodes], edges: [...edges, ...addedEdges] }
}

function upgradeQwenTransparentPromptConnection(document, nodes, edges) {
  const templateId = String(document?.templateId || '').trim()
  if (!['qwen-image-2-1-heretic', 'qwen-image-2-1-heretic-edit'].includes(templateId)) {
    return { nodes, edges }
  }

  const outputNote = nodes.find(node => (
    node.type === FLOW_AI_NODE_TYPES.workflowControl
    && node?.data?.controlKind === 'transparent-png'
  ))
  const generator = nodes.find(node => (
    node.type === FLOW_AI_NODE_TYPES.imageGen
    && ['qwen-image-2-1-heretic', 'qwen-image-2-1-heretic-edit'].includes(node?.data?.workflowId)
  ))
  const promptEdge = edges.find(edge => (
    edge.target === generator?.id && edge.targetHandle === 'in:text'
  ))
  const promptNode = nodes.find(node => (
    node.id === promptEdge?.source && node.type === FLOW_AI_NODE_TYPES.prompt
  ))
  if (!outputNote || !generator || !promptNode) return { nodes, edges }

  promptNode.data.acceptsPromptControls = true
  if (
    promptNode.data.status === 'error'
    && /^Workflow qwen-image-2-1-(?:heretic|heretic-edit) is missing dependencies\./.test(String(promptNode.data.error || ''))
  ) {
    promptNode.data.status = 'idle'
    promptNode.data.error = ''
    promptNode.data.statusMessage = ''
  }
  const nextEdges = edges.filter(edge => !(
    edge.source === outputNote.id
    && edge.target === generator.id
    && edge.sourceHandle === 'out:control'
    && edge.targetHandle === 'in:control'
  ))
  const alreadyConnected = nextEdges.some(edge => (
    edge.source === outputNote.id
    && edge.target === promptNode.id
    && edge.sourceHandle === 'out:control'
    && edge.targetHandle === 'in:control'
  ))
  if (!alreadyConnected) {
    nextEdges.push(createFlowEdge({
      source: outputNote.id,
      sourceHandle: 'out:control',
      target: promptNode.id,
      targetHandle: 'in:control',
    }))
  }
  return { nodes, edges: nextEdges }
}

export function normalizeFlowDocument(document = {}, fallbackName = 'Flow') {
  let normalizedNodes = (Array.isArray(document?.nodes) ? document.nodes : [])
    .map((node) => normalizeFlowNode(node))
    .filter(Boolean)
  const validNodeIds = new Set(normalizedNodes.map((node) => node.id))
  let normalizedEdges = (Array.isArray(document?.edges) ? document.edges : [])
    .filter((edge) => validNodeIds.has(edge?.source) && validNodeIds.has(edge?.target))
    .map((edge) => ({
      id: String(edge.id || createEdgeId()),
      source: String(edge.source),
      target: String(edge.target),
      sourceHandle: edge.sourceHandle || null,
      targetHandle: edge.targetHandle || null,
      animated: Boolean(edge.animated),
    }))
  const upgraded = upgradeLegacyLoraInpaintStage(document, normalizedNodes, normalizedEdges)
  normalizedNodes = upgraded.nodes
  normalizedEdges = upgraded.edges
  const animaUpgrade = upgradeLegacyAnimaCanvas(document, normalizedNodes, normalizedEdges)
  normalizedNodes = animaUpgrade.nodes
  normalizedEdges = animaUpgrade.edges
  const characterReferenceUpgrade = upgradeCharacterReferenceEdit(document, normalizedNodes, normalizedEdges)
  normalizedNodes = characterReferenceUpgrade.nodes
  normalizedEdges = characterReferenceUpgrade.edges
  const qwenTransparentUpgrade = upgradeQwenTransparentPromptConnection(document, normalizedNodes, normalizedEdges)
  normalizedNodes = qwenTransparentUpgrade.nodes
  normalizedEdges = qwenTransparentUpgrade.edges
  upgradeLegacyPromptBases(document, normalizedNodes)
  upgradeAnimeEndpointContentPrompt(document, normalizedNodes, normalizedEdges)
  upgradeAfterMidnightContentPrompt(document, normalizedNodes, normalizedEdges)

  return {
    id: String(document?.id || createNodeId('flow')),
    version: FLOW_AI_VERSION,
    name: String(document?.name || fallbackName || 'Flow'),
    templateId: String(document?.templateId || 'blank'),
    createdAt: document?.createdAt || new Date().toISOString(),
    updatedAt: document?.updatedAt || new Date().toISOString(),
    nodes: normalizedNodes,
    edges: normalizedEdges,
    viewport: {
      x: Number(document?.viewport?.x) || DEFAULT_VIEWPORT.x,
      y: Number(document?.viewport?.y) || DEFAULT_VIEWPORT.y,
      zoom: Number(document?.viewport?.zoom) || DEFAULT_VIEWPORT.zoom,
    },
  }
}

export function normalizeFlowAiProjectData(projectData) {
  const rawDocuments = Array.isArray(projectData?.documents) ? projectData.documents : []
  const documents = rawDocuments.length > 0
    ? rawDocuments.map((document, index) => normalizeFlowDocument(document, `Flow ${index + 1}`))
    : [createFlowDocument({ name: 'Blank Canvas', templateId: 'blank' })]

  const activeDocumentId = documents.some((document) => document.id === projectData?.activeDocumentId)
    ? String(projectData.activeDocumentId)
    : documents[0].id

  return {
    version: FLOW_AI_VERSION,
    activeDocumentId,
    documents,
  }
}

export function getFlowWorkflowSummary(workflowId = '') {
  if (!workflowId) return null
  const label = getWorkflowDisplayLabel(workflowId)
  const hardware = getWorkflowHardwareInfo(workflowId)
  return {
    id: workflowId,
    label: label || workflowId,
    runtime: hardware?.runtime || 'local',
    tierId: hardware?.tierId || '',
  }
}

export function buildNodeStatusSummary(node) {
  if (node?.data?.muted === true) return 'Muted'
  const status = String(node?.data?.status || 'idle')
  if (status === 'running') return 'Running'
  if (status === 'checking') return 'Checking'
  if (status === 'queuing') return 'Queueing'
  if (status === 'done') return 'Ready'
  if (status === 'error') return 'Error'
  if (status === 'blocked') return 'Blocked'
  return 'Idle'
}
