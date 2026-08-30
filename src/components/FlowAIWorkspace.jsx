import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  BaseEdge,
  Background,
  Controls,
  EdgeLabelRenderer,
  getBezierPath,
  Handle,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowUpDown,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Film,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Info,
  Loader2,
  Music,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  Square,
  Sparkles,
  Terminal,
  Trash2,
  Type,
  Wand2,
  X,
} from 'lucide-react'
import comfyui from '../services/comfyui'
import useProjectStore from '../stores/projectStore'
import useAssetsStore from '../stores/assetsStore'
import useViewportClampedPosition from '../hooks/useViewportClampedPosition'
import { checkWorkflowDependenciesBatch } from '../services/workflowDependencies'
import {
  FLOW_AI_NODE_LIBRARY,
  FLOW_AI_NODE_TYPES,
  FLOW_AI_TEMPLATE_INFO,
  FLOW_AI_TEMPLATES,
  buildNodeStatusSummary,
  createFlowDocument,
  createFlowEdge,
  createFlowNode,
  getDefaultWorkflowId,
  getFlowAudioWorkflowOptions,
  getFlowImageVariantBehavior,
  getFlowImageWorkflowOptions,
  getFlowNodeDefinition,
  getFlowNodeSupportsExecution,
  getFlowOutputDestinationLabel,
  getFlowTextWorkflowOptions,
  getFlowVideoWorkflowOptions,
  getFlowVideoUpscaleWorkflowOptions,
  getFlowWorkflowSummary,
  isSingletonTargetHandle,
  isValidFlowConnection,
  normalizeFlowAiProjectData,
  normalizeFlowImageVariantCount,
  parsePortType,
} from '../services/flowAiSchema'
import {
  getTopazVideoUpscaleCreditsPerSecond,
  TOPAZ_VIDEO_UPSCALE_CREATIVITY_OPTIONS,
  TOPAZ_VIDEO_UPSCALE_MODEL_OPTIONS,
  TOPAZ_VIDEO_UPSCALE_RESOLUTION_OPTIONS,
  topazVideoUpscaleModelSupportsCreativity,
} from '../config/topazVideoUpscaleConfig'
import { getAudioWaveformData } from '../services/audioWaveform'
import { hasUsablePlaybackCache } from '../services/playbackCache'
import { getSpriteFramePosition } from '../services/thumbnailSprites'
import { computeOutputNodeAssetIds, resolveFlowNodeText, runFlowGraph } from '../services/flowAiRuntime'
import { formatCreditsPerSecond, formatCreditsRange } from '../utils/comfyCredits'
import { canRevealAssetInFileManager, revealAssetInFileManager } from '../utils/revealInFileManager'
import { getAbsoluteFileUrl, importAsset } from '../services/fileSystem'
import { getRecordedAbsolutePath, isAbsoluteRecordedPath } from '../services/assetRelinkFallback'
import {
  chooseCivitaiAnimaDiffusionModel,
  chooseCivitaiLoraBaseCheckpoint,
} from '../services/civitai'
import { useI18n } from '../i18n/I18nContext'

const LORA_FACTORY_MODEL_RECIPES = Object.freeze({
  anima: Object.freeze({
    base: Object.freeze({
      filename: 'anima-base-v1.0.safetensors',
      targetSubdir: 'diffusion_models',
      displayName: 'Anima base diffusion model',
      downloadUrl: 'https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/diffusion_models/anima-base-v1.0.safetensors',
      sizeBytes: 4182218328,
      sha256: 'bd43b7cffe1ed1153d9c41e7beb2f18cb1273eafbaa3af3edd6a173dc90a006e',
    }),
    vae: Object.freeze({
      filename: 'qwen_image_vae.safetensors',
      targetSubdir: 'vae',
      displayName: 'Anima / Qwen image VAE',
      downloadUrl: 'https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/vae/qwen_image_vae.safetensors',
      sizeBytes: 253806246,
      sha256: 'a70580f0213e67967ee9c95f05bb400e8fb08307e017a924bf3441223e023d1f',
    }),
    qwen: Object.freeze({
      filename: 'qwen_3_06b_base.safetensors',
      targetSubdir: 'text_encoders',
      displayName: 'Anima Qwen3 0.6B text encoder',
      downloadUrl: 'https://huggingface.co/circlestone-labs/Anima/resolve/main/split_files/text_encoders/qwen_3_06b_base.safetensors',
      sizeBytes: 1192135096,
      sha256: 'cd2a512003e2f9f3cd3c32a9c3573f820bb28c940f73c57b1ddaa983d9223eba',
    }),
  }),
  sdxl: Object.freeze({
    base: Object.freeze({
      filename: 'sd_xl_base_1.0.safetensors',
      targetSubdir: 'checkpoints',
      displayName: 'SDXL 1.0 base checkpoint',
      downloadUrl: 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors',
      sizeBytes: 6938078334,
      sha256: '31e35c80fc4829d14f90153f4c74cd59c90b779f6afe05a74cd6120b893f7e5b',
    }),
    vae: Object.freeze({
      filename: 'sdxl_vae.safetensors',
      targetSubdir: 'vae',
      displayName: 'SDXL VAE',
      downloadUrl: 'https://huggingface.co/stabilityai/sdxl-vae/resolve/main/sdxl_vae.safetensors',
      sizeBytes: 334643268,
      sha256: '63aeecb90ff7bc1c115395962d3e803571385b61938377bc7089b36e81e92e2e',
    }),
  }),
})
const LORA_FACTORY_ROOT_SETTING_KEYS = Object.freeze({
  anima: 'animaLoraFactoryRootPath',
  sdxl: 'sdxlLoraFactoryRootPath',
})
const FLOW_ADVANCED_TEMPLATES = FLOW_AI_TEMPLATES.filter((template) => (
  FLOW_AI_TEMPLATE_INFO[template.id]?.presentation !== 'recipe'
))

function getComfyModelBasename(value = '') {
  return String(value || '').trim().split(/[\\/]/).pop() || ''
}

function getNodeIcon(nodeType) {
  switch (nodeType) {
    case FLOW_AI_NODE_TYPES.promptAssist:
      return Wand2
    case FLOW_AI_NODE_TYPES.textViewer:
    case FLOW_AI_NODE_TYPES.prompt:
      return Type
    case FLOW_AI_NODE_TYPES.imageInput:
    case FLOW_AI_NODE_TYPES.styleReference:
      return ImageIcon
    case FLOW_AI_NODE_TYPES.imageGen:
      return Sparkles
    case FLOW_AI_NODE_TYPES.videoGen:
      return Film
    case FLOW_AI_NODE_TYPES.videoUpscale:
      return ArrowUpDown
    case FLOW_AI_NODE_TYPES.musicGen:
      return Music
    case FLOW_AI_NODE_TYPES.output:
      return Download
    default:
      return Boxes
  }
}

function shallowStringArrayEqual(left = [], right = []) {
  if (left === right) return true
  if (!Array.isArray(left) || !Array.isArray(right)) return false
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

function formatRuntimeLabel(workflowId = '') {
  const summary = getFlowWorkflowSummary(workflowId)
  if (!summary) return ''
  return `${summary.label} · ${summary.runtime === 'cloud' ? 'Cloud' : 'Local'}`
}

function formatAssetOutputDestination(folderName = '', assetKind = '') {
  return getFlowOutputDestinationLabel(folderName, assetKind)
}

function formatAssetOutputDestinationSummary(folderName = '') {
  const normalized = String(folderName || '').trim()
  if (normalized) return formatAssetOutputDestination(folderName)
  const autoDestinations = ['image', 'video', 'audio']
    .map((assetKind) => formatAssetOutputDestination('', assetKind).replace(/^Assets \/ /, ''))
  return `Assets / ${autoDestinations.join(' · ')}`
}

const FLOW_BUSY_STATUSES = new Set(['checking', 'queuing', 'running'])
const FLOW_PORT_VISUALS = Object.freeze({
  text: {
    label: 'Text',
    color: '#a78bfa',
    soft: 'rgba(167, 139, 250, 0.18)',
    shadow: 'rgba(167, 139, 250, 0.42)',
    edge: 'rgba(167, 139, 250, 0.5)',
  },
  image: {
    label: 'Image',
    color: '#34d399',
    soft: 'rgba(52, 211, 153, 0.18)',
    shadow: 'rgba(52, 211, 153, 0.36)',
    edge: 'rgba(52, 211, 153, 0.46)',
  },
  video: {
    label: 'Video',
    color: '#38bdf8',
    soft: 'rgba(56, 189, 248, 0.18)',
    shadow: 'rgba(56, 189, 248, 0.42)',
    edge: 'rgba(56, 189, 248, 0.5)',
  },
  audio: {
    label: 'Audio',
    color: '#f59e0b',
    soft: 'rgba(245, 158, 11, 0.18)',
    shadow: 'rgba(245, 158, 11, 0.42)',
    edge: 'rgba(245, 158, 11, 0.48)',
  },
  style: {
    label: 'Style',
    color: '#e879f9',
    soft: 'rgba(232, 121, 249, 0.18)',
    shadow: 'rgba(232, 121, 249, 0.44)',
    edge: 'rgba(232, 121, 249, 0.5)',
  },
  any: {
    label: 'Any',
    color: '#94a3b8',
    soft: 'rgba(148, 163, 184, 0.16)',
    shadow: 'rgba(148, 163, 184, 0.3)',
    edge: 'rgba(148, 163, 184, 0.42)',
  },
})
const FLOW_PORT_LEGEND = Object.freeze(['text', 'image', 'video', 'audio', 'style'])
const CANVAS_ANALYSIS_MODE_KEYS = Object.freeze({
  Comprehensive: 'comprehensive',
  'Subject / Identity': 'subjectIdentity',
  'Action / Emotion': 'actionEmotion',
  'Face & Expression Focus': 'faceExpression',
  'Prop & Object Interaction': 'propInteraction',
  'Lighting & Camera': 'lightingCamera',
  'Cinematic Composition': 'cinematicComposition',
  'Style & Aesthetics': 'styleAesthetics',
  'Color Palette & Texture': 'colorTexture',
  'Motion Focus': 'motionFocus',
  'Camera Tracking': 'cameraTracking',
  'Temporal Flow': 'temporalFlow',
  'Physics & Momentum': 'physicsMomentum',
  'Background Dynamics': 'backgroundDynamics',
})

function resolveFlowPortVisualType(portType = '', portLabel = '') {
  const normalizedType = String(portType || '').trim().toLowerCase()
  const normalizedLabel = String(portLabel || '').trim().toLowerCase()
  if (normalizedType === 'image' && normalizedLabel.includes('style')) return 'style'
  if (FLOW_PORT_VISUALS[normalizedType]) return normalizedType
  return 'any'
}

function getFlowPortVisual(portType = '', portLabel = '') {
  return FLOW_PORT_VISUALS[resolveFlowPortVisualType(portType, portLabel)] || FLOW_PORT_VISUALS.any
}

function getFlowPortDisplayLabel(port = {}) {
  const label = String(port?.label || '').trim()
  if (!label || label.toLowerCase() === 'input') {
    return getFlowPortVisual(port?.type, port?.label).label
  }
  return label
}

function getImageVariantBadge(workflowId = '', variantCount = 1) {
  const behavior = getFlowImageVariantBehavior(workflowId)
  if (behavior.mode === 'fixed') {
    return `${behavior.fixedCount} fixed outputs`
  }
  const normalizedCount = normalizeFlowImageVariantCount(variantCount, workflowId)
  if (normalizedCount <= 1) return ''
  return `${normalizedCount} variants`
}

function getImageVariantInspectorNote(workflowId = '', variantCount = 1) {
  const behavior = getFlowImageVariantBehavior(workflowId)
  if (behavior.mode === 'fixed') {
    return `This workflow already returns ${behavior.fixedCount} images in one run. Branch specific variants later with a selector node.`
  }
  const normalizedCount = normalizeFlowImageVariantCount(variantCount, workflowId)
  if (normalizedCount <= 1) {
    return 'Generate one image from this node. Increase Variants to bundle multiple results into Assets.'
  }
  if (behavior.mode === 'native') {
    return `This workflow will request ${normalizedCount} image variants in one bundled run. Connect it to Asset Output to save the whole set.`
  }
  return `This workflow will run ${normalizedCount} times and bundle the image variants together. Downstream variant picking is not supported yet.`
}

const FLOW_NODE_PREVIEW_TYPES = Object.freeze(['image', 'video', 'audio'])
const FLOW_NODE_PREVIEW_MAX_OUTPUT_ITEMS = 3
const FLOW_NODE_PREVIEW_VISIBILITY_MARGIN_PX = 220
const FLOW_NODE_PREVIEW_VIDEO_STEP_MS = 240
const FLOW_NODE_PREVIEW_AUDIO_SAMPLE_COUNT = 160
const FLOW_NODE_PREVIEW_AUDIO_BAR_COUNT = 28
const FLOW_GRAPH_HISTORY_LIMIT = 60
const FLOW_PASTE_OFFSET_PX = 48
const FLOW_AI_INSPECTOR_WIDTH_STORAGE_KEY = 'comfystudio-flow-ai-inspector-width'
const FLOW_AI_INSPECTOR_DEFAULT_WIDTH = 380
const FLOW_AI_INSPECTOR_MIN_WIDTH = 340
const FLOW_AI_INSPECTOR_MAX_WIDTH = 680

function getDatasetAssetSourcePath(asset, projectHandle) {
  if (String(asset?.absolutePath || '').trim()) return String(asset.absolutePath).trim()
  const recordedPath = String(asset?.path || '').trim()
  if (!recordedPath) return ''
  if (/^(?:[a-z]:[\\/]|\\\\|\/)/i.test(recordedPath)) return recordedPath
  return typeof projectHandle === 'string' && projectHandle ? { projectHandle, recordedPath } : ''
}

function sanitizeDatasetFilename(value = '', fallback = 'training-image.png') {
  const normalized = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim()
  return normalized || fallback
}

function ensureDatasetImageExtension(filename = '', sourcePath = '', asset = {}) {
  const normalizedName = String(filename || '').trim()
  if (/\.(?:png|jpe?g|webp|gif|bmp|tiff?)$/i.test(normalizedName)) return normalizedName
  const sourceExtension = String(sourcePath || '').match(/\.(png|jpe?g|webp|gif|bmp|tiff?)(?:[?#].*)?$/i)?.[1]
  if (sourceExtension) return `${normalizedName}.${sourceExtension.toLowerCase()}`
  const mimeExtension = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
  }[String(asset?.mimeType || asset?.typeMime || '').toLowerCase()]
  return `${normalizedName}.${mimeExtension || 'png'}`
}

function clampFlowInspectorWidth(width, workspaceWidth = 0) {
  const numeric = Number(width)
  const fallback = FLOW_AI_INSPECTOR_DEFAULT_WIDTH
  const baseWidth = Number.isFinite(numeric) ? numeric : fallback
  let maxWidth = FLOW_AI_INSPECTOR_MAX_WIDTH
  if (Number.isFinite(workspaceWidth) && workspaceWidth > 0) {
    maxWidth = Math.min(
      FLOW_AI_INSPECTOR_MAX_WIDTH,
      Math.max(FLOW_AI_INSPECTOR_MIN_WIDTH, Math.floor(workspaceWidth - 440))
    )
  }
  return Math.max(FLOW_AI_INSPECTOR_MIN_WIDTH, Math.min(maxWidth, Math.round(baseWidth)))
}

function readStoredFlowInspectorWidth() {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return FLOW_AI_INSPECTOR_DEFAULT_WIDTH
  }
  try {
    return clampFlowInspectorWidth(window.localStorage.getItem(FLOW_AI_INSPECTOR_WIDTH_STORAGE_KEY))
  } catch (_) {
    return FLOW_AI_INSPECTOR_DEFAULT_WIDTH
  }
}

function getFlowPreviewKindIcon(kind = '') {
  if (kind === 'image') return ImageIcon
  if (kind === 'video') return Film
  if (kind === 'audio') return Music
  if (kind === 'output') return Download
  return Sparkles
}

function getFlowPreviewKindLabel(kind = '') {
  if (kind === 'image') return 'Image'
  if (kind === 'video') return 'Video'
  if (kind === 'audio') return 'Audio'
  return 'Preview'
}

function isFlowNodeRunnable(nodeType = '') {
  return getFlowNodeSupportsExecution(nodeType) || nodeType === FLOW_AI_NODE_TYPES.output
}

function doesFlowAssetInputAcceptAsset(node, asset) {
  if (!node || !asset) return false
  if (node.type === FLOW_AI_NODE_TYPES.styleReference) return asset.type === 'image'
  if (node.type !== FLOW_AI_NODE_TYPES.imageInput) return false
  if (node?.data?.assetRole === 'mask') return asset.type === 'image' || asset.type === 'mask'
  return asset.type === 'image' || asset.type === 'video'
}

function getFlowNodeResetStatusMessage(nodeType = '') {
  if (nodeType === FLOW_AI_NODE_TYPES.promptAssist) return 'Write a brief or connect a Prompt node, then run to refine it.'
  if (nodeType === FLOW_AI_NODE_TYPES.textViewer) return 'Connect a text-producing node to inspect it here.'
  if (nodeType === FLOW_AI_NODE_TYPES.imageInput) return 'Pick an asset from the project.'
  if (nodeType === FLOW_AI_NODE_TYPES.styleReference) return 'Optional reference for edit-capable image workflows.'
  if (nodeType === FLOW_AI_NODE_TYPES.videoUpscale) return 'Connect a video branch and run to upscale it.'
  if (nodeType === FLOW_AI_NODE_TYPES.output) return 'Sends connected results to the Assets panel.'
  return ''
}

function buildFlowGraphNodeSnapshot(node, options = {}) {
  if (!node?.id || !node?.type) return null
  const rawData = node?.data && typeof node.data === 'object' ? node.data : {}
  const nextData = Object.fromEntries(
    Object.entries(rawData).filter(([key]) => !String(key || '').startsWith('_'))
  )
  nextData.status = 'idle'
  nextData.statusMessage = getFlowNodeResetStatusMessage(node.type)
  nextData.error = ''
  nextData.progress = 0
  nextData.lastPromptId = null
  nextData.lastRunAt = null
  if (!options.preserveOutputs) {
    nextData.outputAssetIds = []
    nextData.resolvedAssetIds = []
    if (Object.prototype.hasOwnProperty.call(nextData, 'outputText')) {
      nextData.outputText = ''
    }
  }
  const snapshot = {
    id: options.id || String(node.id),
    type: String(node.type),
    position: {
      x: Number(node?.position?.x) || 0,
      y: Number(node?.position?.y) || 0,
    },
    data: nextData,
    ...(options.selected ? { selected: true } : {}),
  }
  if (node?.style && typeof node.style === 'object') {
    const width = Number(node.style.width)
    const height = Number(node.style.height)
    const preservedStyle = {}
    if (Number.isFinite(width) && width > 0) preservedStyle.width = width
    if (Number.isFinite(height) && height > 0) preservedStyle.height = height
    if (Object.keys(preservedStyle).length > 0) {
      snapshot.style = preservedStyle
    }
  }
  return snapshot
}

function buildFlowGraphEdgeSnapshot(edge, options = {}) {
  if (!edge?.source || !edge?.target) return null
  return {
    id: options.id || String(edge.id || `flow_edge_${Date.now()}`),
    source: String(options.source || edge.source),
    target: String(options.target || edge.target),
    sourceHandle: options.sourceHandle !== undefined ? options.sourceHandle : (edge.sourceHandle || null),
    targetHandle: options.targetHandle !== undefined ? options.targetHandle : (edge.targetHandle || null),
    animated: false,
    ...(options.selected ? { selected: true } : {}),
  }
}

function buildFlowGraphHistorySnapshot(nodes = [], edges = []) {
  const snapshot = {
    nodes: (nodes || []).map((node) => buildFlowGraphNodeSnapshot(node, { preserveOutputs: true })).filter(Boolean),
    edges: (edges || []).map((edge) => buildFlowGraphEdgeSnapshot(edge)).filter(Boolean),
  }
  return {
    ...snapshot,
    signature: JSON.stringify(snapshot),
  }
}

function buildFlowClipboardPayload(nodes = [], edges = [], selectedNodeIds = []) {
  const selectedIdSet = new Set((selectedNodeIds || []).filter(Boolean))
  const copiedNodes = (nodes || [])
    .filter((node) => selectedIdSet.has(node.id))
    .map((node) => buildFlowGraphNodeSnapshot(node, { preserveOutputs: false }))
    .filter(Boolean)
  const copiedEdges = (edges || [])
    .filter((edge) => selectedIdSet.has(edge.source) && selectedIdSet.has(edge.target))
    .map((edge) => buildFlowGraphEdgeSnapshot(edge))
    .filter(Boolean)
  return {
    nodes: copiedNodes,
    edges: copiedEdges,
    pasteCount: 0,
  }
}

function cloneFlowClipboardPayload(payload, pasteCount = 1) {
  const normalizedPasteCount = Math.max(1, Number(pasteCount) || 1)
  const offset = FLOW_PASTE_OFFSET_PX * normalizedPasteCount
  const nodeIdMap = new Map()
  const nodes = (payload?.nodes || []).map((node) => {
    const cloned = buildFlowGraphNodeSnapshot(node, {
      id: `${node.id}_copy_${Math.random().toString(36).slice(2, 8)}`,
      preserveOutputs: false,
      selected: true,
    })
    if (!cloned) return null
    cloned.position = {
      x: (Number(node?.position?.x) || 0) + offset,
      y: (Number(node?.position?.y) || 0) + offset,
    }
    nodeIdMap.set(node.id, cloned.id)
    return cloned
  }).filter(Boolean)

  const edges = (payload?.edges || []).map((edge) => {
    const source = nodeIdMap.get(edge.source)
    const target = nodeIdMap.get(edge.target)
    if (!source || !target) return null
    return buildFlowGraphEdgeSnapshot(edge, {
      id: `${edge.id}_copy_${Math.random().toString(36).slice(2, 8)}`,
      source,
      target,
      selected: false,
    })
  }).filter(Boolean)

  return { nodes, edges }
}

function hasMeaningfulFlowNodeChanges(changes = []) {
  return (changes || []).some((change) => {
    if (!change) return false
    if (change.type === 'select' || change.type === 'dimensions') return false
    if (change.type === 'position') return false
    return true
  })
}

function hasMeaningfulFlowEdgeChanges(changes = []) {
  return (changes || []).some((change) => change && change.type !== 'select')
}

function isTypingTarget(target) {
  return target instanceof HTMLElement
    && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.tagName === 'SELECT'
      || target.isContentEditable
    )
}

function getFlowPreviewAssetKind(asset = null) {
  const normalizedType = String(asset?.type || '').trim().toLowerCase()
  if (normalizedType === 'mask') return 'image'
  return FLOW_NODE_PREVIEW_TYPES.includes(normalizedType) ? normalizedType : ''
}

function getFlowPreviewAssetLabel(asset = null) {
  return String(asset?.name || asset?.path || asset?.id || '').trim()
}

function getFlowPreviewAssetUrl(asset = null) {
  if (!asset) return ''
  if (asset.type === 'video' && asset.playbackCacheUrl && hasUsablePlaybackCache(asset)) {
    return String(asset.playbackCacheUrl || '')
  }
  return String(asset.url || '')
}

function sanitizeFlowPreviewSprite(sprite = null) {
  if (!sprite?.frames?.length || !sprite?.url) return null
  return {
    url: sprite.url,
    width: Number(sprite.width) || 0,
    height: Number(sprite.height) || 0,
    frameWidth: Number(sprite.frameWidth) || 0,
    frameHeight: Number(sprite.frameHeight) || 0,
    frameCount: Number(sprite.frameCount) || sprite.frames.length || 0,
    framesPerRow: Number(sprite.framesPerRow) || 0,
    duration: Number(sprite.duration) || 0,
    frameInterval: Number(sprite.frameInterval) || 0,
    frames: sprite.frames,
  }
}

function createFlowPreviewItem(asset = null, options = {}) {
  const kind = getFlowPreviewAssetKind(asset)
  if (!asset?.id || !kind) return null
  return {
    assetId: asset.id,
    key: `${asset.id}:${kind}`,
    kind,
    label: getFlowPreviewAssetLabel(asset),
    url: getFlowPreviewAssetUrl(asset),
    duration: Number(asset?.duration || asset?.settings?.duration || 0) || 0,
    sprite: sanitizeFlowPreviewSprite(asset?.sprite),
    spriteGenerating: Boolean(asset?.spriteGenerating),
    count: Math.max(1, Number(options.count) || 1),
  }
}

function buildFlowPreviewPlaceholder(node) {
  const isBusy = FLOW_BUSY_STATUSES.has(String(node?.data?.status || ''))
  switch (node?.type) {
    case FLOW_AI_NODE_TYPES.imageInput:
      return {
        kind: 'image',
        tone: 'neutral',
        title: 'No source asset yet',
        hint: 'Choose an image or video to feed this branch.',
        titleKey: 'canvas.preview.noSource',
        hintKey: 'canvas.preview.noSourceHelp',
      }
    case FLOW_AI_NODE_TYPES.styleReference:
      return {
        kind: 'image',
        tone: 'neutral',
        title: 'No style reference yet',
        hint: 'Pick a reference image to guide the look.',
        titleKey: 'canvas.preview.noStyle',
        hintKey: 'canvas.preview.noStyleHelp',
      }
    case FLOW_AI_NODE_TYPES.imageGen:
      return {
        kind: 'image',
        tone: isBusy ? 'processing' : 'neutral',
        title: isBusy ? 'Generating image preview' : 'Run node to see image output',
        hint: isBusy ? 'The latest result will appear here.' : 'Latest generated image variants preview here.',
        titleKey: isBusy ? 'canvas.preview.generatingImage' : 'canvas.preview.runForImage',
        hintKey: isBusy ? 'canvas.preview.latestWillAppear' : 'canvas.preview.imageVariantsHelp',
      }
    case FLOW_AI_NODE_TYPES.videoGen:
      return {
        kind: 'video',
        tone: isBusy ? 'processing' : 'neutral',
        title: isBusy ? 'Generating video preview' : 'Run node to see video output',
        hint: isBusy ? 'A live motion preview will appear after render.' : 'Sprite-based motion preview appears here.',
        titleKey: isBusy ? 'canvas.preview.generatingVideo' : 'canvas.preview.runForVideo',
        hintKey: isBusy ? 'canvas.preview.motionAfterRender' : 'canvas.preview.spriteHelp',
      }
    case FLOW_AI_NODE_TYPES.videoUpscale:
      return {
        kind: 'video',
        tone: isBusy ? 'processing' : 'neutral',
        title: isBusy ? 'Upscaling video preview' : 'Run node to see upscaled output',
        hint: isBusy ? 'The Topaz result will appear here when it finishes.' : 'Connect a video and the upscaled clip will preview here.',
        titleKey: isBusy ? 'canvas.preview.upscalingVideo' : 'canvas.preview.runForUpscale',
        hintKey: isBusy ? 'canvas.preview.topazWillAppear' : 'canvas.preview.upscaleHelp',
      }
    case FLOW_AI_NODE_TYPES.musicGen:
      return {
        kind: 'audio',
        tone: isBusy ? 'processing' : 'neutral',
        title: isBusy ? 'Generating audio preview' : 'Run node to see audio output',
        hint: isBusy ? 'Waveform preview updates when the result lands.' : 'Waveform preview appears here after render.',
        titleKey: isBusy ? 'canvas.preview.generatingAudio' : 'canvas.preview.runForAudio',
        hintKey: isBusy ? 'canvas.preview.waveformUpdates' : 'canvas.preview.waveformHelp',
      }
    case FLOW_AI_NODE_TYPES.output:
      return {
        kind: 'output',
        tone: 'neutral',
        title: 'Awaiting final assets',
        hint: 'Connected image, video, and audio results preview here.',
        titleKey: 'canvas.preview.awaitingAssets',
        hintKey: 'canvas.preview.awaitingAssetsHelp',
      }
    default:
      return null
  }
}

function buildOutputPreviewItems(assetIds = [], assetById = new Map()) {
  const grouped = new Map()
  for (const assetId of assetIds || []) {
    const asset = assetById.get(assetId)
    const kind = getFlowPreviewAssetKind(asset)
    if (!asset || !kind) continue
    const existing = grouped.get(kind)
    if (existing) {
      existing.count += 1
      continue
    }
    const item = createFlowPreviewItem(asset, { count: 1 })
    if (item) grouped.set(kind, item)
  }

  return FLOW_NODE_PREVIEW_TYPES
    .map((kind) => grouped.get(kind))
    .filter(Boolean)
    .slice(0, FLOW_NODE_PREVIEW_MAX_OUTPUT_ITEMS)
}

function buildFlowNodePreviewPayload(node, assetById = new Map()) {
  if (!node) return { items: [], placeholder: null }

  if (node.type === FLOW_AI_NODE_TYPES.imageInput || node.type === FLOW_AI_NODE_TYPES.styleReference) {
    const asset = assetById.get(String(node?.data?.assetId || '').trim())
    const item = createFlowPreviewItem(asset)
    return {
      items: item ? [item] : [],
      placeholder: item ? null : buildFlowPreviewPlaceholder(node),
    }
  }

  if (node.type === FLOW_AI_NODE_TYPES.output) {
    const items = buildOutputPreviewItems(node?.data?.resolvedAssetIds || [], assetById)
    return {
      items,
      placeholder: items.length > 0 ? null : buildFlowPreviewPlaceholder(node),
    }
  }

  if (
    node.type === FLOW_AI_NODE_TYPES.imageGen
    || node.type === FLOW_AI_NODE_TYPES.videoGen
    || node.type === FLOW_AI_NODE_TYPES.videoUpscale
    || node.type === FLOW_AI_NODE_TYPES.musicGen
  ) {
    const outputAssetIds = Array.isArray(node?.data?.outputAssetIds) ? node.data.outputAssetIds : []
    const firstAsset = outputAssetIds.map((assetId) => assetById.get(assetId)).find(Boolean)
    const item = createFlowPreviewItem(firstAsset, { count: outputAssetIds.length })
    return {
      items: item ? [item] : [],
      placeholder: item ? null : buildFlowPreviewPlaceholder(node),
    }
  }

  return { items: [], placeholder: null }
}

function isFlowNodePreviewVisible(node, viewport, canvasBounds) {
  if (!canvasBounds?.width || !canvasBounds?.height) return true
  const zoom = Number(viewport?.zoom) || 1
  const offsetX = Number(viewport?.x) || 0
  const offsetY = Number(viewport?.y) || 0
  const nodeX = Number(node?.positionAbsolute?.x ?? node?.position?.x ?? 0)
  const nodeY = Number(node?.positionAbsolute?.y ?? node?.position?.y ?? 0)
  const nodeWidth = (Number(node?.measured?.width) || Number(node?.width) || 260) * zoom
  const nodeHeight = (Number(node?.measured?.height) || Number(node?.height) || 240) * zoom
  const screenLeft = (nodeX * zoom) + offsetX
  const screenTop = (nodeY * zoom) + offsetY
  const screenRight = screenLeft + nodeWidth
  const screenBottom = screenTop + nodeHeight
  return (
    screenRight >= -FLOW_NODE_PREVIEW_VISIBILITY_MARGIN_PX
    && screenBottom >= -FLOW_NODE_PREVIEW_VISIBILITY_MARGIN_PX
    && screenLeft <= canvasBounds.width + FLOW_NODE_PREVIEW_VISIBILITY_MARGIN_PX
    && screenTop <= canvasBounds.height + FLOW_NODE_PREVIEW_VISIBILITY_MARGIN_PX
  )
}

function sampleFlowWaveformBars(peaks = [], targetCount = FLOW_NODE_PREVIEW_AUDIO_BAR_COUNT) {
  if (!peaks?.length) return []
  const bars = []
  for (let index = 0; index < targetCount; index += 1) {
    const start = Math.floor((index / targetCount) * peaks.length)
    const end = Math.max(start + 1, Math.floor(((index + 1) / targetCount) * peaks.length))
    let peak = 0
    for (let cursor = start; cursor < end; cursor += 1) {
      peak = Math.max(peak, Number(peaks[cursor] || 0))
    }
    bars.push(Math.max(0.12, Math.min(1, peak)))
  }
  return bars
}

const FlowPreviewPlaceholder = memo(function FlowPreviewPlaceholder({ placeholder, active }) {
  const { t } = useI18n()
  if (!placeholder) return null
  const Icon = getFlowPreviewKindIcon(placeholder.kind)
  const isProcessing = placeholder.tone === 'processing'
  return (
    <div className={`relative overflow-hidden rounded-xl border px-3 py-3 ${
      isProcessing
        ? 'border-sky-400/25 bg-sky-400/8'
        : 'border-sf-dark-700 bg-sf-dark-950/80'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-lg border p-2 ${
          isProcessing
            ? 'border-sky-400/35 bg-sky-400/10 text-sky-200'
            : 'border-white/10 bg-sf-dark-900 text-sf-text-muted'
        }`}>
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Icon className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-sf-text-primary">
            {t(placeholder.titleKey, {}, placeholder.title)}
          </div>
          <div className="mt-1 text-[10px] leading-5 text-sf-text-muted">
            {t(placeholder.hintKey, {}, placeholder.hint)}
          </div>
        </div>
      </div>
      <div
        className="pointer-events-none absolute inset-x-[-35%] top-0 h-full bg-gradient-to-r from-transparent via-white/8 to-transparent"
        style={{
          animation: 'flow-ai-preview-sheen 2.6s linear infinite',
          animationPlayState: active ? 'running' : 'paused',
          opacity: isProcessing ? 1 : 0.45,
        }}
      />
    </div>
  )
})

const FlowAudioPreview = memo(function FlowAudioPreview({ url, active }) {
  const [waveform, setWaveform] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!url) {
      setWaveform(null)
      return () => {
        cancelled = true
      }
    }
    if (!active) {
      return () => {
        cancelled = true
      }
    }

    getAudioWaveformData(url, FLOW_NODE_PREVIEW_AUDIO_SAMPLE_COUNT)
      .then((result) => {
        if (!cancelled) setWaveform(result)
      })
      .catch(() => {
        if (!cancelled) setWaveform(null)
      })

    return () => {
      cancelled = true
    }
  }, [active, url])

  const bars = useMemo(
    () => sampleFlowWaveformBars(waveform?.peaks || [], FLOW_NODE_PREVIEW_AUDIO_BAR_COUNT),
    [waveform]
  )

  return (
    <div className="relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,rgba(245,158,11,0.12),rgba(9,9,11,0.95))]">
      <div className="absolute inset-0 flex items-center gap-[2px] px-2.5">
        {(bars.length > 0 ? bars : new Array(FLOW_NODE_PREVIEW_AUDIO_BAR_COUNT).fill(0.22)).map((value, index) => (
          <div
            key={index}
            className="min-w-0 flex-1 rounded-full bg-amber-300/80"
            style={{
              height: `${Math.max(16, value * 100)}%`,
              opacity: Math.max(0.3, value),
            }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-[-38%] w-[32%] bg-gradient-to-r from-transparent via-white/18 to-transparent mix-blend-screen"
        style={{
          animation: 'flow-ai-audio-scan 2.8s linear infinite',
          animationPlayState: active ? 'running' : 'paused',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-white/6" />
    </div>
  )
})

const FlowPreviewTile = memo(function FlowPreviewTile({ item, active, previewStep, compact = false }) {
  const { t } = useI18n()
  const framePosition = useMemo(() => {
    if (item?.kind !== 'video' || !item?.sprite?.frames?.length) return null
    const totalFrames = Math.max(1, Number(item.sprite.frameCount) || item.sprite.frames.length || 1)
    if (totalFrames <= 1) {
      return getSpriteFramePosition(item.sprite, 0)
    }
    const cycleSpan = Math.max(1, (totalFrames - 1) * 2)
    const cursor = Math.abs(Number(previewStep) || 0) % cycleSpan
    const pingPongFrame = cursor < totalFrames ? cursor : (cycleSpan - cursor)
    const duration = Math.max(0.001, Number(item.sprite.duration) || Number(item.duration) || 1)
    const time = (pingPongFrame / Math.max(1, totalFrames - 1)) * duration
    return getSpriteFramePosition(item.sprite, time)
  }, [item, previewStep])

  const spriteStyle = useMemo(() => {
    if (!item?.sprite?.url || !item?.sprite?.frameWidth || !item?.sprite?.frameHeight || !framePosition) return null
    return {
      width: `${(item.sprite.width / item.sprite.frameWidth) * 100}%`,
      height: `${(item.sprite.height / item.sprite.frameHeight) * 100}%`,
      left: `-${(framePosition.x / item.sprite.frameWidth) * 100}%`,
      top: `-${(framePosition.y / item.sprite.frameHeight) * 100}%`,
      backgroundImage: `url(${item.sprite.url})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
    }
  }, [framePosition, item])

  const countLabel = item?.count > 1 ? `+${item.count - 1}` : ''
  const itemKindLabel = getFlowPreviewKindLabel(item?.kind)
  const isVideoWithoutSprite = item?.kind === 'video' && !spriteStyle
  const FallbackIcon = getFlowPreviewKindIcon(item?.kind)

  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/8 bg-sf-dark-950/85 ${
      compact ? 'h-24' : 'h-28'
    }`}>
      {item?.kind === 'image' && item?.url && (
        <>
          <img
            src={item.url}
            alt={item.label || itemKindLabel}
            className="flow-ai-preview-drift h-full w-full object-cover"
            style={{ animationPlayState: active ? 'running' : 'paused' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-white/5" />
        </>
      )}

      {item?.kind === 'video' && spriteStyle && (
        <>
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute"
              style={spriteStyle}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-white/5" />
        </>
      )}

      {item?.kind === 'audio' && item?.url && (
        <FlowAudioPreview url={item.url} active={active} />
      )}

      {isVideoWithoutSprite && (
        <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(180deg,rgba(56,189,248,0.14),rgba(9,9,11,0.96))]">
          <div className="text-center">
            <div className="mx-auto inline-flex rounded-full border border-sky-400/30 bg-sky-400/12 p-2 text-sky-200">
              {item?.spriteGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Film className="h-4 w-4" />}
            </div>
            <div className="mt-2 text-[10px] font-medium text-sf-text-primary">
              {item?.spriteGenerating ? t('canvas.preview.building') : t('canvas.preview.preparing')}
            </div>
          </div>
        </div>
      )}

      {!item?.url && item?.kind !== 'video' && (
        <div className="absolute inset-0 flex items-center justify-center bg-sf-dark-950/90">
          <div className="rounded-full border border-white/10 bg-sf-dark-900 p-2 text-sf-text-muted">
            <FallbackIcon className="h-4 w-4" />
          </div>
        </div>
      )}

      <div className="absolute left-2 top-2 rounded-full border border-black/10 bg-black/55 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/88 backdrop-blur">
        {itemKindLabel}
      </div>
      {countLabel && (
        <div className="absolute right-2 top-2 rounded-full border border-sf-accent/30 bg-sf-accent/18 px-2 py-0.5 text-[10px] font-semibold text-white">
          {countLabel}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 px-2.5 py-2">
        <div className="truncate text-[10px] font-medium text-white/92">
          {item?.label || itemKindLabel}
        </div>
      </div>
    </div>
  )
})

const FlowNodePreview = memo(function FlowNodePreview({
  type,
  previewItems,
  previewPlaceholder,
  previewActive,
  previewStep,
  onActivate = null,
}) {
  const { t } = useI18n()
  if (type === FLOW_AI_NODE_TYPES.prompt) return null
  if (!previewItems?.length && !previewPlaceholder) return null

  if (!previewItems?.length) {
    const placeholderContent = <FlowPreviewPlaceholder placeholder={previewPlaceholder} active={previewActive} />
    return (
      <div className="mt-3">
        {typeof onActivate === 'function' ? (
          <button
            type="button"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={onActivate}
            className="nodrag nopan block w-full rounded-xl text-left outline-none transition-shadow hover:ring-1 hover:ring-emerald-400/55 focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label={t('canvas.assets.chooseExisting')}
          >
            {placeholderContent}
          </button>
        ) : placeholderContent}
      </div>
    )
  }

  if (type === FLOW_AI_NODE_TYPES.output && previewItems.length > 1) {
    return (
      <div className={`mt-3 grid gap-2 ${previewItems.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {previewItems.slice(0, FLOW_NODE_PREVIEW_MAX_OUTPUT_ITEMS).map((item) => (
          <FlowPreviewTile
            key={item.key}
            item={item}
            active={previewActive}
            previewStep={previewStep}
            compact
          />
        ))}
      </div>
    )
  }

  const previewContent = (
    <FlowPreviewTile
      item={previewItems[0]}
      active={previewActive}
      previewStep={previewStep}
    />
  )
  return (
    <div className="mt-3">
      {typeof onActivate === 'function' ? (
        <button
          type="button"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={onActivate}
          className="nodrag nopan block w-full rounded-xl text-left outline-none transition-shadow hover:ring-1 hover:ring-emerald-400/55 focus-visible:ring-2 focus-visible:ring-emerald-400"
          aria-label={t('canvas.assets.replaceExisting')}
        >
          {previewContent}
        </button>
      ) : previewContent}
    </div>
  )
})

const FlowCanvasEdge = memo(function FlowCanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  selected,
  data,
}) {
  const { t } = useI18n()
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const isActive = Boolean(data?.isActive)
  const portVisual = getFlowPortVisual(data?.portType, data?.portLabel)
  const activeColor = portVisual.color
  const idleColor = selected ? activeColor : portVisual.edge

  return (
    <g>
      {isActive && (
        <BaseEdge
          path={edgePath}
          interactionWidth={28}
          style={{
            stroke: activeColor,
            strokeOpacity: 0.18,
            strokeWidth: 10,
            ...style,
          }}
        />
      )}
      <BaseEdge
        path={edgePath}
        interactionWidth={28}
        style={{
          stroke: isActive ? activeColor : idleColor,
          strokeWidth: isActive ? 2.6 : 1.6,
          filter: isActive ? `drop-shadow(0 0 6px ${portVisual.shadow})` : 'none',
          ...style,
        }}
      />
      {isActive && (
        <g pointerEvents="none">
          {[0, -0.45, -0.9].map((begin, index) => (
            <circle
              key={String(begin)}
              r={index === 0 ? 3.5 : 2.75}
              fill={activeColor}
              opacity={index === 0 ? 0.95 : 0.75}
            >
              <animateMotion
                dur="1.4s"
                repeatCount="indefinite"
                begin={`${begin}s`}
                path={edgePath}
              />
            </circle>
          ))}
        </g>
      )}
      {selected && typeof data?.onDisconnect === 'function' && (
        <EdgeLabelRenderer>
          <button
            type="button"
            title={t('canvas.actions.disconnectEdge')}
            aria-label={t('canvas.actions.disconnectEdge')}
            className="nodrag nopan absolute flex h-6 w-6 items-center justify-center rounded-full border border-red-500/40 bg-sf-dark-950/95 text-red-200 shadow-lg transition-colors hover:bg-red-500/15"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.stopPropagation()
              data.onDisconnect(id)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </EdgeLabelRenderer>
      )}
    </g>
  )
})

const FLOW_NODE_MIN_WIDTH = 240
const FLOW_NODE_MIN_HEIGHT = 140
const FLOW_NODE_MAX_WIDTH = 900
const FLOW_NODE_MAX_HEIGHT = 1400

const FlowCanvasActionsContext = createContext(null)

const FLOW_REACT_FLOW_PRO_OPTIONS = Object.freeze({ hideAttribution: true })

const FLOW_RESIZER_LINE_STYLE = {
  borderColor: 'transparent',
  borderWidth: 1,
}
const FLOW_RESIZER_HANDLE_STYLE = {
  width: 24,
  height: 24,
  backgroundColor: 'transparent',
  borderColor: 'transparent',
  borderWidth: 0,
}

const FlowNodeResizerControls = memo(function FlowNodeResizerControls({ selected }) {
  const flowActions = useContext(FlowCanvasActionsContext)
  const handleResizeStart = useCallback(() => {
    flowActions?.onResizeStart?.()
  }, [flowActions])
  return (
    <NodeResizer
      isVisible={selected}
      minWidth={FLOW_NODE_MIN_WIDTH}
      minHeight={FLOW_NODE_MIN_HEIGHT}
      maxWidth={FLOW_NODE_MAX_WIDTH}
      maxHeight={FLOW_NODE_MAX_HEIGHT}
      lineStyle={FLOW_RESIZER_LINE_STYLE}
      handleStyle={FLOW_RESIZER_HANDLE_STYLE}
      onResizeStart={handleResizeStart}
    />
  )
})

const FlowCanvasNode = memo(function FlowCanvasNode({ id, data, selected, type }) {
  const { t } = useI18n()
  const flowActions = useContext(FlowCanvasActionsContext)
  const [isPickingImage, setIsPickingImage] = useState(false)
  const [isAssetMenuOpen, setIsAssetMenuOpen] = useState(false)
  const definition = getFlowNodeDefinition(type)
  const Icon = getNodeIcon(type)
  const inputPorts = (definition?.inputs || []).filter((input) => (
    input.id !== 'in:mask' || data?.optionalStage === 'inpaint'
  ))
  const outputPorts = definition?.outputs || []
  const inputCount = inputPorts.length
  const outputCount = outputPorts.length
  const statusLabel = buildNodeStatusSummary({ data })
  const workflowLabel = formatRuntimeLabel(data?.workflowId)
  const isBusy = FLOW_BUSY_STATUSES.has(String(data?.status || ''))
  const outputCountLabel = Array.isArray(data?.outputAssetIds)
    ? data.outputAssetIds.length
    : Array.isArray(data?.resolvedAssetIds)
      ? data.resolvedAssetIds.length
      : 0
  const activeConnectionHandleId = String(data?._activeConnectionHandleId || '')
  const activeConnectionHandleType = String(data?._activeConnectionHandleType || '')
  const imageVariantBadge = type === FLOW_AI_NODE_TYPES.imageGen
    ? getImageVariantBadge(data?.workflowId, data?.variantCount)
    : ''
  const previewItems = Array.isArray(data?._previewItems) ? data._previewItems : []
  const previewPlaceholder = data?._previewPlaceholder || null
  const previewActive = Boolean(data?._previewAnimated)
  const previewStep = Number(data?._previewStep || 0)
  const liveCreditsLabel = (
    type === FLOW_AI_NODE_TYPES.videoUpscale && data?.estimatedCredits
      ? formatCreditsRange(data.estimatedCredits)
      : ''
  )
  const isProjectAssetInput = type === FLOW_AI_NODE_TYPES.imageInput || type === FLOW_AI_NODE_TYPES.styleReference
  const projectAssetOptions = type === FLOW_AI_NODE_TYPES.styleReference
    ? (flowActions?.styleAssetOptions || [])
    : data?.assetRole === 'mask'
      ? (flowActions?.maskAssetOptions || [])
      : (flowActions?.imageInputAssetOptions || [])
  const handleToggleAssetMenu = useCallback((event) => {
    event?.stopPropagation?.()
    setIsAssetMenuOpen((current) => !current)
  }, [])
  const handleChooseProjectAsset = useCallback((event, assetId) => {
    event.stopPropagation()
    flowActions?.onChooseProjectAsset?.(id, assetId)
    setIsAssetMenuOpen(false)
  }, [flowActions, id])
  const handleClearProjectAsset = useCallback((event) => {
    event.stopPropagation()
    flowActions?.onClearProjectAsset?.(id)
    setIsAssetMenuOpen(false)
  }, [flowActions, id])
  const handlePickImage = useCallback(async (event) => {
    event.stopPropagation()
    if (!flowActions?.onPickImage || isPickingImage) return
    setIsAssetMenuOpen(false)
    setIsPickingImage(true)
    try {
      await flowActions.onPickImage(id)
    } finally {
      setIsPickingImage(false)
    }
  }, [flowActions, id, isPickingImage])

  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-xl border bg-sf-dark-900/95 shadow-xl backdrop-blur-sm ${
        selected
          ? 'border-sf-accent shadow-sf-accent/10'
          : isBusy
            ? 'border-sky-400/70 shadow-[0_0_18px_rgba(56,189,248,0.16)]'
            : 'border-sf-dark-700'
      }`}
      style={{ minWidth: FLOW_NODE_MIN_WIDTH, minHeight: FLOW_NODE_MIN_HEIGHT }}
    >
      <FlowNodeResizerControls selected={selected} />
      {inputPorts.map((input, index) => {
        const portVisual = getFlowPortVisual(input.type, input.label)
        const isCandidate = activeConnectionHandleType === 'source'
          && isValidFlowConnection({ sourceHandle: activeConnectionHandleId, targetHandle: input.id })
        return (
          <Handle
            key={input.id}
            type="target"
            position={Position.Left}
            id={input.id}
            title={t('canvas.ports.inputTitle', { label: getFlowPortDisplayLabel(input) })}
            isValidConnection={(connection) => isValidFlowConnection({ ...connection, targetHandle: input.id })}
            className="!h-3.5 !w-3.5 !border-2 transition-all duration-150"
            style={{
              top: 36 + (index * 24),
              left: -8,
              backgroundColor: portVisual.color,
              borderColor: isCandidate ? portVisual.color : 'rgba(9, 9, 11, 0.96)',
              boxShadow: isCandidate
                ? `0 0 0 3px ${portVisual.soft}, 0 0 14px ${portVisual.shadow}`
                : `0 0 0 1px rgba(9, 9, 11, 0.96), 0 0 0 2px ${portVisual.soft}`,
            }}
          />
        )
      })}

      {outputPorts.map((output, index) => {
        const portVisual = getFlowPortVisual(output.type, output.label)
        const isCandidate = activeConnectionHandleType === 'target'
          && isValidFlowConnection({ sourceHandle: output.id, targetHandle: activeConnectionHandleId })
        return (
          <Handle
            key={output.id}
            type="source"
            position={Position.Right}
            id={output.id}
            title={t('canvas.ports.outputTitle', { label: getFlowPortDisplayLabel(output) })}
            isValidConnection={(connection) => isValidFlowConnection({ ...connection, sourceHandle: output.id })}
            className="!h-3.5 !w-3.5 !border-2 transition-all duration-150"
            style={{
              top: 36 + (index * 24),
              right: -8,
              backgroundColor: portVisual.color,
              borderColor: isCandidate ? portVisual.color : 'rgba(9, 9, 11, 0.96)',
              boxShadow: isCandidate
                ? `0 0 0 3px ${portVisual.soft}, 0 0 14px ${portVisual.shadow}`
                : `0 0 0 1px rgba(9, 9, 11, 0.96), 0 0 0 2px ${portVisual.soft}`,
            }}
          />
        )
      })}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-lg border p-2 ${
            isBusy
              ? 'border-sky-400/40 bg-sky-400/10 animate-pulse'
              : 'border-white/10 bg-sf-dark-800'
          }`}>
            <Icon className="h-4 w-4 text-sf-text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-sf-text-primary">
                {t(`canvas.nodes.${type}.label`, {}, data?.label || definition?.label || t('canvas.node'))}
              </div>
              <div className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                data?.status === 'done'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : data?.status === 'error'
                    ? 'bg-red-500/15 text-red-300'
                    : data?.status === 'running' || data?.status === 'checking' || data?.status === 'queuing'
                      ? 'bg-sky-500/15 text-sky-300'
                      : data?.status === 'blocked'
                        ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-sf-dark-800 text-sf-text-muted'
              }`}>
                {isBusy && (
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sky-300 animate-pulse" />
                )}
                {statusLabel}
              </div>
            </div>
            <div className="mt-1 text-[11px] text-sf-text-muted">
              {workflowLabel || t(`canvas.nodes.${type}.description`, {}, definition?.description)}
            </div>
            {imageVariantBadge && (
              <div className="mt-2 inline-flex items-center rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-1 text-[10px] font-medium text-sky-300">
                {imageVariantBadge}
              </div>
            )}

            <FlowNodePreview
              type={type}
              previewItems={previewItems}
              previewPlaceholder={previewPlaceholder}
              previewActive={previewActive}
              previewStep={previewStep}
              onActivate={isProjectAssetInput ? handleToggleAssetMenu : null}
            />
            {isProjectAssetInput && isAssetMenuOpen && (
              <div
                className="nodrag nopan mt-2 overflow-hidden rounded-xl border border-emerald-500/40 bg-sf-dark-950/95 shadow-xl"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="border-b border-sf-dark-700 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  {t('canvas.assets.selectExisting')}
                </div>
                <div className="max-h-44 overflow-y-auto p-1.5">
                  {projectAssetOptions.length > 0 ? projectAssetOptions.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={(event) => handleChooseProjectAsset(event, entry.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-sf-dark-800 ${
                        data?.assetId === entry.id ? 'bg-emerald-500/12 text-emerald-200' : 'text-sf-text-secondary'
                      }`}
                    >
                      {entry.type === 'video' ? <Film className="h-3.5 w-3.5 shrink-0" /> : <ImageIcon className="h-3.5 w-3.5 shrink-0" />}
                      <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    </button>
                  )) : (
                    <div className="px-2.5 py-3 text-[11px] leading-5 text-sf-text-muted">
                      {t('canvas.assets.noMatching')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {(type === FLOW_AI_NODE_TYPES.prompt || type === FLOW_AI_NODE_TYPES.musicGen || type === FLOW_AI_NODE_TYPES.promptAssist || type === FLOW_AI_NODE_TYPES.textViewer) && (
          <div className="mt-3 rounded-lg border border-sf-dark-700 bg-sf-dark-950/70 px-3 py-2 text-[11px] text-sf-text-secondary">
            {type === FLOW_AI_NODE_TYPES.prompt
              ? (String(data?.promptText || '').trim() || t('canvas.nodeMessages.noPrompt'))
              : type === FLOW_AI_NODE_TYPES.musicGen
                ? (String(data?.tags || '').trim() || t('canvas.nodeMessages.noMusicTags'))
                : type === FLOW_AI_NODE_TYPES.promptAssist
                  ? (String(data?.outputText || '').trim() || String(data?.inlinePrompt || '').trim() || t('canvas.nodeMessages.runForPrompt'))
                  : (String(data?._resolvedText || '').trim() || t('canvas.nodeMessages.connectText'))}
          </div>
        )}

        {(type === FLOW_AI_NODE_TYPES.imageInput || type === FLOW_AI_NODE_TYPES.styleReference) && (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-950/70 px-3 py-2 text-[11px] text-sf-text-secondary">
              {data?.assetLabel || t('canvas.assets.noneSelected')}
            </div>
            <button
              type="button"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={handlePickImage}
              disabled={isPickingImage}
              className="nodrag nopan inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-200 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/15 disabled:cursor-wait disabled:opacity-60"
            >
              {isPickingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
              {data?.assetId ? t('canvas.assets.replaceFile') : t('canvas.assets.chooseFile')}
            </button>
            {data?.assetId && (
              <button
                type="button"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={handleClearProjectAsset}
                className="nodrag nopan inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-200 transition-colors hover:border-red-400/55 hover:bg-red-500/15"
              >
                <X className="h-3.5 w-3.5" />
                {t('canvas.assets.clearAssigned')}
              </button>
            )}
          </div>
        )}

        {type === FLOW_AI_NODE_TYPES.output && (
          <div className="mt-3 rounded-lg border border-sf-dark-700 bg-sf-dark-950/70 px-3 py-2 text-[11px] text-sf-text-secondary">
            <div className="font-medium text-sf-text-primary break-words">
              {formatAssetOutputDestinationSummary(data?.folderName)}
            </div>
            <div className="mt-1">
              {outputCountLabel > 0
                ? t('canvas.nodeMessages.connectedAssets', { count: outputCountLabel })
                : (String(data?.folderName || '').trim()
                  ? t('canvas.nodeMessages.connectFinalBranches')
                  : t('canvas.nodeMessages.autoSort'))}
            </div>
          </div>
        )}

        {type !== FLOW_AI_NODE_TYPES.output && type !== FLOW_AI_NODE_TYPES.prompt && type !== FLOW_AI_NODE_TYPES.imageInput && type !== FLOW_AI_NODE_TYPES.styleReference && outputCountLabel > 0 && (
          <div className="mt-3 inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
            {type === FLOW_AI_NODE_TYPES.imageGen && outputCountLabel > 1
              ? t('canvas.nodeMessages.imageVariants', { count: outputCountLabel })
              : t('canvas.nodeMessages.outputAssets', { count: outputCountLabel })}
          </div>
        )}

        {liveCreditsLabel && (
          <div className="mt-3 inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-medium text-amber-200">
            {t('canvas.estimated')} {liveCreditsLabel}
          </div>
        )}

        {data?.statusMessage && (
          <div className="mt-3 text-[11px] text-sf-text-muted">
            {data.statusMessage}
          </div>
        )}

        {data?.error && (
          <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
            {data.error}
          </div>
        )}

        {(inputCount > 0 || outputCount > 0) && (
          <div className="mt-3 space-y-1.5 text-[10px]">
            {inputCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="uppercase tracking-[0.18em] text-sf-text-muted">
                  {t('canvas.ports.in')}
                </span>
                {inputPorts.map((input) => {
                  const portVisual = getFlowPortVisual(input.type, input.label)
                  return (
                    <span
                      key={input.id}
                      className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium"
                      style={{
                        borderColor: portVisual.edge,
                        backgroundColor: portVisual.soft,
                        color: portVisual.color,
                      }}
                    >
                      {getFlowPortDisplayLabel(input)}
                    </span>
                  )
                })}
              </div>
            )}
            {outputCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="uppercase tracking-[0.18em] text-sf-text-muted">
                  {t('canvas.ports.out')}
                </span>
                {outputPorts.map((output) => {
                  const portVisual = getFlowPortVisual(output.type, output.label)
                  return (
                    <span
                      key={output.id}
                      className="inline-flex items-center rounded-full border px-2 py-0.5 font-medium"
                      style={{
                        borderColor: portVisual.edge,
                        backgroundColor: portVisual.soft,
                        color: portVisual.color,
                      }}
                    >
                      {getFlowPortDisplayLabel(output)}
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

function InspectorRow({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-medium text-sf-text-secondary">
        {label}
      </div>
      {children}
    </label>
  )
}

function RecipeAssetField({
  label,
  hint,
  node,
  options,
  required = false,
  assetById,
  onChoose,
  onPick,
  onClear,
  active = false,
  onActivate,
}) {
  const { t } = useI18n()
  const asset = assetById.get(String(node?.data?.assetId || '').trim())
  const posterUrl = asset?.type === 'video' ? asset?.poster?.url : asset?.url
  return (
    <div
      onMouseDownCapture={onActivate}
      className={`rounded-2xl border bg-sf-dark-950/65 p-4 transition-colors ${
        active ? 'border-sky-400/60 ring-1 ring-sky-400/20' : 'border-sf-dark-700'
      }`}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => onPick(node.id)}
          className="relative flex h-24 w-36 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-900 text-sf-text-muted transition-colors hover:border-emerald-400/60"
          title={asset ? t('canvas.assets.replaceFromFile') : t('canvas.assets.chooseFromFile')}
        >
          {posterUrl ? (
            <img src={posterUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="text-center">
              <ImageIcon className="mx-auto h-5 w-5" />
              <div className="mt-2 text-[10px]">{t('canvas.assets.chooseImage')}</div>
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-sf-text-primary">{label}</div>
            {required && (
              <span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-200">
                {t('canvas.required')}
              </span>
            )}
          </div>
          <div className="mt-1 text-[11px] leading-5 text-sf-text-muted">{hint}</div>
          <select
            value={node?.data?.assetId || ''}
            onChange={(event) => {
              if (event.target.value) onChoose(node.id, event.target.value)
              else onClear(node.id)
            }}
            className="mt-3 w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-primary outline-none focus:border-sf-accent"
          >
            <option value="">{t('canvas.assets.noneSelected')}</option>
            {options.map((entry) => (
              <option key={entry.id} value={entry.id}>{entry.label}</option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onPick(node.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-200 hover:border-emerald-400/60"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {asset ? t('canvas.assets.replaceFile') : t('canvas.assets.chooseFile')}
            </button>
            {asset && (
              <button
                type="button"
                onClick={() => onClear(node.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-[11px] text-sf-text-secondary hover:border-red-500/40 hover:text-red-200"
              >
                <X className="h-3.5 w-3.5" />
                {t('canvas.actions.clear')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function LoraDatasetRecipeCanvas({
  document,
  details,
  nodes,
  assetById,
  imageOptions,
  maskOptions,
  styleOptions,
  dependencyByWorkflow,
  isRunning,
  isExportingDataset,
  isStopping,
  onRun,
  onStop,
  onUpdateNode,
  onChooseAsset,
  onPickAsset,
  onClearAsset,
  onPreviewAsset,
  onOpenSetup,
  onOpenGuide,
  activeAssetTargetNodeId,
  onSetAssetTarget,
  datasetPath,
  datasetReady,
  isLaunchingFactory,
  factoryPreparation,
  factoryLaunchError,
  onChooseDatasetOutput,
  onChooseExistingDataset,
  onLaunchFactory,
  onOpenFactorySettings,
}) {
  const { t } = useI18n()
  const sourceNode = nodes.find((node) => node?.data?.datasetRole === 'source')
  const promptNode = nodes.find((node) => node?.data?.excludeFromDatasetExport && node.type === FLOW_AI_NODE_TYPES.prompt)
  const maskNode = nodes.find((node) => node?.data?.assetRole === 'mask')
  const referenceNode = nodes.find((node) => node.type === FLOW_AI_NODE_TYPES.styleReference && node?.data?.excludeFromDatasetExport)
  const inpaintNode = nodes.find((node) => node?.data?.optionalStage === 'inpaint')
  const angleNode = nodes.find((node) => node?.data?.workflowId === 'multi-angles')
  const outputNode = nodes.find((node) => node.type === FLOW_AI_NODE_TYPES.output)
  const inpaintEnabled = inpaintNode?.data?.enabled === true
  const resultAssetIds = Array.from(new Set([
    ...(Array.isArray(angleNode?.data?.outputAssetIds) ? angleNode.data.outputAssetIds : []),
    ...(Array.isArray(outputNode?.data?.resolvedAssetIds) ? outputNode.data.resolvedAssetIds : []),
  ]))
  const resultAssets = resultAssetIds.map((assetId) => assetById.get(assetId)).filter(Boolean)
  const busyNode = nodes.find((node) => FLOW_BUSY_STATUSES.has(String(node?.data?.status || '')))
  const errorNode = nodes.find((node) => node?.data?.status === 'error')
  const blockingDependencies = ['image-edit', 'multi-angles']
    .filter((workflowId) => workflowId !== 'image-edit' || inpaintEnabled)
    .map((workflowId) => dependencyByWorkflow[workflowId])
    .filter((dependency) => dependency?.hasBlockingIssues)
  const phaseLabel = errorNode
    ? t('canvas.recipe.needsAttention')
    : busyNode?.data?.optionalStage === 'inpaint'
      ? t('canvas.recipe.editingMask')
      : busyNode?.data?.workflowId === 'multi-angles'
        ? t('canvas.recipe.generatingAngles')
        : isRunning
          ? t('canvas.recipe.preparing')
          : resultAssets.length > 0
            ? t('canvas.recipe.viewsReady', { count: resultAssets.length })
            : sourceNode?.data?.assetId
              ? t('canvas.recipe.ready')
              : t('canvas.recipe.chooseToBegin')

  if (!sourceNode || !promptNode || !maskNode || !referenceNode || !inpaintNode || !angleNode || !outputNode) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-lg rounded-2xl border border-amber-500/35 bg-amber-500/10 p-5 text-sm text-amber-100">
          {t('canvas.recipe.incompletePreset')}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.10),_transparent_34%),linear-gradient(180deg,#09090b_0%,#050507_100%)] px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="overflow-hidden rounded-3xl border border-sky-400/30 bg-sf-dark-900/95 shadow-[0_28px_80px_rgba(0,0,0,0.42)]">
          <div className="border-b border-sf-dark-700 bg-gradient-to-r from-sky-500/14 via-sf-dark-900 to-sf-dark-900 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-sky-400/35 bg-sky-400/12 p-3 text-sky-200">
                  <Boxes className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-sf-text-primary">{document?.name || details?.title}</h2>
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">
                      Preset recipe
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-sf-text-secondary">
                    Choose one character image. Lumeweft handles the optional edit, eight-angle generation, and Assets delivery automatically.
                  </p>
                </div>
              </div>
              <div className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                errorNode
                  ? 'border-red-500/35 bg-red-500/10 text-red-200'
                  : isRunning
                    ? 'border-sky-400/35 bg-sky-400/10 text-sky-200'
                    : resultAssets.length > 0
                      ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                      : 'border-sf-dark-600 bg-sf-dark-950/60 text-sf-text-secondary'
              }`}>
                {isRunning && <Loader2 className="mr-2 inline h-3.5 w-3.5 animate-spin" />}
                {phaseLabel}
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6">
            <section>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sf-text-muted">{t('canvas.recipe.step1')}</div>
              <RecipeAssetField
                label={t('canvas.recipe.characterImage')}
                hint={t('canvas.recipe.characterImageHelp')}
                node={sourceNode}
                options={imageOptions}
                required
                assetById={assetById}
                onChoose={onChooseAsset}
                onPick={onPickAsset}
                onClear={onClearAsset}
                active={activeAssetTargetNodeId === sourceNode.id}
                onActivate={() => onSetAssetTarget(sourceNode.id)}
              />
              <div className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-400/8 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-sf-text-primary">
                      <FolderOpen className="h-4 w-4 text-sky-300" />
                      {t('canvas.recipe.designSetFolder')}
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-amber-200">{t('canvas.required')}</span>
                    </div>
                    <div className="mt-1 text-[11px] leading-5 text-sf-text-muted">
                      {t('canvas.recipe.designSetFolderHelp')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onChooseDatasetOutput}
                    disabled={isRunning || isExportingDataset}
                    className="inline-flex items-center gap-2 rounded-xl border border-sky-400/35 bg-sf-dark-900 px-3 py-2.5 text-xs font-medium text-sky-100 hover:border-sky-300/60 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {datasetPath ? t('canvas.recipe.changeOutputFolder') : t('canvas.recipe.chooseOutputFolder')}
                  </button>
                </div>
                {datasetPath ? (
                  <div className="mt-3 break-all rounded-lg border border-emerald-400/25 bg-emerald-400/8 px-3 py-2 text-[11px] text-emerald-100">
                    {t('canvas.recipe.automaticExport')}: {datasetPath}
                  </div>
                ) : (
                  <div className="mt-3 text-[10px] text-amber-200">{t('canvas.recipe.chooseOutputRequired')}</div>
                )}
              </div>
            </section>

            <section className={`rounded-2xl border p-4 ${
              inpaintEnabled ? 'border-emerald-500/35 bg-emerald-500/8' : 'border-sf-dark-700 bg-sf-dark-950/45'
            }`}>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={inpaintEnabled}
                  onChange={(event) => onUpdateNode(inpaintNode.id, {
                    enabled: event.target.checked,
                    dependencyStatus: 'unknown',
                    dependencySummary: '',
                    outputAssetIds: [],
                    status: 'idle',
                    statusMessage: event.target.checked
                      ? t('canvas.recipe.maskEditOnStatus')
                      : t('canvas.recipe.inpaintOffStatus'),
                  })}
                  className="mt-1 h-4 w-4 rounded border-sf-dark-600 bg-sf-dark-950 text-emerald-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-sf-text-primary">{t('canvas.recipe.maskedEdit')}</span>
                  <span className="mt-1 block text-xs leading-5 text-sf-text-muted">
                    {t('canvas.recipe.maskedEditHelp')}
                  </span>
                </span>
                <span className="rounded-full border border-sf-dark-600 bg-sf-dark-900 px-2 py-1 text-[10px] text-sf-text-muted">
                  {inpaintEnabled ? t('canvas.on') : t('canvas.off')}
                </span>
              </label>

              {inpaintEnabled && (
                <div className="mt-4 space-y-3 border-t border-emerald-500/20 pt-4">
                  <InspectorRow label={t('canvas.recipe.maskPrompt')}>
                    <textarea
                      rows={3}
                      value={promptNode?.data?.promptText || ''}
                      onChange={(event) => onUpdateNode(promptNode.id, { promptText: event.target.value })}
                      className="w-full resize-y rounded-xl border border-sf-dark-700 bg-sf-dark-900 px-3 py-2.5 text-sm text-sf-text-primary outline-none focus:border-emerald-400/60"
                    />
                  </InspectorRow>
                  <div className="grid gap-3 xl:grid-cols-2">
                    <RecipeAssetField
                      label={t('canvas.recipe.maskImage')}
                      hint={t('canvas.recipe.maskImageHelp')}
                      node={maskNode}
                      options={maskOptions}
                      required
                      assetById={assetById}
                      onChoose={onChooseAsset}
                      onPick={onPickAsset}
                      onClear={onClearAsset}
                      active={activeAssetTargetNodeId === maskNode.id}
                      onActivate={() => onSetAssetTarget(maskNode.id)}
                    />
                    <RecipeAssetField
                      label={t('canvas.recipe.visualReference')}
                      hint={t('canvas.recipe.visualReferenceHelp')}
                      node={referenceNode}
                      options={styleOptions}
                      assetById={assetById}
                      onChoose={onChooseAsset}
                      onPick={onPickAsset}
                      onClear={onClearAsset}
                      active={activeAssetTargetNodeId === referenceNode.id}
                      onActivate={() => onSetAssetTarget(referenceNode.id)}
                    />
                  </div>
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-sf-text-muted">{t('canvas.recipe.step2')}</div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  [t('canvas.recipe.prepareSource'), inpaintEnabled ? t('canvas.recipe.validateEditInputs') : t('canvas.recipe.useOriginalImage')],
                  [t('canvas.recipe.generateViews'), t('canvas.recipe.generateViewsHelp')],
                  [t('canvas.recipe.saveResults'), `${formatAssetOutputDestinationSummary(outputNode?.data?.folderName)} ${t('canvas.recipe.saveResultsHelp')}`],
                ].map(([title, description], index) => (
                  <div key={title} className="rounded-2xl border border-sf-dark-700 bg-sf-dark-950/55 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-sf-text-primary">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/30 bg-sky-400/10 text-[10px] text-sky-200">{index + 1}</span>
                      {title}
                    </div>
                    <div className="mt-2 text-[11px] leading-5 text-sf-text-muted">{description}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onRun}
                  disabled={isRunning || isExportingDataset || blockingDependencies.length > 0 || !datasetPath || !sourceNode?.data?.assetId || (inpaintEnabled && !maskNode?.data?.assetId)}
                  className="inline-flex items-center gap-2 rounded-xl bg-sf-accent px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {resultAssets.length > 0 ? t('canvas.recipe.generateAgain') : t('canvas.recipe.generateTrainingImages')}
                </button>
                <button
                  type="button"
                  onClick={onStop}
                  disabled={!isRunning || isStopping}
                  className="inline-flex items-center gap-2 rounded-xl border border-red-500/35 bg-red-500/10 px-4 py-3 text-sm text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isStopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                  {t('canvas.actions.stop')}
                </button>
                {blockingDependencies.length > 0 && (
                  <button
                    type="button"
                    onClick={onOpenSetup}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
                  >
                    <AlertTriangle className="h-4 w-4" />
                    {t('canvas.recipe.fixSetup')}
                  </button>
                )}
              </div>
              {!sourceNode?.data?.assetId && (
                <div className="mt-3 text-xs text-sf-text-muted">{t('canvas.recipe.chooseCharacterFirst')}</div>
              )}
              {!datasetPath && (
                <div className="mt-2 text-xs text-amber-200">{t('canvas.recipe.chooseDesignSetFirst')}</div>
              )}
              {inpaintEnabled && !maskNode?.data?.assetId && (
                <div className="mt-2 text-xs text-amber-200">{t('canvas.recipe.maskRequired')}</div>
              )}
              {blockingDependencies.length > 0 && (
                <div className="mt-2 text-xs text-amber-200">{t('canvas.recipe.completeSetup')}</div>
              )}
              {errorNode && (
                <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                  <div className="font-semibold">{t('canvas.recipe.stepFailed', { step: errorNode?.data?.label || t('canvas.recipe.recipeStep') })}</div>
                  <div className="mt-1 break-words text-red-100/80">{errorNode?.data?.error || errorNode?.data?.statusMessage}</div>
                </div>
              )}
            </section>

            <section className="border-t border-sf-dark-700 pt-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sf-text-muted">{t('canvas.recipe.step3')}</div>
                  <div className="mt-1 text-sm text-sf-text-secondary">{formatAssetOutputDestinationSummary(outputNode?.data?.folderName)}</div>
                </div>
                {resultAssets.length > 0 && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="inline-flex items-center gap-2 rounded-xl border border-sf-accent/45 bg-sf-accent/10 px-4 py-2.5 text-sm font-medium text-sf-text-primary hover:bg-sf-accent/20"
                  >
                    <Sparkles className="h-4 w-4 text-sf-accent" />
                    {t('canvas.createLora')}
                  </button>
                )}
              </div>
              <div className="mb-4 rounded-2xl border border-sky-400/25 bg-sky-400/8 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-sf-text-primary">{t('canvas.recipe.factoryHandoff')}</div>
                    <div className="mt-1 max-w-2xl text-[11px] leading-5 text-sf-text-muted">
                      {t('canvas.recipe.factoryHandoffHelp', { factory: details?.title || 'LoRA Factory' })}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onChooseExistingDataset}
                      className="inline-flex items-center gap-2 rounded-xl border border-sf-dark-600 bg-sf-dark-900 px-3 py-2.5 text-xs text-sf-text-primary hover:bg-sf-dark-800"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      {t('canvas.recipe.chooseExistingDataset')}
                    </button>
                    <button
                      type="button"
                      onClick={onLaunchFactory}
                      disabled={!datasetReady || isLaunchingFactory}
                      className="inline-flex items-center gap-2 rounded-xl bg-sf-accent px-3 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isLaunchingFactory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                      {t('canvas.recipe.launchFactory')}
                    </button>
                  </div>
                </div>
                {datasetReady ? (
                  <div className="mt-3 break-all rounded-lg border border-emerald-400/25 bg-emerald-400/8 px-3 py-2 text-[11px] text-emerald-100">
                    {t('canvas.recipe.datasetReady')}: {datasetPath}
                  </div>
                ) : datasetPath ? (
                  <div className="mt-3 break-all rounded-lg border border-sky-400/25 bg-sky-400/8 px-3 py-2 text-[11px] text-sky-100">
                    {t('canvas.recipe.outputSelected')}: {datasetPath}
                  </div>
                ) : (
                  <div className="mt-3 text-[10px] text-sky-100/65">{t('canvas.recipe.selectExistingHelp')}</div>
                )}
                {factoryPreparation && (
                  <div className="mt-3 rounded-lg border border-sky-300/25 bg-sf-dark-900/60 p-2.5">
                    {Number.isFinite(factoryPreparation.percent) && (
                      <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-sf-dark-700">
                        <div
                          className="h-full bg-sf-accent transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, factoryPreparation.percent))}%` }}
                        />
                      </div>
                    )}
                    <div className="text-[11px] text-sky-100/80">{factoryPreparation.message}</div>
                  </div>
                )}
                {factoryLaunchError && (
                  <div className="mt-3 rounded-lg border border-red-400/35 bg-red-500/10 p-3 text-[11px] text-red-100">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="break-words">{factoryLaunchError.message}</div>
                        {factoryLaunchError.settingsSection && (
                          <button
                            type="button"
                            onClick={onOpenFactorySettings}
                            className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300/35 bg-sf-dark-900 px-3 py-2 font-medium text-red-100 hover:bg-sf-dark-800"
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                            {factoryLaunchError.settingsSection === 'workflow-setup'
                              ? t('canvas.actions.openWorkflowSetup')
                              : t('canvas.actions.openFactorySettings')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {resultAssets.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {resultAssets.slice(0, 8).map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onPreviewAsset(asset)}
                      className="group overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-950 text-left hover:border-sky-400/50"
                    >
                      <div className="aspect-square overflow-hidden bg-sf-dark-900">
                        {asset.url ? <img src={asset.url} alt="" className="h-full w-full object-contain transition-transform group-hover:scale-[1.02]" /> : null}
                      </div>
                      <div className="truncate px-2.5 py-2 text-[10px] text-sf-text-secondary">{asset.name || asset.id}</div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-sf-dark-600 bg-sf-dark-950/45 px-5 py-8 text-center">
                  <ImageIcon className="mx-auto h-6 w-6 text-sf-text-muted" />
                  <div className="mt-3 text-sm font-medium text-sf-text-secondary">{t('canvas.recipe.resultsPlaceholder')}</div>
                  <div className="mt-1 text-xs text-sf-text-muted">{t('canvas.recipe.resultsSavedHelp')}</div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function renderWorkflowOptions(nodeType) {
  if (nodeType === FLOW_AI_NODE_TYPES.promptAssist) return getFlowTextWorkflowOptions()
  if (nodeType === FLOW_AI_NODE_TYPES.imageGen) return getFlowImageWorkflowOptions()
  if (nodeType === FLOW_AI_NODE_TYPES.videoGen) return getFlowVideoWorkflowOptions()
  if (nodeType === FLOW_AI_NODE_TYPES.videoUpscale) return getFlowVideoUpscaleWorkflowOptions()
  if (nodeType === FLOW_AI_NODE_TYPES.musicGen) return getFlowAudioWorkflowOptions()
  return []
}

export default function FlowAIWorkspace({ onOpenWorkflowSetup, onOpenSettings, onReloadWorkspace, templateRequest = null, recipeOnlyMode = false, onExitRecipe = null }) {
  const { t } = useI18n()
  const currentProject = useProjectStore((state) => state.currentProject)
  const currentProjectHandle = useProjectStore((state) => state.currentProjectHandle)
  const setFlowAiData = useProjectStore((state) => state.setFlowAiData)
  const saveProject = useProjectStore((state) => state.saveProject)
  const assets = useAssetsStore((state) => state.assets)
  const assetFolders = useAssetsStore((state) => state.folders)
  const currentPreviewAsset = useAssetsStore((state) => state.currentPreview)
  const addAsset = useAssetsStore((state) => state.addAsset)
  const removeAsset = useAssetsStore((state) => state.removeAsset)
  const generateAssetSprite = useAssetsStore((state) => state.generateAssetSprite)
  const setPreview = useAssetsStore((state) => state.setPreview)
  const assetById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets]
  )

  const projectKey = useMemo(() => {
    if (typeof currentProjectHandle === 'string' && currentProjectHandle) return currentProjectHandle
    return currentProject?.name || 'flow-ai-project'
  }, [currentProject?.name, currentProjectHandle])

  const initialFlowState = useMemo(
    () => normalizeFlowAiProjectData(currentProject?.flowAi),
    [currentProject?.flowAi]
  )

  const [flowProjectData, setFlowProjectState] = useState(initialFlowState)
  const [activeDocumentId, setActiveDocumentId] = useState(initialFlowState.activeDocumentId)
  const activeDocument = useMemo(() => {
    return flowProjectData.documents.find((document) => document.id === activeDocumentId) || flowProjectData.documents[0]
  }, [activeDocumentId, flowProjectData])

  const [nodes, setNodes] = useNodesState(activeDocument?.nodes || [])
  const [edges, setEdges] = useEdgesState(activeDocument?.edges || [])
  const [viewport, setViewport] = useState(activeDocument?.viewport || { x: 0, y: 0, zoom: 0.9 })
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank')
  const [isRunning, setIsRunning] = useState(false)
  const [isStopping, setIsStopping] = useState(false)
  const [runNotice, setRunNotice] = useState('')
  const [completionNotice, setCompletionNotice] = useState(null)
  const [informationDocumentId, setInformationDocumentId] = useState(null)
  const [isExportingDataset, setIsExportingDataset] = useState(false)
  const [isLaunchingFactory, setIsLaunchingFactory] = useState(false)
  const [loraFactoryPreparation, setLoraFactoryPreparation] = useState(null)
  const [loraFactoryLaunchError, setLoraFactoryLaunchError] = useState(null)
  const [loraDatasetExportPath, setLoraDatasetExportPath] = useState('')
  const [loraDatasetStatus, setLoraDatasetStatus] = useState('none')
  const [nodeContextMenu, setNodeContextMenu] = useState(null)
  const [dependencyByWorkflow, setDependencyByWorkflow] = useState({})
  const [activeConnection, setActiveConnection] = useState(null)
  const [canvasBounds, setCanvasBounds] = useState({ width: 0, height: 0 })
  const [workspaceWidth, setWorkspaceWidth] = useState(0)
  const [isPageVisible, setIsPageVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden'
  )
  const [previewStep, setPreviewStep] = useState(0)
  const [inspectorWidth, setInspectorWidth] = useState(() => readStoredFlowInspectorWidth())
  const [isInspectorResizing, setIsInspectorResizing] = useState(false)
  const [isAssetBrowserOpen, setIsAssetBrowserOpen] = useState(true)
  const [isProcessConsoleOpen, setIsProcessConsoleOpen] = useState(true)
  const [processConsoleEntries, setProcessConsoleEntries] = useState([])
  const [isFactoryProcessRunning, setIsFactoryProcessRunning] = useState(false)
  const [assetBrowserFolderId, setAssetBrowserFolderId] = useState(null)
  const [assetBrowserSearch, setAssetBrowserSearch] = useState('')
  const [isRefreshingAssetBrowser, setIsRefreshingAssetBrowser] = useState(false)
  const [originalImageAsset, setOriginalImageAsset] = useState(null)
  const [recipeAssetTargetNodeId, setRecipeAssetTargetNodeId] = useState('')
  const hydratedProjectKeyRef = useRef(null)
  const lastPersistedSnapshotRef = useRef('')
  const workspaceLayoutRef = useRef(null)
  const canvasViewportRef = useRef(null)
  const nodeContextMenuRef = useRef(null)
  const requestedPreviewSpriteIdsRef = useRef(new Set())
  const flowHistoryByDocumentRef = useRef(new Map())
  const flowClipboardRef = useRef({ nodes: [], edges: [], pasteCount: 0 })
  const flowNodeDragHistoryPendingRef = useRef(false)
  const inspectorResizeStateRef = useRef(null)
  const processConsoleEndRef = useRef(null)
  const processConsoleSequenceRef = useRef(0)
  const lastNodeConsoleStatusRef = useRef(new Map())
  const effectiveInspectorWidth = useMemo(
    () => clampFlowInspectorWidth(inspectorWidth, workspaceWidth),
    [inspectorWidth, workspaceWidth]
  )
  const assetFolderById = useMemo(
    () => new Map((assetFolders || []).map((folder) => [folder.id, folder])),
    [assetFolders]
  )
  const assetBrowserBreadcrumbs = useMemo(() => {
    const result = []
    const visited = new Set()
    let folderId = assetBrowserFolderId
    while (folderId && !visited.has(folderId)) {
      visited.add(folderId)
      const folder = assetFolderById.get(folderId)
      if (!folder) break
      result.unshift(folder)
      folderId = folder.parentId || null
    }
    return result
  }, [assetBrowserFolderId, assetFolderById])
  const assetBrowserFolders = useMemo(() => {
    if (assetBrowserSearch.trim()) return []
    return (assetFolders || [])
      .filter((folder) => (folder.parentId || null) === assetBrowserFolderId)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }, [assetBrowserFolderId, assetBrowserSearch, assetFolders])
  const assetBrowserAssets = useMemo(() => {
    const query = assetBrowserSearch.trim().toLowerCase()
    return assets
      .filter((asset) => {
        if (query) {
          return String(asset.name || asset.path || asset.id || '').toLowerCase().includes(query)
        }
        return (asset.folderId || null) === assetBrowserFolderId
      })
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
  }, [assetBrowserFolderId, assetBrowserSearch, assets])
  const informationDocument = useMemo(
    () => flowProjectData.documents.find((document) => document.id === informationDocumentId) || null,
    [flowProjectData.documents, informationDocumentId]
  )
  const informationDetails = informationDocument
    ? FLOW_AI_TEMPLATE_INFO[informationDocument.templateId] || null
    : null
  const activeDocumentDetails = activeDocument
    ? FLOW_AI_TEMPLATE_INFO[activeDocument.templateId] || null
    : null
  const activeDocumentCreatesLoraDataset = Boolean(activeDocumentDetails?.datasetExport)
  const activeDocumentIsRecipe = activeDocumentDetails?.presentation === 'recipe'

  useEffect(() => {
    setLoraDatasetExportPath('')
    setLoraDatasetStatus('none')
  }, [activeDocumentId])

  const appendProcessConsole = useCallback((entry = {}) => {
    const rawText = String(entry.message ?? entry.text ?? '')
      .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
      .replace(/\u0000/g, '')
    const lines = rawText.split(/\r\n|\n|\r/).map((line) => line.trimEnd()).filter(Boolean)
    if (lines.length === 0) return
    const timestamp = entry.timestamp ? new Date(entry.timestamp) : new Date()
    const source = String(entry.source || 'CANVAS').toUpperCase()
    const level = ['error', 'warning', 'success'].includes(entry.level) ? entry.level : 'info'
    setProcessConsoleEntries((current) => {
      const additions = lines.map((message) => ({
        id: `${timestamp.getTime()}-${processConsoleSequenceRef.current += 1}`,
        timestamp: timestamp.toISOString(),
        source,
        level,
        message,
      }))
      return [...current, ...additions].slice(-600)
    })
  }, [])

  useEffect(() => {
    const electron = window?.electronAPI
    if (!electron?.onLoraFactoryProcessEvent) return undefined
    return electron.onLoraFactoryProcessEvent((entry = {}) => {
      const kind = String(entry.kind || 'output')
      if (kind === 'started') {
        setIsFactoryProcessRunning(true)
        setIsProcessConsoleOpen(true)
      } else if (kind === 'exit' || kind === 'error') {
        setIsFactoryProcessRunning(false)
      }
      appendProcessConsole({
        timestamp: entry.timestamp,
        source: entry.factoryType === 'sdxl' ? 'SDXL Factory' : 'Anima Factory',
        level: kind === 'error' || entry.stream === 'stderr'
          ? 'error'
          : kind === 'exit' && entry.exitCode !== 0
            ? 'warning'
            : kind === 'exit'
              ? 'success'
              : 'info',
        text: entry.text,
      })
    })
  }, [appendProcessConsole])

  useEffect(() => {
    if (!isProcessConsoleOpen) return
    processConsoleEndRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [isProcessConsoleOpen, processConsoleEntries])

  useEffect(() => {
    if (hydratedProjectKeyRef.current === projectKey) return
    hydratedProjectKeyRef.current = projectKey
    requestedPreviewSpriteIdsRef.current.clear()
    flowHistoryByDocumentRef.current.clear()
    flowClipboardRef.current = { nodes: [], edges: [], pasteCount: 0 }
    flowNodeDragHistoryPendingRef.current = false
    const normalized = normalizeFlowAiProjectData(currentProject?.flowAi)
    setFlowProjectState(normalized)
    setActiveDocumentId(normalized.activeDocumentId)
    const nextDocument = normalized.documents.find((document) => document.id === normalized.activeDocumentId) || normalized.documents[0]
    setNodes(nextDocument?.nodes || [])
    setEdges(nextDocument?.edges || [])
    setViewport(nextDocument?.viewport || { x: 0, y: 0, zoom: 0.9 })
    setSelectedNodeId(null)
    setNodeContextMenu(null)
    setOriginalImageAsset(null)
    setRunNotice('')
  }, [currentProject?.flowAi, projectKey, setEdges, setNodes])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState !== 'hidden')
    }
    handleVisibilityChange()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  useEffect(() => {
    const element = canvasViewportRef.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const updateBounds = () => {
      setCanvasBounds({
        width: element.clientWidth || 0,
        height: element.clientHeight || 0,
      })
    }
    updateBounds()
    const observer = new ResizeObserver(updateBounds)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const element = workspaceLayoutRef.current
    if (!element || typeof ResizeObserver === 'undefined') return undefined
    const updateBounds = () => {
      setWorkspaceWidth(element.clientWidth || 0)
    }
    updateBounds()
    const observer = new ResizeObserver(updateBounds)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setInspectorWidth((current) => clampFlowInspectorWidth(current, workspaceWidth))
  }, [workspaceWidth])

  useEffect(() => {
    if (assetBrowserFolderId && !assetFolderById.has(assetBrowserFolderId)) {
      setAssetBrowserFolderId(null)
    }
  }, [assetBrowserFolderId, assetFolderById])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
    try {
      window.localStorage.setItem(FLOW_AI_INSPECTOR_WIDTH_STORAGE_KEY, String(effectiveInspectorWidth))
    } catch (_) {
      // ignore
    }
  }, [effectiveInspectorWidth])

  useEffect(() => {
    if (!isInspectorResizing) return undefined
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handlePointerMove = (event) => {
      const resizeState = inspectorResizeStateRef.current
      if (!resizeState) return
      setInspectorWidth(clampFlowInspectorWidth(resizeState.layoutRight - event.clientX, resizeState.layoutWidth))
    }

    const stopResize = () => {
      inspectorResizeStateRef.current = null
      setIsInspectorResizing(false)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', stopResize)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', stopResize)
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
    }
  }, [isInspectorResizing])

  useEffect(() => {
    if (!activeDocument) return
    setNodes(activeDocument.nodes || [])
    setEdges(activeDocument.edges || [])
    setViewport(activeDocument.viewport || { x: 0, y: 0, zoom: 0.9 })
    setSelectedNodeId(null)
    setNodeContextMenu(null)
    flowNodeDragHistoryPendingRef.current = false
  }, [activeDocument?.id, setEdges, setNodes])

  const readFlowHistoryState = useCallback((documentId = activeDocumentId) => {
    if (!documentId) return { past: [], future: [] }
    return flowHistoryByDocumentRef.current.get(documentId) || { past: [], future: [] }
  }, [activeDocumentId])

  const writeFlowHistoryState = useCallback((documentId, nextHistory) => {
    if (!documentId) return
    flowHistoryByDocumentRef.current.set(documentId, {
      past: Array.isArray(nextHistory?.past) ? nextHistory.past : [],
      future: Array.isArray(nextHistory?.future) ? nextHistory.future : [],
    })
  }, [])

  const recordFlowHistorySnapshot = useCallback((snapshot = null) => {
    if (!activeDocumentId) return false
    const nextSnapshot = snapshot || buildFlowGraphHistorySnapshot(nodes, edges)
    const historyState = readFlowHistoryState(activeDocumentId)
    const lastSnapshot = historyState.past[historyState.past.length - 1]
    if (lastSnapshot?.signature === nextSnapshot.signature) return false
    writeFlowHistoryState(activeDocumentId, {
      past: [...historyState.past, nextSnapshot].slice(-FLOW_GRAPH_HISTORY_LIMIT),
      future: [],
    })
    return true
  }, [activeDocumentId, edges, nodes, readFlowHistoryState, writeFlowHistoryState])

  const restoreFlowHistorySnapshot = useCallback((snapshot) => {
    if (!snapshot) return false
    setNodes((snapshot.nodes || []).map((node) => ({
      ...node,
      selected: false,
    })))
    setEdges((snapshot.edges || []).map((edge) => ({
      ...edge,
      selected: false,
    })))
    setSelectedNodeId(null)
    return true
  }, [setEdges, setNodes])

  const undoFlowGraph = useCallback(() => {
    if (!activeDocumentId) return false
    const historyState = readFlowHistoryState(activeDocumentId)
    if (historyState.past.length === 0) return false
    const previousSnapshot = historyState.past[historyState.past.length - 1]
    const currentSnapshot = buildFlowGraphHistorySnapshot(nodes, edges)
    writeFlowHistoryState(activeDocumentId, {
      past: historyState.past.slice(0, -1),
      future: [currentSnapshot, ...historyState.future].slice(0, FLOW_GRAPH_HISTORY_LIMIT),
    })
    return restoreFlowHistorySnapshot(previousSnapshot)
  }, [activeDocumentId, edges, nodes, readFlowHistoryState, restoreFlowHistorySnapshot, writeFlowHistoryState])

  const redoFlowGraph = useCallback(() => {
    if (!activeDocumentId) return false
    const historyState = readFlowHistoryState(activeDocumentId)
    if (historyState.future.length === 0) return false
    const nextSnapshot = historyState.future[0]
    const currentSnapshot = buildFlowGraphHistorySnapshot(nodes, edges)
    writeFlowHistoryState(activeDocumentId, {
      past: [...historyState.past, currentSnapshot].slice(-FLOW_GRAPH_HISTORY_LIMIT),
      future: historyState.future.slice(1),
    })
    return restoreFlowHistorySnapshot(nextSnapshot)
  }, [activeDocumentId, edges, nodes, readFlowHistoryState, restoreFlowHistorySnapshot, writeFlowHistoryState])

  const updateActiveDocument = useCallback((updater) => {
    setFlowProjectState((prev) => {
      const nextDocuments = prev.documents.map((document) => {
        if (document.id !== activeDocumentId) return document
        const nextDocument = typeof updater === 'function' ? updater(document) : updater
        return {
          ...document,
          ...nextDocument,
          updatedAt: new Date().toISOString(),
        }
      })
      return {
        ...prev,
        activeDocumentId,
        documents: nextDocuments,
      }
    })
  }, [activeDocumentId])

  useEffect(() => {
    if (!activeDocument) return
    updateActiveDocument((document) => ({
      ...document,
      nodes,
      edges,
      viewport,
    }))
  }, [activeDocument, edges, nodes, updateActiveDocument, viewport])

  useEffect(() => {
    const payload = {
      ...flowProjectData,
      activeDocumentId,
    }
    const serialized = JSON.stringify(payload)
    if (serialized === lastPersistedSnapshotRef.current) return
    lastPersistedSnapshotRef.current = serialized
    const timer = window.setTimeout(() => {
      setFlowAiData(payload)
    }, 180)
    return () => window.clearTimeout(timer)
  }, [activeDocumentId, flowProjectData, setFlowAiData])

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  )
  const selectedNodeIds = useMemo(
    () => nodes.filter((node) => node.selected).map((node) => node.id),
    [nodes]
  )
  const selectedEdgeIds = useMemo(
    () => edges.filter((edge) => edge.selected).map((edge) => edge.id),
    [edges]
  )
  const nodeContextMenuAnchor = useMemo(
    () => (nodeContextMenu ? { x: nodeContextMenu.x, y: nodeContextMenu.y } : null),
    [nodeContextMenu?.x, nodeContextMenu?.y]
  )
  const nodeContextMenuPosition = useViewportClampedPosition(
    nodeContextMenuAnchor,
    nodeContextMenuRef,
  )
  const nodeContextMenuTarget = useMemo(
    () => (nodeContextMenu ? nodes.find((node) => node.id === nodeContextMenu.nodeId) || null : null),
    [nodeContextMenu, nodes]
  )
  const nodeContextMenuRunnable = Boolean(nodeContextMenuTarget && isFlowNodeRunnable(nodeContextMenuTarget.type))
  useEffect(() => {
    if (!nodeContextMenu) return undefined

    const handleClick = (event) => {
      if (nodeContextMenuRef.current && nodeContextMenuRef.current.contains(event.target)) {
        return
      }
      setNodeContextMenu(null)
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') setNodeContextMenu(null)
    }

    window.addEventListener('click', handleClick, true)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('click', handleClick, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [nodeContextMenu])
  useEffect(() => {
    if (nodeContextMenu && !nodeContextMenuRunnable) {
      setNodeContextMenu(null)
    }
  }, [nodeContextMenu, nodeContextMenuRunnable])
  const handleSelectionChange = useCallback(({ nodes: nextSelectedNodes = [] }) => {
    if (nextSelectedNodes.length === 1) {
      setSelectedNodeId(nextSelectedNodes[0].id)
      return
    }
    if (nextSelectedNodes.length === 0) {
      setSelectedNodeId(null)
      return
    }
    setSelectedNodeId(null)
  }, [])
  const selectFlowNode = useCallback((nodeId) => {
    if (!nodeId) {
      setSelectedNodeId(null)
      return
    }
    setNodes((prev) => {
      let changed = false
      const nextNodes = prev.map((node) => {
        const shouldSelect = node.id === nodeId
        if (Boolean(node.selected) === shouldSelect) return node
        changed = true
        return {
          ...node,
          selected: shouldSelect,
        }
      })
      return changed ? nextNodes : prev
    })
    setEdges((prev) => {
      let changed = false
      const nextEdges = prev.map((edge) => {
        if (!edge.selected) return edge
        changed = true
        return {
          ...edge,
          selected: false,
        }
      })
      return changed ? nextEdges : prev
    })
    setSelectedNodeId(nodeId)
  }, [setEdges, setNodes])
  const handleNodeContextMenu = useCallback((event, node) => {
    event.preventDefault()
    event.stopPropagation()
    if (!node || !isFlowNodeRunnable(node.type)) {
      setNodeContextMenu(null)
      return
    }
    selectFlowNode(node.id)
    setNodeContextMenu({
      x: event.clientX,
      y: event.clientY,
      nodeId: node.id,
    })
  }, [selectFlowNode])
  const handleNodesChange = useCallback((changes) => {
    if (!Array.isArray(changes) || changes.length === 0) return
    if (hasMeaningfulFlowNodeChanges(changes)) {
      recordFlowHistorySnapshot()
    }
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes))
  }, [recordFlowHistorySnapshot, setNodes])
  const handleFlowNodeResizeStart = useCallback(() => {
    recordFlowHistorySnapshot()
  }, [recordFlowHistorySnapshot])
  const handleEdgesChange = useCallback((changes) => {
    if (!Array.isArray(changes) || changes.length === 0) return
    if (hasMeaningfulFlowEdgeChanges(changes)) {
      recordFlowHistorySnapshot()
    }
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges))
  }, [recordFlowHistorySnapshot, setEdges])
  const handleNodeDragStart = useCallback(() => {
    if (flowNodeDragHistoryPendingRef.current) return
    flowNodeDragHistoryPendingRef.current = true
    recordFlowHistorySnapshot()
  }, [recordFlowHistorySnapshot])
  const handleNodeDragStop = useCallback(() => {
    flowNodeDragHistoryPendingRef.current = false
  }, [])
  const handleDisconnectEdge = useCallback((edgeId) => {
    if (!edgeId) return
    recordFlowHistorySnapshot()
    setEdges((prev) => prev.filter((edge) => edge.id !== edgeId))
  }, [recordFlowHistorySnapshot, setEdges])
  const activeConnectionType = useMemo(
    () => activeConnection?.visualType || parsePortType(activeConnection?.handleId || ''),
    [activeConnection]
  )
  const connectionLineStyle = useMemo(() => {
    const portVisual = getFlowPortVisual(activeConnectionType)
    return {
      stroke: portVisual.color,
      strokeWidth: 2.4,
      filter: `drop-shadow(0 0 6px ${portVisual.shadow})`,
    }
  }, [activeConnectionType])
  const flowTextDocument = useMemo(() => ({
    nodes,
    edges,
  }), [edges, nodes])
  const displayNodes = useMemo(() => {
    return nodes.map((node) => {
      const previewPayload = buildFlowNodePreviewPayload(node, assetById)
      const previewAnimated = isPageVisible && isFlowNodePreviewVisible(node, viewport, canvasBounds)
      const hasAnimatedVideoPreview = (previewPayload.items || []).some((item) => item.kind === 'video' && item?.sprite?.url)
      const resolvedText = node.type === FLOW_AI_NODE_TYPES.textViewer
        ? resolveFlowNodeText(flowTextDocument, node)
        : ''
      return {
        ...node,
        data: {
          ...(node.data || {}),
          _activeConnectionHandleId: activeConnection?.handleId || '',
          _activeConnectionHandleType: activeConnection?.handleType || '',
          _previewItems: previewPayload.items,
          _previewPlaceholder: previewPayload.placeholder,
          _previewAnimated: previewAnimated,
          _previewStep: previewAnimated && hasAnimatedVideoPreview ? previewStep : 0,
          _resolvedText: resolvedText,
        },
      }
    })
  }, [activeConnection, assetById, canvasBounds, flowTextDocument, isPageVisible, nodes, previewStep, viewport])
  const previewVideoAssetIds = useMemo(() => {
    const nextIds = new Set()
    for (const node of displayNodes) {
      if (!node?.data?._previewAnimated) continue
      for (const item of node?.data?._previewItems || []) {
        if (item?.kind === 'video' && item?.assetId) {
          nextIds.add(item.assetId)
        }
      }
    }
    return Array.from(nextIds)
  }, [displayNodes])
  const previewVideoAssetIdsKey = useMemo(
    () => previewVideoAssetIds.join('|'),
    [previewVideoAssetIds]
  )
  const animatedPreviewVideoCount = useMemo(() => {
    const previewIds = previewVideoAssetIdsKey ? previewVideoAssetIdsKey.split('|') : []
    return previewIds.reduce((count, assetId) => (
      assetById.get(assetId)?.sprite?.url ? count + 1 : count
    ), 0)
  }, [assetById, previewVideoAssetIdsKey])
  useEffect(() => {
    if (!isPageVisible || animatedPreviewVideoCount === 0) return undefined
    const timer = window.setInterval(() => {
      setPreviewStep((step) => (step + 1) % 100000)
    }, FLOW_NODE_PREVIEW_VIDEO_STEP_MS)
    return () => window.clearInterval(timer)
  }, [animatedPreviewVideoCount, isPageVisible])
  useEffect(() => {
    const projectPath = typeof currentProjectHandle === 'string' ? currentProjectHandle : null
    const previewIds = previewVideoAssetIdsKey ? previewVideoAssetIdsKey.split('|') : []
    const candidates = previewIds.filter((assetId) => {
      const asset = assetById.get(assetId)
      return Boolean(
        asset
        && asset.type === 'video'
        && asset.url
        && !asset.sprite?.url
        && !asset.spriteGenerating
        && !requestedPreviewSpriteIdsRef.current.has(assetId)
      )
    })
    if (candidates.length === 0) return undefined

    let cancelled = false
    ;(async () => {
      for (const assetId of candidates) {
        if (cancelled) return
        requestedPreviewSpriteIdsRef.current.add(assetId)
        try {
          await generateAssetSprite(assetId, projectPath)
        } catch (error) {
          console.warn('Failed to generate CANVAS preview sprite:', error)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assetById, currentProjectHandle, generateAssetSprite, previewVideoAssetIdsKey])
  const activeTargetNodeIds = useMemo(() => {
    return new Set(
      nodes
        .filter((node) => FLOW_BUSY_STATUSES.has(String(node?.data?.status || '')))
        .map((node) => node.id)
    )
  }, [nodes])
  const displayEdges = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      type: 'flow-canvas',
      data: {
        ...(edge.data || {}),
        isActive: activeTargetNodeIds.has(edge.target),
        onDisconnect: handleDisconnectEdge,
        portType: parsePortType(edge.targetHandle || edge.sourceHandle),
      },
    }))
  }, [activeTargetNodeIds, edges, handleDisconnectEdge])

  const selectableAssets = useMemo(() => {
    return assets.map((asset) => ({
      id: asset.id,
      label: asset.name || asset.path || asset.id,
      type: asset.type,
      asset,
    }))
  }, [assets])

  const imageInputAssets = useMemo(
    () => selectableAssets.filter((entry) => entry.type === 'image' || entry.type === 'video'),
    [selectableAssets]
  )
  const styleAssets = useMemo(
    () => selectableAssets.filter((entry) => entry.type === 'image'),
    [selectableAssets]
  )
  const recipeAssetInputNodes = useMemo(() => {
    if (!activeDocumentIsRecipe) return []
    const candidates = nodes.filter((node) => (
      node?.data?.datasetRole === 'source'
      || node?.data?.assetRole === 'mask'
      || (node.type === FLOW_AI_NODE_TYPES.styleReference && node?.data?.excludeFromDatasetExport)
    ))
    return candidates.sort((left, right) => {
      if (left?.data?.datasetRole === 'source') return -1
      if (right?.data?.datasetRole === 'source') return 1
      if (left?.data?.assetRole === 'mask') return -1
      if (right?.data?.assetRole === 'mask') return 1
      return 0
    })
  }, [activeDocumentIsRecipe, nodes])
  const assetBrowserTargetNode = activeDocumentIsRecipe
    ? recipeAssetInputNodes.find((node) => node.id === recipeAssetTargetNodeId) || recipeAssetInputNodes[0] || null
    : selectedNode

  useEffect(() => {
    if (!activeDocumentIsRecipe) {
      if (recipeAssetTargetNodeId) setRecipeAssetTargetNodeId('')
      return
    }
    if (recipeAssetInputNodes.some((node) => node.id === recipeAssetTargetNodeId)) return
    setRecipeAssetTargetNodeId(recipeAssetInputNodes[0]?.id || '')
  }, [activeDocumentIsRecipe, recipeAssetInputNodes, recipeAssetTargetNodeId])
  const maskAssets = useMemo(
    () => selectableAssets.filter((entry) => entry.type === 'image' || entry.type === 'mask'),
    [selectableAssets]
  )

  const executableWorkflowIds = useMemo(() => {
    return Array.from(new Set(
      nodes
        .filter((node) => getFlowNodeSupportsExecution(node.type))
        .filter((node) => !(node?.data?.optionalStage === 'inpaint' && node?.data?.enabled !== true))
        .map((node) => String(node?.data?.workflowId || '').trim())
        .filter(Boolean)
    ))
  }, [nodes])

  useEffect(() => {
    if (executableWorkflowIds.length === 0) {
      setDependencyByWorkflow({})
      return
    }

    let cancelled = false
    checkWorkflowDependenciesBatch(executableWorkflowIds)
      .then((results) => {
        if (cancelled) return
        const nextMap = {}
        for (const result of results || []) {
          nextMap[result.workflowId] = result
        }
        setDependencyByWorkflow(nextMap)
      })
      .catch(() => {
        if (cancelled) return
        setDependencyByWorkflow({})
      })
    return () => {
      cancelled = true
    }
  }, [executableWorkflowIds])

  useEffect(() => {
    if (nodes.length === 0) return
    setNodes((prev) => {
      let changed = false
      const nextNodes = prev.map((node) => {
        if (!getFlowNodeSupportsExecution(node.type)) return node
        const dependency = dependencyByWorkflow[String(node?.data?.workflowId || '').trim()]
        const dependencyStatus = dependency?.status || 'unknown'
        const dependencySummary = dependency?.hasBlockingIssues
          ? (
            dependency?.missingAuth
              ? t('canvas.status.missingApiKey')
              : t('canvas.status.dependenciesMissing', { nodes: dependency?.missingNodes?.length || 0, models: dependency?.missingModels?.length || 0 })
          )
          : dependencyStatus === 'ready'
            ? t('canvas.status.allSet')
            : dependency?.error || ''
        const workflowLabel = formatRuntimeLabel(node?.data?.workflowId)
        if (
          node?.data?.dependencyStatus === dependencyStatus
          && node?.data?.dependencySummary === dependencySummary
          && node?.data?.workflowLabel === workflowLabel
        ) {
          return node
        }
        changed = true
        return {
          ...node,
          data: {
            ...node.data,
            dependencyStatus,
            dependencySummary,
            workflowLabel,
          },
        }
      })
      return changed ? nextNodes : prev
    })
  }, [dependencyByWorkflow, nodes.length, setNodes])

  useEffect(() => {
    if (nodes.length === 0) return
    setNodes((prev) => {
      let changed = false
      const nextNodes = prev.map((node) => {
        if (node.type !== FLOW_AI_NODE_TYPES.output) return node
        const nextPatch = {}
        const currentLabel = String(node?.data?.label || '').trim()
        const currentStatusMessage = String(node?.data?.statusMessage || '').trim()
        if (!currentLabel || currentLabel === 'Output') {
          nextPatch.label = 'Asset Output'
        }
        if (!currentStatusMessage || currentStatusMessage === 'Connect final image, video, or audio nodes here.') {
          nextPatch.statusMessage = 'Sends connected results to the Assets panel.'
        }
        if (typeof node?.data?.folderName !== 'string') {
          nextPatch.folderName = ''
        }
        if (Object.keys(nextPatch).length === 0) return node
        changed = true
        return {
          ...node,
          data: {
            ...node.data,
            ...nextPatch,
          },
        }
      })
      return changed ? nextNodes : prev
    })
  }, [nodes.length, setNodes])

  useEffect(() => {
    const outputAssetIdsByNode = computeOutputNodeAssetIds({
      nodes,
      edges,
    })
    if (Object.keys(outputAssetIdsByNode).length === 0) return
    setNodes((prev) => {
      let changed = false
      const nextNodes = prev.map((node) => {
        if (node.type !== FLOW_AI_NODE_TYPES.output) return node
        const nextIds = outputAssetIdsByNode[node.id] || []
        if (shallowStringArrayEqual(node?.data?.resolvedAssetIds || [], nextIds)) return node
        changed = true
        return {
          ...node,
          data: {
            ...node.data,
            resolvedAssetIds: nextIds,
          },
        }
      })
      return changed ? nextNodes : prev
    })
  }, [assets, edges, nodes, setNodes])

  useEffect(() => {
    if (assets.length === 0) return
    const assetNameById = new Map(assets.map((asset) => [asset.id, asset.name || asset.path || asset.id]))
    setNodes((prev) => {
      let changed = false
      const nextNodes = prev.map((node) => {
        if (node.type !== FLOW_AI_NODE_TYPES.imageInput && node.type !== FLOW_AI_NODE_TYPES.styleReference) {
          return node
        }
        const assetId = String(node?.data?.assetId || '').trim()
        const nextLabel = assetNameById.get(assetId) || ''
        if ((node?.data?.assetLabel || '') === nextLabel) return node
        changed = true
        return {
          ...node,
          data: {
            ...node.data,
            assetLabel: nextLabel,
          },
        }
      })
      return changed ? nextNodes : prev
    })
  }, [assets, setNodes])

  const updateNodeData = useCallback((nodeId, patch, options = {}) => {
    const shouldRecordHistory = options.recordHistory !== false
    const currentNode = nodes.find((node) => node.id === nodeId)
    if (!currentNode) return false
    const nextPatch = typeof patch === 'function' ? patch(currentNode.data) : patch
    if (!nextPatch || Object.keys(nextPatch).length === 0) return false
    const hasChange = Object.entries(nextPatch).some(([key, value]) => currentNode?.data?.[key] !== value)
    if (!hasChange) return false
    if (shouldRecordHistory) recordFlowHistorySnapshot()
    setNodes((prev) => prev.map((node) => {
      if (node.id !== nodeId) return node
      return {
        ...node,
        data: {
          ...node.data,
          ...(nextPatch || {}),
        },
      }
    }))
    return true
  }, [nodes, recordFlowHistorySnapshot, setNodes])

  const handlePickNodeImage = useCallback(async (nodeId) => {
    const electron = window?.electronAPI
    if (!nodeId || !currentProjectHandle) {
      setRunNotice(t('canvas.status.openProjectFirst'))
      return null
    }
    if (!electron?.selectFile) {
      setRunNotice(t('canvas.status.desktopImagePicker'))
      return null
    }

    const sourcePath = await electron.selectFile({
      title: t('canvas.assets.chooseSourceImage'),
      filters: [
        { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (!sourcePath) return null

    try {
      const assetInfo = await importAsset(currentProjectHandle, sourcePath, 'images')
      const url = assetInfo?.absolutePath
        ? await getAbsoluteFileUrl(assetInfo.absolutePath)
        : ''
      const newAsset = addAsset({
        ...assetInfo,
        url,
        settings: {
          duration: assetInfo.duration,
          fps: assetInfo.fps,
        },
      })
      updateNodeData(nodeId, {
        assetId: newAsset.id,
        assetLabel: newAsset.name || assetInfo.name || 'Source image',
        status: 'idle',
        statusMessage: 'Source image loaded. Run the next node to generate the camera angles.',
        error: '',
      })
      setPreview(newAsset)
      setRunNotice(t('canvas.status.imageLoaded', { name: newAsset.name || t('canvas.assets.sourceImage') }))
      return newAsset
    } catch (error) {
      console.error('Failed to load CANVAS source image:', error)
      setRunNotice(error?.message || t('canvas.status.imageLoadFailed'))
      return null
    }
  }, [addAsset, currentProjectHandle, setPreview, updateNodeData])

  const handleChooseNodeProjectAsset = useCallback((nodeId, assetId) => {
    const node = nodes.find((entry) => entry.id === nodeId)
    const asset = assetById.get(String(assetId || '').trim())
    if (!node || !asset) return false
    const acceptsAsset = doesFlowAssetInputAcceptAsset(node, asset)
    if (!acceptsAsset) return false

    updateNodeData(nodeId, {
      assetId: asset.id,
      assetLabel: asset.name || asset.path || asset.id,
      status: 'idle',
      statusMessage: 'Existing project asset connected. Run the next node when ready.',
      error: '',
    })
    setPreview(asset)
    setRunNotice(t('canvas.status.assetConnected', { name: asset.name || t('canvas.assets.projectAsset') }))
    return true
  }, [assetById, nodes, setPreview, updateNodeData])

  const handleClearNodeProjectAsset = useCallback((nodeId) => {
    const node = nodes.find((entry) => entry.id === nodeId)
    if (!node || (node.type !== FLOW_AI_NODE_TYPES.imageInput && node.type !== FLOW_AI_NODE_TYPES.styleReference)) {
      return false
    }
    const clearedAssetId = String(node?.data?.assetId || '').trim()
    if (!clearedAssetId) return false
    updateNodeData(nodeId, {
      assetId: '',
      assetLabel: '',
      status: 'idle',
      statusMessage: node?.data?.assetRole === 'mask'
        ? 'Choose a black-and-white mask. White areas will be replaced.'
        : node.type === FLOW_AI_NODE_TYPES.styleReference
          ? 'Optional reference cleared.'
          : 'Pick an asset from the project.',
      error: '',
    })
    if (currentPreviewAsset?.id === clearedAssetId) setPreview(null)
    setRunNotice(`Cleared the image assigned to ${node?.data?.label || 'the CANVAS input node'}.`)
    return true
  }, [currentPreviewAsset?.id, nodes, setPreview, updateNodeData])

  const handleRevealAssetInFileManager = useCallback(async (event, asset) => {
    event.preventDefault()
    event.stopPropagation()
    if (!canRevealAssetInFileManager(asset)) {
      setRunNotice(t('canvas.status.noLocalFile'))
      return
    }
    const result = await revealAssetInFileManager(asset)
    if (result?.success === false) {
      setRunNotice(result.error || t('canvas.status.revealFailed'))
    }
  }, [])

  const handleRefreshAssetBrowser = useCallback(async (event) => {
    event?.preventDefault?.()
    event?.stopPropagation?.()
    if (isRefreshingAssetBrowser) return
    const electron = window?.electronAPI
    if (!electron?.exists) {
      setRunNotice(t('canvas.status.desktopAssetCheck'))
      return
    }

    setIsRefreshingAssetBrowser(true)
    try {
      const missingAssetIds = []
      const concurrency = Math.max(1, Math.min(8, assets.length))
      let cursor = 0
      const worker = async () => {
        while (cursor < assets.length) {
          const asset = assets[cursor]
          cursor += 1
          const candidates = []
          const recordedAbsolutePath = getRecordedAbsolutePath(asset)
          if (recordedAbsolutePath) candidates.push(recordedAbsolutePath)

          const recordedPath = String(asset?.path || '').trim()
          const isLocalRelativePath = recordedPath
            && !isAbsoluteRecordedPath(recordedPath)
            && !/^(?:https?|blob|data|file):/i.test(recordedPath)
          if (isLocalRelativePath && typeof currentProjectHandle === 'string' && currentProjectHandle) {
            candidates.push(await electron.pathJoin(currentProjectHandle, recordedPath))
          }

          const uniqueCandidates = [...new Set(candidates.filter(Boolean))]
          if (uniqueCandidates.length === 0) continue
          const existsResults = await Promise.all(uniqueCandidates.map(async (candidate) => {
            try {
              return await electron.exists(candidate)
            } catch (_) {
              // Keep an asset when the filesystem probe itself fails. A refresh
              // should never remove a valid record because of a transient IPC error.
              return true
            }
          }))
          if (!existsResults.some(Boolean)) missingAssetIds.push(asset.id)
        }
      }
      await Promise.all(Array.from({ length: concurrency }, () => worker()))

      if (missingAssetIds.length === 0) {
        setRunNotice(t('canvas.status.assetsUpToDate'))
        return
      }

      const missingIdSet = new Set(missingAssetIds)
      missingAssetIds.forEach((assetId) => removeAsset(assetId))
      setNodes((currentNodes) => currentNodes.map((node) => {
        const nextData = { ...(node.data || {}) }
        let changed = false
        if (nextData.assetId && missingIdSet.has(nextData.assetId)) {
          nextData.assetId = ''
          nextData.assetLabel = ''
          nextData.status = 'idle'
          nextData.error = ''
          nextData.statusMessage = 'The assigned local file was removed outside Lumeweft. Choose another asset.'
          changed = true
        }
        for (const field of ['outputAssetIds', 'resolvedAssetIds']) {
          if (!Array.isArray(nextData[field])) continue
          const filtered = nextData[field].filter((assetId) => !missingIdSet.has(assetId))
          if (filtered.length !== nextData[field].length) {
            nextData[field] = filtered
            changed = true
          }
        }
        return changed ? { ...node, data: nextData } : node
      }))
      setRunNotice(`Asset Browser refreshed. Removed ${missingAssetIds.length} missing local asset reference${missingAssetIds.length === 1 ? '' : 's'}.`)
    } catch (error) {
      setRunNotice(error?.message || t('canvas.status.assetRefreshFailed'))
    } finally {
      setIsRefreshingAssetBrowser(false)
    }
  }, [assets, currentProjectHandle, isRefreshingAssetBrowser, removeAsset, setNodes])

  const flowCanvasActions = useMemo(() => ({
    onResizeStart: handleFlowNodeResizeStart,
    onPickImage: handlePickNodeImage,
    onChooseProjectAsset: handleChooseNodeProjectAsset,
    onClearProjectAsset: handleClearNodeProjectAsset,
    imageInputAssetOptions: imageInputAssets,
    styleAssetOptions: styleAssets,
    maskAssetOptions: maskAssets,
  }), [handleChooseNodeProjectAsset, handleClearNodeProjectAsset, handleFlowNodeResizeStart, handlePickNodeImage, imageInputAssets, maskAssets, styleAssets])

  const handleConnect = useCallback((connection) => {
    if (!isValidFlowConnection(connection)) return
    recordFlowHistorySnapshot()
    setEdges((prev) => {
      const filtered = isSingletonTargetHandle(connection.targetHandle)
        ? prev.filter((edge) => !(edge.target === connection.target && edge.targetHandle === connection.targetHandle))
        : prev
      return [
        ...filtered,
        createFlowEdge(connection),
      ]
    })
    setActiveConnection(null)
  }, [recordFlowHistorySnapshot, setEdges])

  const handleConnectStart = useCallback((_event, params) => {
    const node = nodes.find((entry) => entry.id === params?.nodeId)
    const definition = getFlowNodeDefinition(node?.type)
    const ports = params?.handleType === 'target' ? (definition?.inputs || []) : (definition?.outputs || [])
    const activePort = ports.find((port) => port.id === params?.handleId)
    setActiveConnection({
      handleId: String(params?.handleId || ''),
      handleType: String(params?.handleType || ''),
      visualType: resolveFlowPortVisualType(parsePortType(params?.handleId || ''), activePort?.label),
    })
  }, [nodes])

  const handleConnectEnd = useCallback(() => {
    setActiveConnection(null)
  }, [])

  const handleAddNode = useCallback((nodeType) => {
    const nextIndex = nodes.length
    const newNode = createFlowNode(nodeType, {
      position: {
        x: 120 + ((nextIndex % 3) * 320),
        y: 80 + (Math.floor(nextIndex / 3) * 190),
      },
      data: {
        workflowId: getFlowNodeSupportsExecution(nodeType)
          ? getDefaultWorkflowId(nodeType)
          : undefined,
      },
    })
    recordFlowHistorySnapshot()
    setNodes((prev) => [
      ...prev.map((node) => ({ ...node, selected: false })),
      { ...newNode, selected: true },
    ])
    setSelectedNodeId(newNode.id)
  }, [nodes.length, recordFlowHistorySnapshot, setNodes])

  const duplicateFlowNodes = useCallback((nodeIds = []) => {
    const ids = (nodeIds || []).filter(Boolean)
    if (ids.length === 0) return false
    const nodeIdSet = new Set(ids)
    const sourceNodes = nodes.filter((node) => nodeIdSet.has(node.id))
    if (sourceNodes.length === 0) return false

    recordFlowHistorySnapshot()

    const nodeIdMap = new Map()
    const duplicatedNodes = sourceNodes.map((node) => {
      const duplicate = buildFlowGraphNodeSnapshot(node, {
        id: `${node.id}_copy_${Math.random().toString(36).slice(2, 8)}`,
        preserveOutputs: false,
        selected: true,
      })
      duplicate.position = {
        x: (Number(node?.position?.x) || 0) + FLOW_PASTE_OFFSET_PX,
        y: (Number(node?.position?.y) || 0) + FLOW_PASTE_OFFSET_PX,
      }
      nodeIdMap.set(node.id, duplicate.id)
      return duplicate
    })
    const duplicatedEdges = edges
      .filter((edge) => nodeIdSet.has(edge.source) && nodeIdSet.has(edge.target))
      .map((edge) => buildFlowGraphEdgeSnapshot(edge, {
        id: `${edge.id}_copy_${Math.random().toString(36).slice(2, 8)}`,
        source: nodeIdMap.get(edge.source),
        target: nodeIdMap.get(edge.target),
      }))
      .filter(Boolean)

    setNodes((prev) => [
      ...prev.map((node) => ({ ...node, selected: false })),
      ...duplicatedNodes,
    ])
    setEdges((prev) => [
      ...prev.map((edge) => ({ ...edge, selected: false })),
      ...duplicatedEdges,
    ])
    setSelectedNodeId(duplicatedNodes.length === 1 ? duplicatedNodes[0].id : null)
    return true
  }, [edges, nodes, recordFlowHistorySnapshot, setEdges, setNodes])

  const copyFlowSelection = useCallback(() => {
    const nodeIds = selectedNodeIds.length > 0
      ? selectedNodeIds
      : (selectedNodeId ? [selectedNodeId] : [])
    const payload = buildFlowClipboardPayload(nodes, edges, nodeIds)
    if (payload.nodes.length === 0) return false
    flowClipboardRef.current = payload
    setRunNotice(
      `Copied ${payload.nodes.length} CANVAS node${payload.nodes.length === 1 ? '' : 's'}${payload.edges.length > 0 ? ` and ${payload.edges.length} edge${payload.edges.length === 1 ? '' : 's'}` : ''}.`
    )
    return true
  }, [edges, nodes, selectedNodeId, selectedNodeIds])

  const pasteFlowSelection = useCallback(() => {
    const payload = flowClipboardRef.current
    if (!payload?.nodes?.length) return false

    recordFlowHistorySnapshot()

    const nextPasteCount = Math.max(1, Number(payload.pasteCount || 0) + 1)
    const pasted = cloneFlowClipboardPayload(payload, nextPasteCount)
    flowClipboardRef.current = {
      ...payload,
      pasteCount: nextPasteCount,
    }

    setNodes((prev) => [
      ...prev.map((node) => ({ ...node, selected: false })),
      ...pasted.nodes,
    ])
    setEdges((prev) => [
      ...prev.map((edge) => ({ ...edge, selected: false })),
      ...pasted.edges,
    ])
    setSelectedNodeId(pasted.nodes.length === 1 ? pasted.nodes[0].id : null)
    setRunNotice(`Pasted ${pasted.nodes.length} CANVAS node${pasted.nodes.length === 1 ? '' : 's'}.`)
    return true
  }, [recordFlowHistorySnapshot, setEdges, setNodes])

  const deleteFlowSelection = useCallback(() => {
    const nodeIds = selectedNodeIds.length > 0
      ? selectedNodeIds
      : (selectedNodeId ? [selectedNodeId] : [])
    const edgeIds = selectedEdgeIds
    if (nodeIds.length === 0 && edgeIds.length === 0) return false

    const nodeIdSet = new Set(nodeIds)
    const edgeIdSet = new Set(edgeIds)
    recordFlowHistorySnapshot()

    setNodes((prev) => prev.filter((node) => !nodeIdSet.has(node.id)))
    setEdges((prev) => prev.filter((edge) => (
      !edgeIdSet.has(edge.id)
      && !nodeIdSet.has(edge.source)
      && !nodeIdSet.has(edge.target)
    )))
    setSelectedNodeId(null)
    return true
  }, [recordFlowHistorySnapshot, selectedEdgeIds, selectedNodeId, selectedNodeIds, setEdges, setNodes])

  const handleCreateDocument = useCallback((templateId = 'blank') => {
    const template = FLOW_AI_TEMPLATES.find((entry) => entry.id === templateId)
    const newDocument = createFlowDocument({
      name: template?.label || 'Flow',
      templateId,
    })
    setFlowProjectState((prev) => ({
      ...prev,
      activeDocumentId: newDocument.id,
      documents: [...prev.documents, newDocument],
    }))
    setActiveDocumentId(newDocument.id)
  }, [])

  const handleDuplicateDocument = useCallback(() => {
    if (!activeDocument) return
    const duplicate = {
      ...activeDocument,
      id: `flow_copy_${Date.now()}`,
      name: `${activeDocument.name} Copy`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: activeDocument.nodes.map((node) => ({
        ...node,
        id: `${node.id}_copy_${Math.random().toString(36).slice(2, 6)}`,
        data: {
          ...node.data,
          status: 'idle',
          statusMessage: '',
          error: '',
          progress: 0,
          estimatedCredits: null,
          estimatedCreditsSource: null,
          outputAssetIds: [],
          resolvedAssetIds: [],
          outputText: '',
          lastPromptId: null,
          lastRunAt: null,
        },
      })),
      edges: [],
    }
    const nodeIdMap = new Map()
    duplicate.nodes.forEach((node, index) => {
      nodeIdMap.set(activeDocument.nodes[index].id, node.id)
    })
    duplicate.edges = activeDocument.edges.map((edge) => ({
      ...edge,
      id: `${edge.id}_copy_${Math.random().toString(36).slice(2, 6)}`,
      source: nodeIdMap.get(edge.source) || edge.source,
      target: nodeIdMap.get(edge.target) || edge.target,
    }))
    setFlowProjectState((prev) => ({
      ...prev,
      activeDocumentId: duplicate.id,
      documents: [...prev.documents, duplicate],
    }))
    setActiveDocumentId(duplicate.id)
  }, [activeDocument])

  const handleDeleteDocument = useCallback(() => {
    if (!activeDocument || flowProjectData.documents.length <= 1) return
    const remaining = flowProjectData.documents.filter((document) => document.id !== activeDocument.id)
    const nextActive = remaining[0]
    setFlowProjectState((prev) => ({
      ...prev,
      activeDocumentId: nextActive.id,
      documents: remaining,
    }))
    setActiveDocumentId(nextActive.id)
  }, [activeDocument, flowProjectData.documents])

  const handleOpenInformationSource = useCallback(async () => {
    if (!informationDetails?.repositoryUrl) return
    await window?.electronAPI?.openExternalUrl?.(informationDetails.repositoryUrl)
  }, [informationDetails])

  const prepareLoraFactoryModels = useCallback(async (factoryType) => {
    const electron = window?.electronAPI
    if (!electron?.getSetting || !electron?.validateWorkflowSetupRoot || !electron?.checkWorkflowSetupFiles) {
      throw new Error('ComfyUI model discovery is available in the Windows desktop build.')
    }

    const configuredRoot = String(await electron.getSetting('comfyRootPath') || '').trim()
    const rootValidation = await electron.validateWorkflowSetupRoot(configuredRoot)
    if (!rootValidation?.isValid) {
      throw new Error('Set a valid ComfyUI folder in Settings > Workflow Setup before launching the LoRA Factory.')
    }

    const recipes = LORA_FACTORY_MODEL_RECIPES[factoryType]
    setLoraFactoryPreparation({ message: 'Finding the models used by the existing ComfyUI flow…', percent: 0 })

    let preferredBase = ''
    const discovery = await electron.discoverLoraFactoryBaseModels?.({
      factoryType,
      comfyRootPath: rootValidation.normalizedPath,
    })
    if (!discovery?.success) {
      throw new Error(discovery?.error || 'Could not inspect the configured ComfyUI model folders.')
    }
    if (!discovery.loraOutputPath) {
      throw new Error('Could not create or access the ComfyUI LoRA output folder.')
    }
    const baseChoices = Array.isArray(discovery?.models)
      ? discovery.models.map((model) => String(model?.name || '')).filter(Boolean)
      : []
    let preferredVae = recipes.vae.filename
    let preferredQwen = recipes.qwen?.filename || ''
    if (factoryType === 'anima') {
      const savedBase = await electron.getSetting('animaBaseDiffusionModel')
      preferredBase = chooseCivitaiAnimaDiffusionModel(baseChoices, getComfyModelBasename(savedBase))
    } else {
      const savedBase = await electron.getSetting('sdxlBaseCheckpoint')
      preferredBase = chooseCivitaiLoraBaseCheckpoint(baseChoices, 'SDXL', getComfyModelBasename(savedBase))
    }

    const roleCandidates = [
      {
        role: 'base',
        recipe: recipes.base,
        filenames: [...new Set([getComfyModelBasename(preferredBase), recipes.base.filename].filter(Boolean))],
      },
      {
        role: 'vae',
        recipe: recipes.vae,
        filenames: [...new Set([getComfyModelBasename(preferredVae), recipes.vae.filename].filter(Boolean))],
      },
      ...(recipes.qwen ? [{
        role: 'qwen',
        recipe: recipes.qwen,
        filenames: [...new Set([getComfyModelBasename(preferredQwen), recipes.qwen.filename].filter(Boolean))],
      }] : []),
    ]
    const filesToCheck = roleCandidates.flatMap(({ recipe, filenames }) => (
      filenames.map((filename) => ({ filename, targetSubdir: recipe.targetSubdir }))
    ))

    const findRolePaths = async () => {
      const checked = await electron.checkWorkflowSetupFiles({
        comfyRootPath: rootValidation.normalizedPath,
        files: filesToCheck,
      })
      if (!checked?.success) throw new Error(checked?.error || 'Could not inspect the ComfyUI model folders.')
      let resultIndex = 0
      const paths = {}
      for (const candidate of roleCandidates) {
        const results = checked.results.slice(resultIndex, resultIndex + candidate.filenames.length)
        resultIndex += candidate.filenames.length
        paths[candidate.role] = results.find((result) => result?.exists)?.resolvedPath || ''
      }
      return paths
    }

    let rolePaths = await findRolePaths()
    const missingRecipes = roleCandidates
      .filter(({ role }) => !rolePaths[role])
      .map(({ recipe }) => recipe)
    if (missingRecipes.length > 0) {
      if (!electron.installWorkflowSetup) throw new Error('Automatic model download is unavailable in this build.')
      setLoraFactoryPreparation({
        message: `Downloading ${missingRecipes.map((recipe) => recipe.displayName).join(', ')} to ComfyUI…`,
        percent: 0,
      })
      const installResult = await electron.installWorkflowSetup({
        comfyRootPath: rootValidation.normalizedPath,
        plan: { nodePacks: [], models: missingRecipes },
      })
      if (!installResult?.success) {
        throw new Error(installResult?.error || installResult?.errors?.join(' ') || 'Could not download the required LoRA training models.')
      }
      rolePaths = await findRolePaths()
    }

    const unresolvedRole = roleCandidates.find(({ role }) => !rolePaths[role])
    if (unresolvedRole) throw new Error(`${unresolvedRole.recipe.displayName} could not be found after setup.`)
    if (factoryType === 'anima') await electron.setSetting?.('animaBaseDiffusionModel', preferredBase || recipes.base.filename)
    if (factoryType === 'sdxl') await electron.setSetting?.('sdxlBaseCheckpoint', preferredBase || recipes.base.filename)
    return {
      modelPaths: {
        modelPath: rolePaths.base,
        vaePath: rolePaths.vae,
        qwenPath: rolePaths.qwen || '',
      },
      outputDirectory: String(discovery?.loraOutputPath || '').trim(),
    }
  }, [])

  useEffect(() => {
    const requestId = String(templateRequest?.requestId || '').trim()
    const templateId = String(templateRequest?.templateId || '').trim()
    if (!requestId || !FLOW_AI_TEMPLATES.some((template) => template.id === templateId)) return
    setSelectedTemplateId(templateId)
    const existingDocument = [...flowProjectData.documents].reverse().find((document) => document.templateId === templateId)
    if (existingDocument) setActiveDocumentId(existingDocument.id)
    else handleCreateDocument(templateId)
  }, [flowProjectData.documents, handleCreateDocument, templateRequest])

  const handleLaunchInstalledFactory = useCallback(async (documentOverride = null, launchOptions = {}) => {
    const factoryDocument = documentOverride || informationDocument
    if (!factoryDocument || isLaunchingFactory) return
    const datasetPath = String(launchOptions.datasetPath ?? loraDatasetExportPath ?? '').trim()
    const datasetStatus = String(launchOptions.datasetStatus ?? loraDatasetStatus ?? '')
    if (!['ready', 'existing'].includes(datasetStatus)) {
      const message = 'Generate and export the Design Set, or choose an existing dataset, before launching the LoRA Factory.'
      setRunNotice(message)
      setLoraFactoryLaunchError({ message })
      appendProcessConsole({ source: 'Dataset export', level: 'warning', message })
      return
    }
    const electron = window?.electronAPI
    if (!electron?.getSetting || !electron?.launchLoraFactory) {
      setRunNotice('Launching a local LoRA Factory is available in the Windows desktop build.')
      return
    }
    const factoryType = factoryDocument.templateId === 'sdxl-lora-dataset' ? 'sdxl' : 'anima'
    const factoryLabel = factoryType === 'sdxl' ? 'SDXL Factory' : 'Anima Factory'
    setLoraFactoryLaunchError(null)
    setIsProcessConsoleOpen(true)
    appendProcessConsole({ source: factoryLabel, message: 'Preparing the LoRA Factory launch…' })
    const rootPath = String(await electron.getSetting(LORA_FACTORY_ROOT_SETTING_KEYS[factoryType]) || '').trim()
    const rootStatus = rootPath && electron.validateLoraFactoryRoot
      ? await electron.validateLoraFactoryRoot(rootPath)
      : null
    if (!rootPath || (rootStatus && !rootStatus.isValid)) {
      const message = rootPath
        ? `${factoryType === 'sdxl' ? 'SDXL' : 'Anima'} LoRA Factory folder is no longer valid. Choose it again in Settings > File Paths.`
        : `Set the ${factoryType === 'sdxl' ? 'SDXL' : 'Anima'} LoRA Factory folder in Settings > File Paths first.`
      setRunNotice(message)
      setLoraFactoryLaunchError({ message, settingsSection: 'paths', focusTarget: 'lora-factories' })
      appendProcessConsole({ source: factoryLabel, level: 'error', message })
      return
    }

    setIsLaunchingFactory(true)
    const unsubscribeProgress = electron.onWorkflowSetupProgress?.((entry) => {
      const message = String(entry?.message || 'Preparing LoRA training models…')
      setLoraFactoryPreparation({
        message,
        percent: Number.isFinite(entry?.overallPercent) ? entry.overallPercent : null,
      })
      appendProcessConsole({
        source: 'Model setup',
        level: entry?.level === 'error' ? 'error' : entry?.level === 'warning' ? 'warning' : 'info',
        message: Number.isFinite(entry?.overallPercent) ? `[${Math.round(entry.overallPercent)}%] ${message}` : message,
      })
    })
    try {
      const preparedPaths = await prepareLoraFactoryModels(factoryType)
      const modelPaths = preparedPaths.modelPaths
      setLoraFactoryPreparation({ message: 'Opening the Factory with the dataset, model, and ComfyUI LoRA output paths…', percent: 100 })
      const result = await electron.launchLoraFactory({
        factoryType,
        rootPath,
        datasetPath,
        modelPaths,
        outputDirectory: preparedPaths.outputDirectory,
      })
      setRunNotice(result?.success
        ? result.message
        : (result?.error || 'Could not start the LoRA Factory.'))
      if (!result?.success) {
        setLoraFactoryLaunchError({ message: result?.error || 'Could not start the LoRA Factory.' })
        appendProcessConsole({ source: factoryLabel, level: 'error', message: result?.error || 'Could not start the LoRA Factory.' })
      }
      if (result?.success) setInformationDocumentId(null)
    } catch (error) {
      const message = error?.message || 'Could not start the LoRA Factory.'
      const needsComfySettings = /ComfyUI folder in Settings/i.test(message)
      setRunNotice(message)
      setLoraFactoryLaunchError({
        message,
        ...(needsComfySettings ? { settingsSection: 'workflow-setup' } : {}),
      })
      appendProcessConsole({ source: factoryLabel, level: 'error', message })
    } finally {
      unsubscribeProgress?.()
      setIsLaunchingFactory(false)
      setLoraFactoryPreparation(null)
    }
  }, [appendProcessConsole, informationDocument, isLaunchingFactory, loraDatasetExportPath, loraDatasetStatus, prepareLoraFactoryModels])

  const handleChooseExistingLoraDataset = useCallback(async (document = activeDocument) => {
    if (!document || !['anima-lora-dataset', 'sdxl-lora-dataset'].includes(document.templateId)) return
    const electron = window?.electronAPI
    if (!electron?.selectDirectory) {
      setRunNotice(t('canvas.status.desktopDatasetPicker'))
      return
    }
    const factoryLabel = document.templateId === 'sdxl-lora-dataset' ? 'SDXL LoRA Factory' : 'Anima LoRA Factory'
    const destination = await electron.selectDirectory({
      title: `Choose an existing ${factoryLabel} image dataset folder`,
    })
    if (!destination) return
    setLoraDatasetExportPath(destination)
    setLoraDatasetStatus('existing')
    setRunNotice(`Using the existing LoRA training image set at ${destination}.`)
    setLoraFactoryLaunchError(null)
    await handleLaunchInstalledFactory(document, { datasetPath: destination, datasetStatus: 'existing' })
  }, [activeDocument, handleLaunchInstalledFactory])

  const handleChooseLoraDatasetOutput = useCallback(async (document = activeDocument) => {
    if (!document || !['anima-lora-dataset', 'sdxl-lora-dataset'].includes(document.templateId)) return
    const electron = window?.electronAPI
    if (!electron?.selectDirectory) {
      setRunNotice(t('canvas.status.desktopOutputPicker'))
      return
    }
    const factoryLabel = document.templateId === 'sdxl-lora-dataset' ? 'SDXL LoRA Factory' : 'Anima LoRA Factory'
    const destination = await electron.selectDirectory({
      title: `Choose the automatic ${factoryLabel} Design Set export folder`,
    })
    if (!destination) return
    setLoraDatasetExportPath(destination)
    setLoraDatasetStatus('output-selected')
    setLoraFactoryLaunchError(null)
    setRunNotice(`Design Set will export automatically to ${destination} after generation.`)
    appendProcessConsole({ source: 'Dataset export', message: `Automatic export folder selected: ${destination}` })
  }, [activeDocument, appendProcessConsole])

  const exportLoraAssetsToDirectory = useCallback(async ({ assetIds = [], destination = '' } = {}) => {
    const electron = window?.electronAPI
    const normalizedDestination = String(destination || '').trim()
    if (!normalizedDestination || !electron?.copyFile || !electron?.pathJoin) {
      return { success: false, copiedCount: 0, error: 'LoRA dataset export is unavailable or has no destination folder.' }
    }

    const currentAssets = useAssetsStore.getState().assets || []
    const currentAssetById = new Map(currentAssets.map((asset) => [asset.id, asset]))
    const uniqueImageAssets = [...new Set(assetIds)]
      .map((assetId) => currentAssetById.get(assetId))
      .filter((asset) => asset && (asset.type === 'image' || asset.type === 'mask'))
    if (uniqueImageAssets.length === 0) {
      return { success: false, copiedCount: 0, error: 'No local training images were available to export.' }
    }

    setIsExportingDataset(true)
    appendProcessConsole({ source: 'Dataset export', message: `Exporting ${uniqueImageAssets.length} training images to ${normalizedDestination}…` })
    try {
      let copiedCount = 0
      for (let index = 0; index < uniqueImageAssets.length; index += 1) {
        const asset = uniqueImageAssets[index]
        let sourcePath = getDatasetAssetSourcePath(asset, currentProjectHandle)
        if (sourcePath && typeof sourcePath === 'object') {
          sourcePath = await electron.pathJoin(sourcePath.projectHandle, sourcePath.recordedPath)
        }
        if (!sourcePath) continue
        const sanitizedSourceName = sanitizeDatasetFilename(
          asset.name || await electron.pathBasename?.(sourcePath) || `training-image-${index + 1}.png`,
          `training-image-${index + 1}.png`
        )
        const sourceName = ensureDatasetImageExtension(sanitizedSourceName, sourcePath, asset)
        const destinationPath = await electron.pathJoin(
          normalizedDestination,
          `${String(index + 1).padStart(3, '0')}_${sourceName}`
        )
        const result = await electron.copyFile(sourcePath, destinationPath)
        if (result?.success) copiedCount += 1
      }
      if (copiedCount === 0) {
        return { success: false, copiedCount, error: 'No local image files could be copied. Check that the generated assets are still available.' }
      }
      setLoraDatasetExportPath(normalizedDestination)
      setLoraDatasetStatus('ready')
      appendProcessConsole({
        source: 'Dataset export',
        level: 'success',
        message: `Exported ${copiedCount} training image${copiedCount === 1 ? '' : 's'} to ${normalizedDestination}.`,
      })
      return { success: true, copiedCount, destination: normalizedDestination }
    } catch (error) {
      const message = error?.message || 'Could not export the LoRA training images.'
      appendProcessConsole({ source: 'Dataset export', level: 'error', message })
      return { success: false, copiedCount: 0, error: message }
    } finally {
      setIsExportingDataset(false)
    }
  }, [appendProcessConsole, currentProjectHandle])

  const handleExportLoraDataset = useCallback(async () => {
    if (!informationDocument || !informationDetails?.datasetExport || isExportingDataset) return
    const electron = window?.electronAPI
    if (!electron?.selectDirectory) {
      setRunNotice(t('canvas.status.desktopDatasetExport'))
      return
    }

    const liveDocument = informationDocument.id === activeDocumentId
      ? { ...informationDocument, nodes, edges, viewport }
      : informationDocument
    const hasEnabledInpaint = (liveDocument.nodes || []).some((node) => (
      node?.data?.optionalStage === 'inpaint'
      && node?.data?.enabled === true
      && Array.isArray(node?.data?.outputAssetIds)
      && node.data.outputAssetIds.length > 0
    ))
    const assetIds = []
    for (const node of liveDocument.nodes || []) {
      const excludesRawSource = hasEnabledInpaint && node?.data?.datasetRole === 'source'
      if (node.type === FLOW_AI_NODE_TYPES.imageInput && node?.data?.assetId && !node?.data?.excludeFromDatasetExport && !excludesRawSource) {
        assetIds.push(node.data.assetId)
      }
      for (const assetId of node?.data?.outputAssetIds || []) assetIds.push(assetId)
      for (const assetId of node?.data?.resolvedAssetIds || []) assetIds.push(assetId)
    }
    const generatedAngleAssetIds = [...new Set((liveDocument.nodes || [])
      .filter((node) => node?.data?.workflowId === 'multi-angles')
      .flatMap((node) => [
        ...(Array.isArray(node?.data?.outputAssetIds) ? node.data.outputAssetIds : []),
        ...(Array.isArray(node?.data?.resolvedAssetIds) ? node.data.resolvedAssetIds : []),
      ]))]
    const hasCompleteGeneratedAngleSet = generatedAngleAssetIds.length >= 8

    const destination = await electron.selectDirectory({
      title: hasCompleteGeneratedAngleSet
        ? `Choose the ${informationDetails.title} training-image export folder`
        : `Choose an existing ${informationDetails.title} image dataset folder`,
    })
    if (!destination) return

    if (!hasCompleteGeneratedAngleSet) {
      setLoraDatasetExportPath(destination)
      setLoraDatasetStatus('existing')
      setRunNotice(`Using the existing LoRA training image set at ${destination}.`)
      return
    }

    const exportResult = await exportLoraAssetsToDirectory({ assetIds, destination })
    setRunNotice(exportResult.success
      ? `Exported ${exportResult.copiedCount} LoRA training image${exportResult.copiedCount === 1 ? '' : 's'} to ${destination}.`
      : exportResult.error)
  }, [activeDocumentId, edges, exportLoraAssetsToDirectory, informationDetails, informationDocument, isExportingDataset, nodes, viewport])

  const handleRun = useCallback(async (options = {}) => {
    if (!activeDocument || isRunning) return
    if (activeDocumentCreatesLoraDataset && !String(loraDatasetExportPath || '').trim()) {
      const message = 'Choose the Export Design Set folder in Step 1 before generating training images.'
      setRunNotice(message)
      setIsProcessConsoleOpen(true)
      appendProcessConsole({ source: 'Dataset export', level: 'warning', message })
      return
    }
    setNodeContextMenu(null)
    setIsRunning(true)
    setIsStopping(false)
    setRunNotice('')
    setCompletionNotice(null)
    setIsProcessConsoleOpen(true)
    lastNodeConsoleStatusRef.current.clear()
    appendProcessConsole({
      source: 'CANVAS',
      message: `Starting ${activeDocument.label || activeDocument.title || 'workflow'}…`,
    })
    try {
      const snapshot = {
        ...activeDocument,
        nodes,
        edges,
        viewport,
      }
      const result = await runFlowGraph(snapshot, {
        documentId: activeDocument.id,
        targetNodeId: options.targetNodeId || null,
        forceRunAll: Boolean(options.forceRunAll),
        onNodePatch: (nodeId, patch) => {
          updateNodeData(nodeId, patch, { recordHistory: false })
          const statusMessage = String(patch?.statusMessage || patch?.error || '').trim()
          const status = String(patch?.status || '').trim()
          if (!statusMessage && !status) return
          const node = snapshot.nodes.find((candidate) => candidate.id === nodeId)
          const nodeLabel = node?.data?.label || node?.data?.workflowLabel || nodeId
          const progress = Number.isFinite(patch?.progress) ? ` ${Math.round(patch.progress)}%` : ''
          const signature = `${status}|${progress}|${statusMessage}`
          if (lastNodeConsoleStatusRef.current.get(nodeId) === signature) return
          lastNodeConsoleStatusRef.current.set(nodeId, signature)
          appendProcessConsole({
            source: nodeLabel,
            level: status === 'error' || patch?.error ? 'error' : status === 'complete' ? 'success' : 'info',
            message: `${status || 'working'}${progress}${statusMessage ? ` — ${statusMessage}` : ''}`,
          })
        },
      })
      if (result.importedAssetIds.length > 0) {
        const firstAssetId = result.importedAssetIds[0]
        const firstAsset = useAssetsStore.getState().assets.find((asset) => asset.id === firstAssetId)
        if (firstAsset) setPreview(firstAsset)
      }
      const importedCount = result.importedAssetIds.length
      const textCount = Array.isArray(result.textOutputNodeIds) ? result.textOutputNodeIds.length : 0
      const baseCompletionDetail = importedCount > 0
        ? `Saved ${importedCount} asset${importedCount === 1 ? '' : 's'} to the Assets panel.`
        : textCount > 0
          ? `Updated ${textCount} prompt output${textCount === 1 ? '' : 's'}.`
          : 'Flow finished without new assets.'
      let automaticExportResult = null
      if (activeDocumentCreatesLoraDataset && importedCount > 0) {
        const sourceNode = snapshot.nodes.find((node) => node?.data?.datasetRole === 'source')
        const inpaintEnabled = snapshot.nodes.some((node) => node?.data?.optionalStage === 'inpaint' && node?.data?.enabled === true)
        const exportAssetIds = [
          ...(!inpaintEnabled && sourceNode?.data?.assetId ? [sourceNode.data.assetId] : []),
          ...result.importedAssetIds,
        ]
        automaticExportResult = await exportLoraAssetsToDirectory({
          assetIds: exportAssetIds,
          destination: loraDatasetExportPath,
        })
      }
      const completionDetail = automaticExportResult?.success
        ? `${baseCompletionDetail} Automatically exported ${automaticExportResult.copiedCount} Design Set image${automaticExportResult.copiedCount === 1 ? '' : 's'} to ${automaticExportResult.destination}.`
        : automaticExportResult
          ? `${baseCompletionDetail} Automatic Design Set export failed: ${automaticExportResult.error}`
          : baseCompletionDetail
      setRunNotice(automaticExportResult?.success
        ? `Design Set ready: ${automaticExportResult.destination}`
        : automaticExportResult
          ? `Training images were generated, but automatic export failed: ${automaticExportResult.error}`
          : importedCount > 0
            ? `CANVAS imported ${importedCount} asset${importedCount === 1 ? '' : 's'}.`
            : textCount > 0
              ? `CANVAS updated ${textCount} prompt output${textCount === 1 ? '' : 's'}.`
              : 'CANVAS finished without new assets.')
      setCompletionNotice({
        title: activeDocumentCreatesLoraDataset && importedCount > 0 ? 'Training images ready' : 'Flow Complete',
        detail: activeDocumentCreatesLoraDataset && importedCount > 0
          ? `${completionDetail} Lumeweft will now launch the Factory automatically.`
          : completionDetail,
      })
      appendProcessConsole({ source: 'CANVAS', level: 'success', message: completionDetail })
      if (activeDocumentCreatesLoraDataset && importedCount > 0) {
        setInformationDocumentId(activeDocument.id)
      }
      if (automaticExportResult?.success) {
        await handleLaunchInstalledFactory(snapshot, {
          datasetPath: automaticExportResult.destination,
          datasetStatus: 'ready',
          automatic: true,
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'CANVAS run failed.')
      const interrupted = /interrupt/i.test(message)
      setRunNotice(interrupted ? 'CANVAS interrupted.' : message)
      appendProcessConsole({ source: 'CANVAS', level: interrupted ? 'warning' : 'error', message: interrupted ? 'CANVAS interrupted.' : message })
      setCompletionNotice(null)
      if (selectedNodeId && !interrupted) {
        updateNodeData(selectedNodeId, {
          status: 'error',
          error: message,
          statusMessage: '',
        }, { recordHistory: false })
      }
    } finally {
      setIsStopping(false)
      setIsRunning(false)
    }
  }, [activeDocument, activeDocumentCreatesLoraDataset, appendProcessConsole, edges, exportLoraAssetsToDirectory, handleLaunchInstalledFactory, isRunning, loraDatasetExportPath, nodes, selectedNodeId, setPreview, updateNodeData, viewport])
  const handleRunNodeFromContextMenu = useCallback(() => {
    if (!nodeContextMenuTarget || !nodeContextMenuRunnable) return
    setNodeContextMenu(null)
    void handleRun({ targetNodeId: nodeContextMenuTarget.id })
  }, [handleRun, nodeContextMenuRunnable, nodeContextMenuTarget])

  const handleStopFlow = useCallback(async () => {
    if (!isRunning || isStopping) return
    setIsStopping(true)
    setRunNotice(t('canvas.status.interruptRequested'))
    appendProcessConsole({ source: 'CANVAS', level: 'warning', message: t('canvas.status.interruptRequested') })
    setCompletionNotice(null)
    setNodes((prev) => prev.map((node) => (
      FLOW_BUSY_STATUSES.has(String(node?.data?.status || ''))
        ? {
            ...node,
            data: {
              ...node.data,
              statusMessage: 'Interrupt requested…',
            },
          }
        : node
    )))
    try {
      await comfyui.interrupt()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'Failed to interrupt CANVAS.')
      setRunNotice(message)
      setIsStopping(false)
    }
  }, [appendProcessConsole, isRunning, isStopping, setNodes])

  const handleSaveNow = useCallback(async () => {
    setFlowAiData({
      ...flowProjectData,
      activeDocumentId,
    })
    await saveProject()
    setRunNotice(t('canvas.status.saved'))
  }, [activeDocumentId, flowProjectData, saveProject, setFlowAiData])

  const handleReloadWorkspace = useCallback(() => {
    // Flush the live graph before App remounts ReactFlow. The normal project
    // sync is debounced, so reloading immediately after an edit must not drop
    // the latest node positions, edges, or viewport.
    const payload = {
      ...flowProjectData,
      activeDocumentId,
      documents: flowProjectData.documents.map((document) => (
        document.id === activeDocumentId
          ? {
              ...document,
              nodes,
              edges,
              viewport,
              updatedAt: new Date().toISOString(),
            }
          : document
      )),
    }
    setFlowAiData(payload)
    onReloadWorkspace?.()
  }, [activeDocumentId, edges, flowProjectData, nodes, onReloadWorkspace, setFlowAiData, viewport])

  const handleResetInspectorWidth = useCallback(() => {
    setInspectorWidth(clampFlowInspectorWidth(FLOW_AI_INSPECTOR_DEFAULT_WIDTH, workspaceWidth))
  }, [workspaceWidth])

  const handleStartInspectorResize = useCallback((event) => {
    if (event.button !== 0) return
    const layoutRect = workspaceLayoutRef.current?.getBoundingClientRect()
    if (!layoutRect) return
    event.preventDefault()
    inspectorResizeStateRef.current = {
      layoutRight: layoutRect.right,
      layoutWidth: layoutRect.width,
    }
    setInspectorWidth(clampFlowInspectorWidth(layoutRect.right - event.clientX, layoutRect.width))
    setIsInspectorResizing(true)
  }, [])

  const handleInspectorResizeKeyDown = useCallback((event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setInspectorWidth((current) => clampFlowInspectorWidth(current + 24, workspaceWidth))
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setInspectorWidth((current) => clampFlowInspectorWidth(current - 24, workspaceWidth))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setInspectorWidth(clampFlowInspectorWidth(FLOW_AI_INSPECTOR_MIN_WIDTH, workspaceWidth))
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setInspectorWidth(clampFlowInspectorWidth(FLOW_AI_INSPECTOR_MAX_WIDTH, workspaceWidth))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleResetInspectorWidth()
    }
  }, [handleResetInspectorWidth, workspaceWidth])

  useEffect(() => {
    if (activeDocumentIsRecipe) return undefined
    const handleKeyDown = (event) => {
      if (isTypingTarget(event.target)) return

      const key = String(event.key || '').toLowerCase()
      const isModifierHeld = event.ctrlKey || event.metaKey

      if (isModifierHeld && !event.shiftKey && key === 'z') {
        if (undoFlowGraph()) {
          event.preventDefault()
        }
        return
      }

      if (isModifierHeld && ((event.shiftKey && key === 'z') || key === 'y')) {
        if (redoFlowGraph()) {
          event.preventDefault()
        }
        return
      }

      if (isModifierHeld && key === 'c') {
        if (copyFlowSelection()) {
          event.preventDefault()
        }
        return
      }

      if (isModifierHeld && key === 'v') {
        if (pasteFlowSelection()) {
          event.preventDefault()
        }
        return
      }

      if ((event.key === 'Delete' || event.key === 'Backspace') && !isModifierHeld) {
        if (deleteFlowSelection()) {
          event.preventDefault()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeDocumentIsRecipe, copyFlowSelection, deleteFlowSelection, pasteFlowSelection, redoFlowGraph, undoFlowGraph])

  const selectedNodeWorkflowSummary = selectedNode?.data?.workflowId
    ? getFlowWorkflowSummary(selectedNode.data.workflowId)
    : null
  const selectedNodeDependency = selectedNode?.data?.workflowId
    ? dependencyByWorkflow[String(selectedNode.data.workflowId || '').trim()]
    : null
  const selectedNodeGuideCreditsPerSecond = selectedNode?.type === FLOW_AI_NODE_TYPES.videoUpscale
    ? getTopazVideoUpscaleCreditsPerSecond(selectedNode?.data?.upscaleModel, selectedNode?.data?.targetResolution)
    : null
  const selectedNodeGuideCreditsLabel = selectedNodeGuideCreditsPerSecond != null
    ? formatCreditsPerSecond(selectedNodeGuideCreditsPerSecond)
    : 'Pricing unavailable'
  const selectedNodeLiveCredits = selectedNode?.type === FLOW_AI_NODE_TYPES.videoUpscale
    ? selectedNode?.data?.estimatedCredits || null
    : null
  const selectedNodeLiveCreditsLabel = selectedNodeLiveCredits ? formatCreditsRange(selectedNodeLiveCredits) : ''
  const selectedImageVariantBehavior = selectedNode?.type === FLOW_AI_NODE_TYPES.imageGen
    ? getFlowImageVariantBehavior(selectedNode?.data?.workflowId)
    : null
  const selectedImageVariantCount = selectedNode?.type === FLOW_AI_NODE_TYPES.imageGen
    ? normalizeFlowImageVariantCount(selectedNode?.data?.variantCount, selectedNode?.data?.workflowId)
    : 1
  const selectedNodeResolvedText = selectedNode?.type === FLOW_AI_NODE_TYPES.textViewer
    ? resolveFlowNodeText(flowTextDocument, selectedNode)
    : ''

  const runnableSelection = Boolean(
    selectedNode
    && (
      getFlowNodeSupportsExecution(selectedNode.type)
      || selectedNode.type === FLOW_AI_NODE_TYPES.output
    )
  )

  const nodeTypes = useMemo(() => ({
    [FLOW_AI_NODE_TYPES.promptAssist]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.textViewer]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.prompt]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.imageInput]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.styleReference]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.imageGen]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.videoGen]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.videoUpscale]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.musicGen]: FlowCanvasNode,
    [FLOW_AI_NODE_TYPES.output]: FlowCanvasNode,
  }), [])
  const edgeTypes = useMemo(() => ({
    'flow-canvas': FlowCanvasEdge,
  }), [])

  const minimapNodeColor = useCallback((node) => {
    switch (node?.type) {
      case FLOW_AI_NODE_TYPES.prompt: return 'rgba(167, 139, 250, 0.42)'
      case FLOW_AI_NODE_TYPES.imageInput: return 'rgba(52, 211, 153, 0.42)'
      case FLOW_AI_NODE_TYPES.styleReference: return 'rgba(232, 121, 249, 0.42)'
      case FLOW_AI_NODE_TYPES.promptAssist: return 'rgba(125, 211, 252, 0.42)'
      case FLOW_AI_NODE_TYPES.textViewer: return 'rgba(196, 181, 253, 0.42)'
      case FLOW_AI_NODE_TYPES.imageGen: return 'rgba(56, 189, 248, 0.42)'
      case FLOW_AI_NODE_TYPES.videoGen: return 'rgba(34, 211, 238, 0.42)'
      case FLOW_AI_NODE_TYPES.videoUpscale: return 'rgba(251, 191, 36, 0.42)'
      case FLOW_AI_NODE_TYPES.musicGen: return 'rgba(251, 191, 36, 0.42)'
      case FLOW_AI_NODE_TYPES.output: return 'rgba(148, 163, 184, 0.5)'
      default: return 'rgba(148, 163, 184, 0.42)'
    }
  }, [])
  const minimapNodeStrokeColor = useCallback(() => 'rgba(148, 163, 184, 0.35)', [])

  return (
    <div ref={workspaceLayoutRef} className="flex h-full min-h-0 overflow-hidden bg-sf-dark-950">
      <style>{`
        @keyframes flow-ai-preview-drift {
          0% { transform: scale(1.02) translate3d(-1.5%, -1%, 0); }
          50% { transform: scale(1.06) translate3d(1.5%, 0.75%, 0); }
          100% { transform: scale(1.02) translate3d(-0.75%, 1%, 0); }
        }
        @keyframes flow-ai-preview-sheen {
          0% { transform: translate3d(-18%, 0, 0); }
          100% { transform: translate3d(180%, 0, 0); }
        }
        @keyframes flow-ai-audio-scan {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(440%, 0, 0); }
        }
        .flow-ai-preview-drift {
          animation: flow-ai-preview-drift 8.5s ease-in-out infinite alternate;
          will-change: transform;
        }
        .flow-ai-canvas .react-flow__node-output {
          background: transparent !important;
          border: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
        }
        .flow-ai-canvas .react-flow__node-output.selected,
        .flow-ai-canvas .react-flow__node-output:focus,
        .flow-ai-canvas .react-flow__node-output:focus-visible {
          box-shadow: none !important;
          outline: none !important;
        }
        .flow-ai-canvas .react-flow__controls {
          border: 1px solid rgba(63, 63, 70, 0.95) !important;
          border-radius: 14px !important;
          overflow: hidden;
          background: rgba(9, 9, 11, 0.94) !important;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28) !important;
        }
        .flow-ai-canvas .react-flow__controls-button {
          width: 34px;
          height: 34px;
          border: 0 !important;
          border-bottom: 1px solid rgba(39, 39, 42, 0.95) !important;
          background: rgba(9, 9, 11, 0.94) !important;
          color: rgba(226, 232, 240, 0.92) !important;
        }
        .flow-ai-canvas .react-flow__controls-button:last-child {
          border-bottom: 0 !important;
        }
        .flow-ai-canvas .react-flow__controls-button:hover {
          background: rgba(24, 24, 27, 0.98) !important;
        }
        .flow-ai-canvas .react-flow__controls-button svg {
          fill: currentColor !important;
        }
      `}</style>
      <div className={`${recipeOnlyMode ? 'hidden' : 'flex'} h-full min-h-0 w-[270px] flex-shrink-0 flex-col border-r border-sf-dark-800 bg-sf-dark-950/80`}>
        <div className="flex-shrink-0 border-b border-sf-dark-800 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sf-text-muted">
            CANVAS
          </div>
          <div className="mt-2 text-sm text-sf-text-secondary">
            {activeDocumentIsRecipe
              ? t('canvas.subtitleRecipe')
              : t('canvas.subtitle')}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sf-text-muted">
                {t('canvas.documents')}
              </div>
              <button
                type="button"
                onClick={() => handleCreateDocument(selectedTemplateId)}
                className="inline-flex items-center gap-1 rounded-md bg-sf-accent px-2 py-1 text-[11px] font-medium text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('canvas.actions.new')}
              </button>
            </div>
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
            >
              <optgroup label={t('canvas.advancedFlows')}>
                {FLOW_ADVANCED_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>{t(`canvas.templates.${template.id}.label`, {}, template.label)}</option>
                ))}
              </optgroup>
            </select>
            <div className="mt-3 space-y-2">
              {flowProjectData.documents.map((document) => {
                const documentInfo = FLOW_AI_TEMPLATE_INFO[document.templateId]
                return (
                  <div
                    key={document.id}
                    className={`relative w-full rounded-lg border transition-colors ${
                      activeDocumentId === document.id
                        ? 'border-sf-accent bg-sf-accent/10 text-sf-text-primary'
                        : 'border-sf-dark-700 bg-sf-dark-900 text-sf-text-secondary hover:border-sf-dark-600 hover:bg-sf-dark-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveDocumentId(document.id)}
                      className={`w-full px-3 py-2 text-left ${documentInfo ? 'pr-10' : ''}`}
                    >
                      <div className="truncate text-sm font-medium">
                        {document.name}
                      </div>
                      <div className="mt-1 text-[11px] text-sf-text-muted">
                        {documentInfo?.presentation === 'recipe'
                          ? t('canvas.presetRecipe')
                          : t('canvas.nodeCount', { count: document.nodes.length })}
                      </div>
                    </button>
                    {documentInfo && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          setInformationDocumentId(document.id)
                        }}
                        className="absolute bottom-2 right-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-sf-dark-600 bg-sf-dark-950/80 text-sf-text-muted transition-colors hover:border-sf-accent hover:text-sf-text-primary"
                        title={`Information about ${documentInfo.title}`}
                        aria-label={`Information about ${documentInfo.title}`}
                      >
                        <Info className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={handleDuplicateDocument}
                className="flex-1 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-[11px] text-sf-text-secondary hover:bg-sf-dark-800"
              >
                {t('canvas.actions.duplicate')}
              </button>
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={flowProjectData.documents.length <= 1}
                className="flex-1 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-[11px] text-sf-text-secondary disabled:cursor-not-allowed disabled:opacity-40 hover:bg-sf-dark-800"
              >
                {t('canvas.actions.delete')}
              </button>
            </div>
          </section>

          {!activeDocumentIsRecipe && (
            <>
          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sf-text-muted">
              {t('canvas.nodePalette')}
            </div>
            <div className="space-y-2">
              {FLOW_AI_NODE_LIBRARY.map((entry) => {
                const Icon = getNodeIcon(entry.type)
                return (
                  <button
                    key={entry.type}
                    type="button"
                    onClick={() => handleAddNode(entry.type)}
                    className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-left transition-colors hover:border-sf-dark-600 hover:bg-sf-dark-800"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-sf-text-primary" />
                      <div className="font-medium text-sf-text-primary">
                        {t(`canvas.nodes.${entry.type}.label`, {}, entry.label)}
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-sf-text-muted">
                      {t(`canvas.nodes.${entry.type}.description`, {}, entry.description)}
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-sf-text-muted">
              {t('canvas.portKey')}
            </div>
            <div className="flex flex-wrap gap-2">
              {FLOW_PORT_LEGEND.map((portType) => {
                const portVisual = getFlowPortVisual(portType)
                return (
                  <span
                    key={portType}
                    className="inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-medium"
                    style={{
                      borderColor: portVisual.edge,
                      backgroundColor: portVisual.soft,
                      color: portVisual.color,
                    }}
                  >
                    {t(`canvas.portTypes.${portType}`, {}, portVisual.label)}
                  </span>
                )
              })}
            </div>
          </section>

            </>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className={recipeOnlyMode ? 'px-6 pt-4' : 'border-b border-sf-dark-800 px-4 py-3'}>
          <div className={`flex flex-wrap items-center gap-3 ${recipeOnlyMode ? 'mx-auto w-full max-w-6xl' : 'w-full'}`}>
          {recipeOnlyMode && (
            <button type="button" onClick={onExitRecipe} className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-secondary hover:text-sf-text-primary">
              <ChevronLeft className="h-4 w-4" />
              {templateRequest?.returnMode === 'backstage'
                ? t('canvas.actions.backToBackstage', {}, 'Back to Backstage')
                : t('canvas.actions.backToDirector', {}, 'Back to Director')}
            </button>
          )}
          <Wand2 className="h-4 w-4 text-sf-accent" />
          <input
            value={activeDocument?.name || ''}
            onChange={(event) => updateActiveDocument({ name: event.target.value || 'Flow' })}
            readOnly={recipeOnlyMode}
            className="min-w-0 flex-1 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none focus:border-sf-accent"
          />
          {!activeDocumentIsRecipe && (
            <>
              <button
                type="button"
                onClick={() => handleRun({ forceRunAll: true })}
                disabled={isRunning}
                className="inline-flex items-center gap-2 rounded-lg bg-sf-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {t('canvas.actions.runFlow')}
              </button>
              {activeDocumentCreatesLoraDataset && (
                <button
                  type="button"
                  onClick={() => setInformationDocumentId(activeDocument.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-sf-accent/45 bg-sf-accent/10 px-3 py-2 text-sm font-medium text-sf-text-primary hover:bg-sf-accent/20"
                >
                  <Sparkles className="h-4 w-4 text-sf-accent" />
                  {t('canvas.createLora')}
                </button>
              )}
              <button
                type="button"
                onClick={handleStopFlow}
                disabled={!isRunning}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isStopping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                {t('canvas.actions.stopFlow')}
              </button>
              <button
                type="button"
                onClick={() => selectedNodeId && handleRun({ targetNodeId: selectedNodeId })}
                disabled={!runnableSelection || isRunning}
                className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                {t('canvas.actions.runSelection')}
              </button>
            </>
          )}
          {activeDocumentIsRecipe && (
            <button
              type="button"
              onClick={() => setInformationDocumentId(activeDocument.id)}
              className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary"
            >
              <Info className="h-4 w-4" />
              {t('canvas.recipeInfo')}
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveNow}
            className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary"
          >
            <Save className="h-4 w-4" />
            {t('canvas.actions.save')}
          </button>
          <button
            type="button"
            onClick={handleReloadWorkspace}
            className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary hover:bg-sf-dark-800"
            title={t('canvas.actions.reloadHelp')}
          >
            <RefreshCw className="h-4 w-4" />
            {t('canvas.actions.reload')}
          </button>
          <button
            type="button"
            onClick={() => onOpenWorkflowSetup?.({
              workflowIds: executableWorkflowIds.filter((workflowId) => dependencyByWorkflow[workflowId]?.hasBlockingIssues),
            })}
            className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary"
          >
            <Settings2 className="h-4 w-4" />
            {t('canvas.actions.workflowSetup')}
          </button>
          </div>
        </div>

        <div ref={canvasViewportRef} className="relative min-h-0 flex-1">
          {activeDocumentIsRecipe ? (
            <LoraDatasetRecipeCanvas
              document={activeDocument}
              details={activeDocumentDetails}
              nodes={nodes}
              assetById={assetById}
              imageOptions={styleAssets}
              maskOptions={maskAssets}
              styleOptions={styleAssets}
              dependencyByWorkflow={dependencyByWorkflow}
              isRunning={isRunning}
              isExportingDataset={isExportingDataset}
              isStopping={isStopping}
              onRun={() => handleRun({ forceRunAll: true })}
              onStop={handleStopFlow}
              onUpdateNode={updateNodeData}
              onChooseAsset={handleChooseNodeProjectAsset}
              onPickAsset={(nodeId) => { void handlePickNodeImage(nodeId) }}
              onClearAsset={handleClearNodeProjectAsset}
              onPreviewAsset={setPreview}
              onOpenSetup={() => onOpenWorkflowSetup?.({
                workflowIds: executableWorkflowIds.filter((workflowId) => dependencyByWorkflow[workflowId]?.hasBlockingIssues),
              })}
              onOpenGuide={() => setInformationDocumentId(activeDocument.id)}
              activeAssetTargetNodeId={assetBrowserTargetNode?.id || ''}
              onSetAssetTarget={setRecipeAssetTargetNodeId}
              datasetPath={loraDatasetExportPath}
              datasetReady={['ready', 'existing'].includes(loraDatasetStatus)}
              isLaunchingFactory={isLaunchingFactory}
              factoryPreparation={loraFactoryPreparation}
              factoryLaunchError={loraFactoryLaunchError}
              onChooseDatasetOutput={() => { void handleChooseLoraDatasetOutput(activeDocument) }}
              onChooseExistingDataset={() => { void handleChooseExistingLoraDataset(activeDocument) }}
              onLaunchFactory={() => { void handleLaunchInstalledFactory(activeDocument) }}
              onOpenFactorySettings={() => onOpenSettings?.(
                loraFactoryLaunchError?.settingsSection || 'paths',
                { focusTarget: loraFactoryLaunchError?.focusTarget || 'lora-factories' }
              )}
            />
          ) : (
            <>
          {completionNotice && !isRunning && (
            <div className="pointer-events-none absolute right-4 top-4 z-20">
              <div className="pointer-events-auto flex max-w-[420px] items-start gap-3 rounded-2xl border border-sf-success/40 bg-sf-success/14 px-4 py-3 shadow-[0_18px_40px_rgba(0,0,0,0.38)] backdrop-blur">
                <div className="mt-0.5 rounded-full bg-sf-success/18 p-1.5 text-sf-success">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-sf-text-primary">
                    {completionNotice.title}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-sf-text-secondary">
                    {completionNotice.detail}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompletionNotice(null)}
                  className="rounded-md border border-sf-success/30 bg-sf-dark-950/35 p-1 text-sf-text-muted transition-colors hover:border-sf-success/50 hover:text-sf-text-primary"
                  aria-label={t('canvas.actions.dismissNotice')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
          {nodeContextMenu && nodeContextMenuTarget && nodeContextMenuRunnable && (
            <div
              ref={nodeContextMenuRef}
              className="fixed z-30 min-w-[190px] rounded-xl border border-sf-dark-700 bg-sf-dark-900/96 p-1 shadow-[0_18px_40px_rgba(0,0,0,0.42)] backdrop-blur"
              style={{
                left: nodeContextMenuPosition.x,
                top: nodeContextMenuPosition.y,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sf-text-muted">
                {nodeContextMenuTarget.data?.label || getFlowNodeDefinition(nodeContextMenuTarget.type)?.label || 'Node'}
              </div>
              <button
                type="button"
                onClick={handleRunNodeFromContextMenu}
                disabled={isRunning}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-sf-text-primary transition-colors hover:bg-sf-dark-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-sf-accent" />}
                {t('canvas.actions.runSelectedNode')}
              </button>
            </div>
          )}
          <FlowCanvasActionsContext.Provider value={flowCanvasActions}>
            <ReactFlow
              nodes={displayNodes}
              edges={displayEdges}
              viewport={viewport}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onConnectStart={handleConnectStart}
              onConnectEnd={handleConnectEnd}
              onNodeDragStart={handleNodeDragStart}
              onNodeDragStop={handleNodeDragStop}
              onSelectionChange={handleSelectionChange}
              isValidConnection={isValidFlowConnection}
              onNodeClick={(_, node) => {
                setNodeContextMenu(null)
                setSelectedNodeId(node.id)
              }}
              onNodeContextMenu={handleNodeContextMenu}
              onPaneClick={() => {
                setNodeContextMenu(null)
                setSelectedNodeId(null)
              }}
              onViewportChange={setViewport}
              deleteKeyCode={null}
              connectionLineStyle={connectionLineStyle}
              proOptions={FLOW_REACT_FLOW_PRO_OPTIONS}
              className="flow-ai-canvas bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.08),_transparent_35%),linear-gradient(180deg,#09090b_0%,#050507_100%)]"
            >
              <Background gap={28} size={1} color="rgba(255,255,255,0.06)" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                bgColor="rgba(9, 9, 11, 0.94)"
                maskColor="rgba(0, 0, 0, 0.5)"
                maskStrokeColor="rgba(96, 165, 250, 0.35)"
                maskStrokeWidth={1}
                nodeColor={minimapNodeColor}
                nodeStrokeColor={minimapNodeStrokeColor}
                nodeStrokeWidth={1}
                nodeBorderRadius={2}
                className="!bg-sf-dark-950/95 !border !border-sf-dark-700"
              />
            </ReactFlow>
          </FlowCanvasActionsContext.Provider>
            </>
          )}
        </div>

        <div
          className={`border-t px-4 py-2 text-xs ${
            completionNotice && !isRunning
              ? 'border-sf-success/30 bg-sf-success/10 text-sf-success'
              : 'border-sf-dark-800 text-sf-text-muted'
          }`}
        >
          {runNotice || t('canvas.status.default')}
        </div>
      </div>

      <div
        role="separator"
        aria-label={t('canvas.inspector.resize')}
        aria-orientation="vertical"
        aria-valuemin={FLOW_AI_INSPECTOR_MIN_WIDTH}
        aria-valuemax={clampFlowInspectorWidth(FLOW_AI_INSPECTOR_MAX_WIDTH, workspaceWidth)}
        aria-valuenow={effectiveInspectorWidth}
        tabIndex={0}
        onMouseDown={handleStartInspectorResize}
        onDoubleClick={handleResetInspectorWidth}
        onKeyDown={handleInspectorResizeKeyDown}
        className={`group relative flex w-3 flex-shrink-0 cursor-col-resize items-stretch justify-center transition-colors ${
          isInspectorResizing ? 'bg-sky-400/10' : 'bg-sf-dark-950/60 hover:bg-sf-dark-900'
        }`}
        title={t('canvas.inspector.resizeHelp')}
      >
        <div className={`absolute inset-y-0 w-px transition-colors ${
          isInspectorResizing ? 'bg-sky-400/80' : 'bg-sf-dark-700 group-hover:bg-sf-dark-500'
        }`} />
        <div className={`my-auto h-14 w-1.5 rounded-full border transition-colors ${
          isInspectorResizing
            ? 'border-sky-400/70 bg-sky-400/70'
            : 'border-sf-dark-700 bg-sf-dark-800 group-hover:border-sf-dark-500'
        }`} />
      </div>

      <div
        className="flex h-full min-h-0 flex-shrink-0 flex-col border-l border-sf-dark-800 bg-sf-dark-950/80"
        style={{ width: effectiveInspectorWidth, minWidth: FLOW_AI_INSPECTOR_MIN_WIDTH }}
      >
        <div className="flex-shrink-0 border-b border-sf-dark-800 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-sf-text-muted">
            {activeDocumentIsRecipe ? t('canvas.inspector.recipeAssets') : t('canvas.inspector.title')}
          </div>
          <div className="mt-2 text-sm text-sf-text-secondary">
            {activeDocumentIsRecipe
              ? t('canvas.inspector.recipeHelp')
              : selectedNode
                ? t('canvas.inspector.selectedHelp')
                : t('canvas.inspector.emptyHelp')}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          <section className="overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-900/70">
            <div className="flex items-center px-3 py-2.5">
              <button
                type="button"
                onClick={() => setIsAssetBrowserOpen((current) => !current)}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
                aria-expanded={isAssetBrowserOpen}
              >
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sf-text-secondary">
                    {t('canvas.assets.browser')}
                  </div>
                  <div className="mt-0.5 text-[10px] text-sf-text-muted">
                    {t('canvas.assets.counts', { assets: assets.length, folders: assetFolders.length })}
                  </div>
                </div>
                {isAssetBrowserOpen
                  ? <ChevronDown className="h-4 w-4 text-sf-text-muted" />
                  : <ChevronRight className="h-4 w-4 text-sf-text-muted" />}
              </button>
              <button
                type="button"
                onClick={(event) => { void handleRefreshAssetBrowser(event) }}
                disabled={isRefreshingAssetBrowser}
                className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sf-dark-700 bg-sf-dark-900 text-sf-text-muted transition-colors hover:border-sf-dark-500 hover:text-sf-text-primary disabled:cursor-wait disabled:opacity-60"
                title={t('canvas.assets.refreshHelp')}
                aria-label={t('canvas.assets.refresh')}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshingAssetBrowser ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {isAssetBrowserOpen && (
              <div className="space-y-2 border-t border-sf-dark-700 p-2.5">
                {activeDocumentIsRecipe && recipeAssetInputNodes.length > 0 && (
                  <InspectorRow label={t('canvas.assets.assignTo')}>
                    <select
                      value={assetBrowserTargetNode?.id || ''}
                      onChange={(event) => setRecipeAssetTargetNodeId(event.target.value)}
                      className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-950 px-3 py-2 text-[11px] text-sf-text-primary outline-none focus:border-sf-accent"
                    >
                      {recipeAssetInputNodes.map((node) => (
                        <option key={node.id} value={node.id}>{node?.data?.label || t('canvas.recipe.input')}</option>
                      ))}
                    </select>
                  </InspectorRow>
                )}
                <div className="flex min-w-0 items-center gap-1 text-[10px] text-sf-text-muted">
                  <button
                    type="button"
                    onClick={() => setAssetBrowserFolderId(null)}
                    className="rounded p-1 hover:bg-sf-dark-800 hover:text-sf-text-primary"
                    title={t('canvas.assets.root')}
                    aria-label={t('canvas.assets.openRoot')}
                  >
                    <Home className="h-3.5 w-3.5" />
                  </button>
                  {assetBrowserBreadcrumbs.map((folder) => (
                    <div key={folder.id} className="flex min-w-0 items-center gap-1">
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      <button
                        type="button"
                        onClick={() => setAssetBrowserFolderId(folder.id)}
                        className="max-w-28 truncate rounded px-1 py-0.5 hover:bg-sf-dark-800 hover:text-sf-text-primary"
                        title={folder.name}
                      >
                        {folder.name}
                      </button>
                    </div>
                  ))}
                </div>

                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sf-text-muted" />
                  <input
                    value={assetBrowserSearch}
                    onChange={(event) => setAssetBrowserSearch(event.target.value)}
                    placeholder={t('canvas.assets.search')}
                    className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-950 py-2 pl-8 pr-2 text-[11px] text-sf-text-primary outline-none focus:border-sf-accent"
                  />
                </label>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                  {assetBrowserFolders.length > 0 && (
                    <div className="space-y-1">
                      {assetBrowserFolders.map((folder) => {
                        const directAssetCount = assets.filter((asset) => (asset.folderId || null) === folder.id).length
                        const childFolderCount = assetFolders.filter((candidate) => (candidate.parentId || null) === folder.id).length
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            onClick={() => setAssetBrowserFolderId(folder.id)}
                            className="flex w-full items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-950/70 px-2.5 py-2 text-left transition-colors hover:border-sf-dark-500 hover:bg-sf-dark-800"
                          >
                            <FolderOpen className="h-4 w-4 shrink-0 text-sf-accent" />
                            <span className="min-w-0 flex-1 truncate text-[11px] text-sf-text-primary">{folder.name}</span>
                            <span className="text-[9px] text-sf-text-muted">{directAssetCount + childFolderCount}</span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-sf-text-muted" />
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {assetBrowserAssets.length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {assetBrowserAssets.map((asset) => {
                        const canAssignToSelectedNode = doesFlowAssetInputAcceptAsset(assetBrowserTargetNode, asset)
                        const posterUrl = asset.type === 'image' || asset.type === 'mask' ? asset.url : asset.poster?.url
                        const AssetIcon = asset.type === 'video' ? Film : asset.type === 'audio' ? Music : ImageIcon
                        const isPreviewing = currentPreviewAsset?.id === asset.id
                        const isAssigned = assetBrowserTargetNode?.data?.assetId === asset.id
                        return (
                          <div
                            key={asset.id}
                            onContextMenu={(event) => void handleRevealAssetInFileManager(event, asset)}
                            className={`overflow-hidden rounded-lg border bg-sf-dark-950/80 ${
                              isPreviewing ? 'border-sf-accent ring-1 ring-sf-accent/30' : 'border-sf-dark-700'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setPreview(asset)
                                if (canAssignToSelectedNode) {
                                  handleChooseNodeProjectAsset(assetBrowserTargetNode.id, asset.id)
                                }
                              }}
                              onDoubleClick={asset.type === 'image' || asset.type === 'mask' ? () => setOriginalImageAsset(asset) : undefined}
                              className="block w-full text-left"
                              title={asset.type === 'image'
                                ? `${canAssignToSelectedNode ? `Use in ${assetBrowserTargetNode?.data?.label || 'selected input'}. ` : ''}Double-click to view original size. Right-click to reveal in File Explorer.`
                                : `Preview ${asset.name || asset.id}. Right-click to reveal in File Explorer.`}
                            >
                              <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-sf-dark-800">
                                {posterUrl ? (
                                  <img src={posterUrl} alt="" className="h-full w-full object-contain" />
                                ) : (
                                  <AssetIcon className="h-5 w-5 text-sf-text-muted" />
                                )}
                                <span className="absolute left-1 top-1 rounded bg-black/65 px-1 py-0.5 text-[8px] uppercase text-white/85">
                                  {asset.type}
                                </span>
                              </div>
                              <div className="truncate px-2 py-1.5 text-[10px] text-sf-text-primary">
                                {asset.name || asset.path || asset.id}
                              </div>
                            </button>
                            {canAssignToSelectedNode && (
                              <button
                                type="button"
                                onClick={() => handleChooseNodeProjectAsset(assetBrowserTargetNode.id, asset.id)}
                                disabled={isAssigned}
                                className="w-full border-t border-sf-dark-700 px-2 py-1.5 text-[9px] font-medium text-emerald-200 transition-colors hover:bg-emerald-500/10 disabled:text-sf-text-muted"
                              >
                                {isAssigned
                                  ? t('canvas.assets.usingInRecipe')
                                  : t('canvas.assets.useIn', { target: assetBrowserTargetNode?.data?.label || t('canvas.recipe.input') })}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {assetBrowserFolders.length === 0 && assetBrowserAssets.length === 0 && (
                    <div className="rounded-lg border border-dashed border-sf-dark-700 px-3 py-5 text-center text-[11px] text-sf-text-muted">
                      {assetBrowserSearch.trim() ? t('canvas.assets.noSearchResults') : t('canvas.assets.folderEmpty')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-900/70">
            <div className="flex items-center px-3 py-2.5">
              <button
                type="button"
                onClick={() => setIsProcessConsoleOpen((current) => !current)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                aria-expanded={isProcessConsoleOpen}
              >
                <span className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                  isRunning || isLaunchingFactory || isFactoryProcessRunning
                    ? 'border-emerald-400/45 bg-emerald-500/12 text-emerald-300'
                    : 'border-sf-dark-700 bg-sf-dark-950 text-sf-text-muted'
                }`}>
                  <Terminal className="h-3.5 w-3.5" />
                  {(isRunning || isLaunchingFactory || isFactoryProcessRunning) && (
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-sf-dark-900 bg-emerald-400" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-sf-text-secondary">
                    {t('canvas.console.title')}
                  </div>
                  <div className={`mt-0.5 text-[10px] ${
                    isRunning || isLaunchingFactory || isFactoryProcessRunning ? 'text-emerald-300' : 'text-sf-text-muted'
                  }`}>
                    {isRunning
                      ? t('canvas.console.processing')
                      : isLaunchingFactory
                        ? t('canvas.console.preparingFactory')
                        : isFactoryProcessRunning
                          ? t('canvas.console.factoryRunning')
                          : t('canvas.console.lineCount', { count: processConsoleEntries.length })}
                  </div>
                </div>
                {isProcessConsoleOpen
                  ? <ChevronDown className="h-4 w-4 shrink-0 text-sf-text-muted" />
                  : <ChevronRight className="h-4 w-4 shrink-0 text-sf-text-muted" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  const text = processConsoleEntries
                    .map((entry) => `[${entry.timestamp}] [${entry.source}] ${entry.message}`)
                    .join('\n')
                  if (text) void navigator.clipboard?.writeText(text)
                }}
                disabled={processConsoleEntries.length === 0}
                className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sf-dark-700 bg-sf-dark-950 text-sf-text-muted transition-colors hover:border-sf-dark-500 hover:text-sf-text-primary disabled:cursor-not-allowed disabled:opacity-35"
                title={t('canvas.console.copy')}
                aria-label={t('canvas.console.copy')}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setProcessConsoleEntries([])}
                disabled={processConsoleEntries.length === 0}
                className="ml-1.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sf-dark-700 bg-sf-dark-950 text-sf-text-muted transition-colors hover:border-red-500/45 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
                title={t('canvas.console.clear')}
                aria-label={t('canvas.console.clear')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {isProcessConsoleOpen && (
              <div className="border-t border-sf-dark-700 bg-[#05070a]">
                <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-[9px] uppercase tracking-[0.13em] text-sf-text-muted">
                  <span>{t('canvas.console.liveOutput')}</span>
                  <span>{isRunning || isLaunchingFactory || isFactoryProcessRunning ? t('canvas.console.running') : t('canvas.console.idle')}</span>
                </div>
                <div className="h-72 overflow-y-auto overscroll-contain px-3 py-2 font-mono text-[10px] leading-[1.55]">
                  {processConsoleEntries.length === 0 ? (
                    <div className="py-6 text-center font-sans text-[11px] leading-5 text-sf-text-muted">
                      {t('canvas.console.empty')}
                    </div>
                  ) : processConsoleEntries.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-[52px_minmax(0,1fr)] gap-2 border-b border-white/[0.025] py-0.5">
                      <span className="select-none text-slate-600">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <div className="min-w-0 break-words">
                        <span className={`mr-1.5 font-semibold ${
                          entry.level === 'error'
                            ? 'text-red-400'
                            : entry.level === 'warning'
                              ? 'text-amber-300'
                              : entry.level === 'success'
                                ? 'text-emerald-300'
                                : 'text-cyan-300'
                        }`}>
                          [{entry.source}]
                        </span>
                        <span className={entry.level === 'error' ? 'text-red-200' : 'text-slate-300'}>{entry.message}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={processConsoleEndRef} />
                </div>
              </div>
            )}
          </section>

          {!activeDocumentIsRecipe && !selectedNode && (
            <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-4 text-sm text-sf-text-muted">
              {t('canvas.inspector.pickNode')}
            </div>
          )}

          {!activeDocumentIsRecipe && selectedNode && (
            <>
              <InspectorRow label={t('canvas.fields.label')}>
                <input
                  value={selectedNode.data.label || ''}
                  onChange={(event) => updateNodeData(selectedNode.id, { label: event.target.value })}
                  className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                />
              </InspectorRow>

              {selectedNode.type === FLOW_AI_NODE_TYPES.prompt && (
                <>
                  <InspectorRow label={t('canvas.fields.promptText')}>
                    <textarea
                      rows={7}
                      value={selectedNode.data.promptText || ''}
                      onChange={(event) => updateNodeData(selectedNode.id, { promptText: event.target.value })}
                      className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                    />
                  </InspectorRow>
                </>
              )}

              {selectedNode.type === FLOW_AI_NODE_TYPES.textViewer && (
                <>
                  <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-3 text-sm text-sf-text-secondary">
                    {t('canvas.inspector.textViewerHelp')}
                  </div>
                  <InspectorRow label={t('canvas.fields.resolvedText')}>
                    <textarea
                      rows={12}
                      readOnly
                      value={selectedNodeResolvedText}
                      placeholder={t('canvas.nodeMessages.connectText')}
                      className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                    />
                  </InspectorRow>
                  <button
                    type="button"
                    disabled={!selectedNodeResolvedText}
                    onClick={() => {
                      if (!selectedNodeResolvedText) return
                      void navigator.clipboard?.writeText(selectedNodeResolvedText)
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Copy className="h-4 w-4" />
                    {t('canvas.actions.copyText')}
                  </button>
                </>
              )}

              {(selectedNode.type === FLOW_AI_NODE_TYPES.imageInput || selectedNode.type === FLOW_AI_NODE_TYPES.styleReference) && (
                <>
                  <InspectorRow label={t('canvas.fields.projectAsset')}>
                    <select
                      value={selectedNode.data.assetId || ''}
                      onChange={(event) => {
                        if (!event.target.value) {
                          handleClearNodeProjectAsset(selectedNode.id)
                          return
                        }
                        handleChooseNodeProjectAsset(selectedNode.id, event.target.value)
                      }}
                      className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                    >
                      <option value="">{t('canvas.assets.selectOne')}</option>
                      {(selectedNode.type === FLOW_AI_NODE_TYPES.styleReference
                        ? styleAssets
                        : selectedNode.data.assetRole === 'mask'
                          ? maskAssets
                          : imageInputAssets).map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </InspectorRow>
                  <button
                    type="button"
                    onClick={() => { void handlePickNodeImage(selectedNode.id) }}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/15"
                  >
                    <FolderOpen className="h-4 w-4" />
                    {selectedNode.data.assetId ? t('canvas.assets.replaceFromFile') : t('canvas.assets.loadFromFile')}
                  </button>
                  {selectedNode.data.assetId && (
                    <button
                      type="button"
                      onClick={() => handleClearNodeProjectAsset(selectedNode.id)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition-colors hover:border-red-400/55 hover:bg-red-500/15"
                    >
                      <X className="h-4 w-4" />
                      {t('canvas.assets.clearAssigned')}
                    </button>
                  )}
                  {selectedNode.type === FLOW_AI_NODE_TYPES.imageInput && (
                    <InspectorRow label={t('canvas.fields.videoFrameTime')}>
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        value={selectedNode.data.frameTime ?? 0}
                        onChange={(event) => updateNodeData(selectedNode.id, { frameTime: Number(event.target.value) || 0 })}
                        className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                      />
                    </InspectorRow>
                  )}
                </>
              )}

              {getFlowNodeSupportsExecution(selectedNode.type) && (
                <>
                  {selectedNode.data.optionalStage === 'inpaint' && (
                    <div className={`rounded-xl border p-3 ${
                      selectedNode.data.enabled === true
                        ? 'border-emerald-500/35 bg-emerald-500/10'
                        : 'border-sf-dark-700 bg-sf-dark-900/70'
                    }`}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.enabled === true}
                          onChange={(event) => updateNodeData(selectedNode.id, {
                            enabled: event.target.checked,
                            dependencyStatus: 'unknown',
                            dependencySummary: '',
                            outputAssetIds: [],
                            status: 'idle',
                            statusMessage: event.target.checked
                              ? t('canvas.recipe.inpaintOnStatus')
                              : t('canvas.recipe.inpaintOffStatus'),
                          })}
                          className="mt-0.5 h-4 w-4 rounded border-sf-dark-600 bg-sf-dark-950 text-emerald-500"
                        />
                        <span>
                          <span className="block text-sm font-medium text-sf-text-primary">{t('canvas.recipe.useMaskedInpaint')}</span>
                          <span className="mt-1 block text-xs leading-5 text-sf-text-muted">
                            {t('canvas.recipe.useMaskedInpaintHelp')}
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                  <InspectorRow label={t('canvas.fields.workflow')}>
                    <select
                      value={selectedNode.data.workflowId || ''}
                      onChange={(event) => updateNodeData(selectedNode.id, {
                        workflowId: event.target.value,
                        dependencyStatus: 'unknown',
                        dependencySummary: '',
                        ...(selectedNode.type === FLOW_AI_NODE_TYPES.imageGen
                          ? { variantCount: normalizeFlowImageVariantCount(selectedNode.data.variantCount, event.target.value) }
                          : {}),
                        ...(selectedNode.type === FLOW_AI_NODE_TYPES.videoGen && event.target.value === 'minimax-h3-gguf-i2v'
                          ? { width: 608, height: 352, duration: 5, fps: 24 }
                          : {}),
                      })}
                      className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                    >
                      {renderWorkflowOptions(selectedNode.type).map((workflow) => (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.label}
                        </option>
                      ))}
                    </select>
                  </InspectorRow>

                  {selectedNodeWorkflowSummary && (
                    <div className={`rounded-xl border px-3 py-3 text-sm ${
                      selectedNodeWorkflowSummary.runtime === 'cloud'
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
                    }`}>
                      <div className="font-medium">
                        {selectedNodeWorkflowSummary.label}
                      </div>
                      <div className="mt-1 text-[12px] opacity-90">
                        {selectedNodeWorkflowSummary.runtime === 'cloud'
                          ? t('canvas.inspector.cloudRuntime')
                          : t('canvas.inspector.localRuntime')}
                      </div>
                    </div>
                  )}

                  {selectedNodeDependency && (
                    <div className={`rounded-xl border px-3 py-3 text-sm ${
                      selectedNodeDependency.hasBlockingIssues
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-100'
                        : selectedNodeDependency.status === 'ready'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                          : 'border-sf-dark-700 bg-sf-dark-900 text-sf-text-secondary'
                    }`}>
                      <div className="flex items-center gap-2 font-medium">
                        {selectedNodeDependency.hasBlockingIssues ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        {t('canvas.inspector.workflowReadiness')}
                      </div>
                      <div className="mt-2 text-[12px]">
                        {selectedNode.data.dependencySummary || t('canvas.checking')}
                      </div>
                      {selectedNodeDependency.hasBlockingIssues && (
                        <button
                          type="button"
                          onClick={() => onOpenWorkflowSetup?.({ workflowIds: [selectedNode.data.workflowId] })}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-black/20 px-3 py-2 text-[12px] font-medium text-amber-100"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          {t('canvas.actions.openWorkflowSetup')}
                        </button>
                      )}
                    </div>
                  )}

                  {selectedNode.type === FLOW_AI_NODE_TYPES.promptAssist && (
                    <>
                      <InspectorRow label={selectedNode.data.workflowId === 'minimax-h3-media-promptor' ? t('canvas.fields.creativeDirection') : t('canvas.fields.inlineBrief')}>
                        <textarea
                          rows={5}
                          value={selectedNode.data.inlinePrompt || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, { inlinePrompt: event.target.value })}
                          placeholder={selectedNode.data.workflowId === 'minimax-h3-media-promptor'
                            ? t('canvas.placeholders.creativeDirection')
                            : t('canvas.placeholders.connectedPrompt')}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>
                      {selectedNode.data.workflowId !== 'minimax-h3-media-promptor' && <InspectorRow label={t('canvas.fields.systemPromptOverride')}>
                        <textarea
                          rows={5}
                          value={selectedNode.data.systemPrompt || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, { systemPrompt: event.target.value })}
                          placeholder={t('canvas.placeholders.geminiDefault')}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>}
                      {selectedNode.data.workflowId === 'minimax-h3-media-promptor' ? (
                        <>
                          <InspectorRow label={t('canvas.fields.targetDuration')}>
                            <input
                              type="number"
                              min="4"
                              max="15"
                              step="0.5"
                              value={selectedNode.data.duration ?? 15}
                              onChange={(event) => updateNodeData(selectedNode.id, { duration: Math.max(4, Math.min(15, Number(event.target.value) || 15)) })}
                              className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                            />
                          </InspectorRow>
                          <InspectorRow label={t('canvas.fields.outputLanguage')}>
                            <select
                              value={selectedNode.data.outputLanguage || 'English'}
                              onChange={(event) => updateNodeData(selectedNode.id, { outputLanguage: event.target.value })}
                              className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                            >
                              <option value="English">{t('canvas.options.english')}</option>
                              <option value="Chinese">{t('canvas.options.chinese')}</option>
                            </select>
                          </InspectorRow>
                          <InspectorRow label={t('canvas.fields.imageAnalysis')}>
                            <select
                              value={selectedNode.data.imageAnalysisMode || 'Comprehensive'}
                              onChange={(event) => updateNodeData(selectedNode.id, { imageAnalysisMode: event.target.value })}
                              className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                            >
                              {['Comprehensive', 'Subject / Identity', 'Action / Emotion', 'Face & Expression Focus', 'Prop & Object Interaction', 'Lighting & Camera', 'Cinematic Composition', 'Style & Aesthetics', 'Color Palette & Texture'].map((mode) => <option key={mode} value={mode}>{t(`canvas.analysisModes.${CANVAS_ANALYSIS_MODE_KEYS[mode]}`, {}, mode)}</option>)}
                            </select>
                          </InspectorRow>
                          <InspectorRow label={t('canvas.fields.videoAnalysis')}>
                            <select
                              value={selectedNode.data.videoAnalysisMode || 'Comprehensive'}
                              onChange={(event) => updateNodeData(selectedNode.id, { videoAnalysisMode: event.target.value })}
                              className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                            >
                              {['Comprehensive', 'Motion Focus', 'Camera Tracking', 'Temporal Flow', 'Physics & Momentum', 'Background Dynamics'].map((mode) => <option key={mode} value={mode}>{t(`canvas.analysisModes.${CANVAS_ANALYSIS_MODE_KEYS[mode]}`, {}, mode)}</option>)}
                            </select>
                          </InspectorRow>
                        </>
                      ) : <><InspectorRow label={t('canvas.fields.referenceFrameTime')}>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={selectedNode.data.frameTime ?? 0}
                          onChange={(event) => updateNodeData(selectedNode.id, { frameTime: Number(event.target.value) || 0 })}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>
                      <InspectorRow label={t('canvas.fields.seed')}>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={selectedNode.data.seed ?? 0}
                            onChange={(event) => updateNodeData(selectedNode.id, { seed: Number(event.target.value) || 0 })}
                            className="min-w-0 flex-1 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateNodeData(selectedNode.id, { seed: Math.floor(Math.random() * 1000000) })}
                            className="rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-secondary"
                          >
                            Random
                          </button>
                        </div>
                      </InspectorRow></>}
                      <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-3 text-sm text-sf-text-secondary">
                        {selectedNode.data.workflowId === 'minimax-h3-media-promptor'
                          ? t('canvas.inspector.mediaPromptorHelp')
                          : t('canvas.inspector.promptAssistHelp')}
                      </div>
                      <InspectorRow label={t('canvas.fields.latestOutput')}>
                        <textarea
                          rows={8}
                          readOnly
                          value={selectedNode.data.outputText || ''}
                          placeholder={t('canvas.placeholders.runForText')}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-secondary outline-none"
                        />
                      </InspectorRow>
                    </>
                  )}

                  {(selectedNode.type === FLOW_AI_NODE_TYPES.imageGen || selectedNode.type === FLOW_AI_NODE_TYPES.videoGen) && (
                    <>
                      <InspectorRow label={t('canvas.fields.inlinePromptOverride')}>
                        <textarea
                          rows={4}
                          value={selectedNode.data.inlinePrompt || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, { inlinePrompt: event.target.value })}
                          placeholder={t('canvas.placeholders.connectedPrompt')}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>
                      <InspectorRow label={t('canvas.fields.negativePrompt')}>
                        <textarea
                          rows={3}
                          value={selectedNode.data.negativePrompt || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, { negativePrompt: event.target.value })}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>
                      {!selectedNode.data.preserveInputResolution && (
                      <div className="grid grid-cols-2 gap-3">
                        <InspectorRow label={t('canvas.fields.width')}>
                          <input
                            type="number"
                            min="256"
                            step="64"
                            value={selectedNode.data.width ?? 1280}
                            onChange={(event) => updateNodeData(selectedNode.id, { width: Number(event.target.value) || 1280 })}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                        </InspectorRow>
                        <InspectorRow label={t('canvas.fields.height')}>
                          <input
                            type="number"
                            min="256"
                            step="64"
                            value={selectedNode.data.height ?? 720}
                            onChange={(event) => updateNodeData(selectedNode.id, { height: Number(event.target.value) || 720 })}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                        </InspectorRow>
                      </div>
                      )}
                      {selectedNode.data.preserveInputResolution && (
                        <div className="rounded-lg border border-sf-dark-700 bg-sf-dark-900/70 px-3 py-2 text-xs text-sf-text-muted">
                          Output resolution follows the character source image so the mask stays aligned.
                        </div>
                      )}
                      <InspectorRow label={t('canvas.fields.seed')}>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={selectedNode.data.seed ?? 0}
                            onChange={(event) => updateNodeData(selectedNode.id, { seed: Number(event.target.value) || 0 })}
                            className="min-w-0 flex-1 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateNodeData(selectedNode.id, { seed: Math.floor(Math.random() * 1000000) })}
                            className="rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-secondary"
                          >
                            Random
                          </button>
                        </div>
                      </InspectorRow>
                      {selectedNode.type === FLOW_AI_NODE_TYPES.imageGen && selectedImageVariantBehavior?.mode !== 'fixed' && (
                        <InspectorRow label={t('canvas.fields.variants')}>
                          <input
                            type="number"
                            min="1"
                            max={selectedImageVariantBehavior?.max || 10}
                            value={selectedImageVariantCount}
                            onChange={(event) => updateNodeData(selectedNode.id, {
                              variantCount: normalizeFlowImageVariantCount(event.target.value, selectedNode.data.workflowId),
                            })}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                        </InspectorRow>
                      )}
                      {selectedNode.type === FLOW_AI_NODE_TYPES.imageGen && (
                        <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-3 text-sm text-sf-text-secondary">
                          {getImageVariantInspectorNote(selectedNode.data.workflowId, selectedNode.data.variantCount)}
                        </div>
                      )}
                      {selectedNode.type === FLOW_AI_NODE_TYPES.imageGen && selectedNode.data.workflowId === 'minimax-h3-character-sheet' && (
                        <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm text-violet-100">
                          Four-panel MiniMax H3 Ref2VA GGUF workflow. Connect one primary character and up to two optional references through the Style ports. The 480 x 864 default reduces resolution while retaining H3's supported 124-frame duration, and only the assembled sheet is saved. It reuses the H3 GGUF encoder, mmproj, and VAEs; the additional Ref2VA Q4 model is about 11.4 GB. Model weights use the MiniMax H3 Community License. Adapted from the H3 Character Sheet Generator workflow.
                        </div>
                      )}
                    </>
                  )}

                  {selectedNode.type === FLOW_AI_NODE_TYPES.videoGen && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <InspectorRow label={t('canvas.fields.duration')}>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={selectedNode.data.duration ?? 5}
                            onChange={(event) => updateNodeData(selectedNode.id, { duration: Number(event.target.value) || 5 })}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                        </InspectorRow>
                        <InspectorRow label={t('canvas.fields.fps')}>
                          <select
                            value={selectedNode.data.fps ?? 24}
                            onChange={(event) => updateNodeData(selectedNode.id, { fps: Number(event.target.value) || 24 })}
                            disabled={selectedNode.data.workflowId === 'minimax-h3-gguf-i2v'}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          >
                            <option value={16}>16 fps</option>
                            <option value={24}>24 fps</option>
                            <option value={30}>30 fps</option>
                          </select>
                        </InspectorRow>
                      </div>
                      {selectedNode.data.workflowId === 'wan22-i2v' && (
                        <InspectorRow label={t('canvas.fields.wanQuality')}>
                          <select
                            value={selectedNode.data.wanQualityPreset || 'balanced'}
                            onChange={(event) => updateNodeData(selectedNode.id, { wanQualityPreset: event.target.value })}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          >
                            <option value="face-lock">{t('canvas.options.faceLock')}</option>
                            <option value="balanced">{t('canvas.options.balanced')}</option>
                          </select>
                        </InspectorRow>
                      )}
                      {selectedNode.data.workflowId === 'minimax-h3-gguf-i2v' && (
                        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
                          MiniMax H3 is fixed at 24 fps. Connect the optional Last Frame port to constrain the ending image. The 608 x 352, 5-second default is a low-resource first test; raise resolution only after it runs successfully. The model weights use the MiniMax H3 Community License.
                        </div>
                      )}
                      <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-3 text-sm text-sf-text-secondary">
                        Video Gen currently outputs one final video per run. Multi-video bundles can come later.
                      </div>
                    </>
                  )}

                  {selectedNode.type === FLOW_AI_NODE_TYPES.videoUpscale && (
                    <>
                      <InspectorRow label={t('canvas.fields.topazModel')}>
                        <select
                          value={selectedNode.data.upscaleModel || TOPAZ_VIDEO_UPSCALE_MODEL_OPTIONS[0]?.id || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, {
                            upscaleModel: event.target.value,
                            estimatedCredits: null,
                            estimatedCreditsSource: null,
                          })}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        >
                          {TOPAZ_VIDEO_UPSCALE_MODEL_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </InspectorRow>
                      <InspectorRow label={t('canvas.fields.targetResolution')}>
                        <select
                          value={selectedNode.data.targetResolution || TOPAZ_VIDEO_UPSCALE_RESOLUTION_OPTIONS[0]?.id || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, {
                            targetResolution: event.target.value,
                            estimatedCredits: null,
                            estimatedCreditsSource: null,
                          })}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        >
                          {TOPAZ_VIDEO_UPSCALE_RESOLUTION_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </InspectorRow>
                      <InspectorRow label={t('canvas.fields.upscaleCreativity')}>
                        <select
                          value={selectedNode.data.upscaleCreativity || TOPAZ_VIDEO_UPSCALE_CREATIVITY_OPTIONS[0]?.id || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, {
                            upscaleCreativity: event.target.value,
                            estimatedCredits: null,
                            estimatedCreditsSource: null,
                          })}
                          disabled={!topazVideoUpscaleModelSupportsCreativity(selectedNode.data.upscaleModel)}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none disabled:opacity-50"
                        >
                          {TOPAZ_VIDEO_UPSCALE_CREATIVITY_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </InspectorRow>
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[11px] font-medium uppercase tracking-wide text-amber-200/80">
                              {t('canvas.inspector.estimatedCost')}
                            </div>
                            <div className="mt-1 font-medium text-amber-100">
                              {selectedNodeGuideCreditsLabel}
                            </div>
                          </div>
                          <div className="rounded-full border border-amber-400/20 bg-black/20 px-2.5 py-1 text-[10px] font-medium text-amber-200">
                            {t('canvas.inspector.pricingGuide')}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-amber-100/75">
                          {t('canvas.inspector.pricingHelp')}
                        </div>
                        {selectedNodeLiveCreditsLabel && (
                          <div className="mt-3 rounded-lg border border-amber-400/15 bg-black/15 px-3 py-2 text-xs text-amber-100/85">
                            {t('canvas.inspector.currentEstimate')}: {selectedNodeLiveCreditsLabel}
                          </div>
                        )}
                      </div>
                      <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-3 text-sm text-sf-text-secondary">
                        {t('canvas.inspector.upscaleHelp')}
                      </div>
                    </>
                  )}

                  {selectedNode.type === FLOW_AI_NODE_TYPES.musicGen && (
                    <>
                      <InspectorRow label={t('canvas.fields.musicTags')}>
                        <textarea
                          rows={3}
                          value={selectedNode.data.tags || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, { tags: event.target.value })}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>
                      <InspectorRow label={t('canvas.fields.inlineLyrics')}>
                        <textarea
                          rows={4}
                          value={selectedNode.data.lyrics || ''}
                          onChange={(event) => updateNodeData(selectedNode.id, { lyrics: event.target.value })}
                          placeholder={t('canvas.placeholders.connectedPrompt')}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>
                      <div className="grid grid-cols-2 gap-3">
                        <InspectorRow label={t('canvas.fields.duration')}>
                          <input
                            type="number"
                            min="2"
                            step="1"
                            value={selectedNode.data.duration ?? 8}
                            onChange={(event) => updateNodeData(selectedNode.id, { duration: Number(event.target.value) || 8 })}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                        </InspectorRow>
                        <InspectorRow label={t('canvas.fields.bpm')}>
                          <input
                            type="number"
                            min="60"
                            step="1"
                            value={selectedNode.data.bpm ?? 120}
                            onChange={(event) => updateNodeData(selectedNode.id, { bpm: Number(event.target.value) || 120 })}
                            className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                        </InspectorRow>
                      </div>
                      <InspectorRow label={t('canvas.fields.keyScale')}>
                        <input
                          value={selectedNode.data.keyscale || 'C Major'}
                          onChange={(event) => updateNodeData(selectedNode.id, { keyscale: event.target.value })}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                        />
                      </InspectorRow>
                      <InspectorRow label={t('canvas.fields.seed')}>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={selectedNode.data.seed ?? 0}
                            onChange={(event) => updateNodeData(selectedNode.id, { seed: Number(event.target.value) || 0 })}
                            className="min-w-0 flex-1 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateNodeData(selectedNode.id, { seed: Math.floor(Math.random() * 1000000) })}
                            className="rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-secondary"
                          >
                            {t('canvas.actions.random')}
                          </button>
                        </div>
                      </InspectorRow>
                    </>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRun({ targetNodeId: selectedNode.id })}
                      disabled={isRunning}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-sf-accent px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      {t('canvas.actions.runNode')}
                    </button>
                  </div>
                </>
              )}

              {selectedNode.type === FLOW_AI_NODE_TYPES.output && (
                <>
                  <InspectorRow label={t('canvas.fields.assetFolder')}>
                    <input
                      value={selectedNode.data.folderName || ''}
                      onChange={(event) => updateNodeData(selectedNode.id, { folderName: event.target.value })}
                      placeholder={t('canvas.placeholders.shots')}
                      className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary outline-none"
                    />
                  </InspectorRow>
                  <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-3 text-sm text-sf-text-secondary">
                    <div>{t('canvas.inspector.connectedResults')}</div>
                    <div className="mt-1 font-medium text-sf-text-primary break-words">
                      {formatAssetOutputDestinationSummary(selectedNode.data.folderName)}
                    </div>
                    {!String(selectedNode.data.folderName || '').trim() && (
                      <div className="mt-2 text-xs text-sf-text-muted">
                        {t('canvas.inspector.blankFolderHelp')}
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-3 text-sm text-sf-text-secondary">
                    {t('canvas.inspector.assetOutputHelp')}
                  </div>
                  <div className="space-y-2">
                    {(selectedNode.data.resolvedAssetIds || []).length === 0 && (
                      <div className="rounded-lg border border-sf-dark-800 bg-sf-dark-900/70 px-3 py-3 text-sm text-sf-text-muted">
                        {t('canvas.inspector.noConnectedAssets')}
                      </div>
                    )}
                    {(selectedNode.data.resolvedAssetIds || []).map((assetId) => {
                      const asset = assets.find((entry) => entry.id === assetId)
                      if (!asset) return null
                      return (
                        <button
                          key={assetId}
                          type="button"
                          onClick={() => setPreview(asset)}
                          className="w-full rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-left hover:bg-sf-dark-800"
                        >
                          <div className="truncate text-sm font-medium text-sf-text-primary">
                            {asset.name}
                          </div>
                          <div className="mt-1 text-[11px] text-sf-text-muted">
                            {asset.type}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    duplicateFlowNodes([selectedNode.id])
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary"
                >
                  <Copy className="h-4 w-4" />
                  {t('canvas.actions.duplicate')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteFlowSelection()
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200"
                >
                  <X className="h-4 w-4" />
                  {t('canvas.actions.delete')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {informationDocument && informationDetails && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm"
          onMouseDown={() => setInformationDocumentId(null)}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="canvas-information-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[calc(100vh-3rem)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-sf-dark-700 bg-sf-dark-950 p-5 shadow-[0_28px_80px_rgba(0,0,0,0.6)]"
          >
            <div className="flex items-start gap-4">
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sf-accent/40 bg-sf-accent/10 text-sf-accent">
                <Info className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="canvas-information-title" className="text-base font-semibold text-sf-text-primary">
                  {t(`canvas.information.documents.${informationDocument.templateId}.title`, {}, informationDetails.title)}
                </h2>
                <div className="mt-1 text-xs text-sf-text-muted">
                  {t('canvas.information.document')}: {informationDocument.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInformationDocumentId(null)}
                className="rounded-lg border border-sf-dark-700 p-1.5 text-sf-text-muted hover:bg-sf-dark-800 hover:text-sf-text-primary"
                aria-label={t('canvas.actions.closeInformation')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-4 text-sm">
              <div className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 rounded-xl border border-sf-dark-800 bg-sf-dark-900/70 p-4">
                <div className="text-sf-text-muted">{t('canvas.information.author')}</div>
                <div className="text-sf-text-primary">{informationDetails.author}</div>
                <div className="text-sf-text-muted">{t('canvas.information.license')}</div>
                <div className="text-sf-text-primary">{informationDetails.license}</div>
              </div>
              <p className="leading-6 text-sf-text-secondary">
                {t(`canvas.information.documents.${informationDocument.templateId}.description`, {}, informationDetails.description)}
              </p>
              {informationDetails.notice && (
                <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100/90">
                  {t(`canvas.information.documents.${informationDocument.templateId}.notice`, {}, informationDetails.notice)}
                </div>
              )}
              {informationDetails.datasetExport && (
                <div className="space-y-3 rounded-xl border border-sky-500/25 bg-sky-500/10 p-4 text-xs leading-5 text-sky-100/90">
                  <div className="text-sm font-semibold text-sky-100">{t('canvas.information.threeSteps')}</div>
                  <div className="grid grid-cols-[24px_1fr] gap-x-3 gap-y-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/20 font-semibold text-sky-100">1</div>
                    <div>
                      <div className="font-medium text-sf-text-primary">{t('canvas.information.step1Title')}</div>
                      <div>{t('canvas.information.step1Help')}</div>
                      <button
                        type="button"
                        onClick={() => { void handleChooseLoraDatasetOutput(informationDocument) }}
                        disabled={isRunning || isExportingDataset}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-sky-400/35 bg-sf-dark-900 px-3 py-2 text-xs font-medium text-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        {loraDatasetExportPath ? t('canvas.information.changeDesignSet') : t('canvas.information.chooseDesignSet')}
                      </button>
                      {loraDatasetExportPath && (
                        <div className="mt-2 break-all rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-2 text-emerald-100">
                          {t('canvas.recipe.automaticExport')}: {loraDatasetExportPath}
                        </div>
                      )}
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/20 font-semibold text-sky-100">2</div>
                    <div>
                      <div className="font-medium text-sf-text-primary">{t('canvas.information.step2Title')}</div>
                      <div>{t('canvas.information.step2Help')}</div>
                      <button
                        type="button"
                        onClick={() => { void handleExportLoraDataset() }}
                        disabled={isExportingDataset}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-sf-accent px-3 py-2 text-xs font-medium text-white disabled:cursor-wait disabled:opacity-60"
                      >
                        {isExportingDataset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
                        {t('canvas.information.exportAgain')}
                      </button>
                      {loraDatasetExportPath && (
                        <div className="mt-2 break-all rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-2 text-emerald-100">
                          {t('canvas.information.designSetFolder')}: {loraDatasetExportPath}
                        </div>
                      )}
                    </div>
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-400/20 font-semibold text-sky-100">3</div>
                    <div>
                      <div className="font-medium text-sf-text-primary">{t('canvas.information.trainIn', { factory: informationDetails.title })}</div>
                      <div>{t('canvas.information.step3Help')}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => { void handleOpenInformationSource() }}
                          className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-600 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-primary hover:bg-sf-dark-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {t('canvas.information.downloadInstructions')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleLaunchInstalledFactory() }}
                          disabled={!['ready', 'existing'].includes(loraDatasetStatus) || isLaunchingFactory}
                          className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-600 bg-sf-dark-900 px-3 py-2 text-xs text-sf-text-primary hover:bg-sf-dark-800 disabled:cursor-wait disabled:opacity-60"
                        >
                          {isLaunchingFactory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                          {t('canvas.information.launchFactory')}
                        </button>
                      </div>
                      {loraFactoryPreparation && (
                        <div className="mt-2 rounded-lg border border-sky-300/25 bg-sf-dark-900/60 p-2.5">
                          {Number.isFinite(loraFactoryPreparation.percent) && (
                            <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-sf-dark-700">
                              <div
                                className="h-full bg-sf-accent transition-all"
                                style={{ width: `${Math.max(0, Math.min(100, loraFactoryPreparation.percent))}%` }}
                              />
                            </div>
                          )}
                          <div className="text-[11px] text-sky-100/80">{loraFactoryPreparation.message}</div>
                        </div>
                      )}
                      {loraFactoryLaunchError && (
                        <div className="mt-2 rounded-lg border border-red-400/35 bg-red-500/10 p-3 text-red-100">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="break-words">{loraFactoryLaunchError.message}</div>
                              {loraFactoryLaunchError.settingsSection && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSettings?.(
                                    loraFactoryLaunchError.settingsSection,
                                    { focusTarget: loraFactoryLaunchError.focusTarget || 'lora-factories' }
                                  )}
                                  className="mt-2 inline-flex items-center gap-2 rounded-lg border border-red-300/35 bg-sf-dark-900 px-3 py-2 font-medium text-red-100 hover:bg-sf-dark-800"
                                >
                                  <Settings2 className="h-3.5 w-3.5" />
                                  {loraFactoryLaunchError.settingsSection === 'workflow-setup'
                                    ? t('canvas.actions.openWorkflowSetup')
                                    : t('canvas.actions.openFactorySettings')}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-2 text-[10px] text-sky-100/65">
                        {t('canvas.information.modelLicenseHelp')}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-sky-400/20 pt-3 text-sky-100/75">
                    {t('canvas.information.externalTrainingHelp')}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => { void handleOpenInformationSource() }}
                className="inline-flex items-center gap-2 rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary hover:bg-sf-dark-800"
              >
                <ExternalLink className="h-4 w-4" />
                {t('canvas.information.originalSource')}
              </button>
              <button
                type="button"
                onClick={() => setInformationDocumentId(null)}
                className="inline-flex items-center rounded-lg border border-sf-dark-700 bg-sf-dark-900 px-3 py-2 text-sm text-sf-text-primary hover:bg-sf-dark-800"
              >
                {t('canvas.information.close')}
              </button>
            </div>
          </section>
        </div>
      )}

      {(originalImageAsset?.type === 'image' || originalImageAsset?.type === 'mask') && originalImageAsset.url && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-6 backdrop-blur-sm"
          onMouseDown={() => setOriginalImageAsset(null)}
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="canvas-original-image-title"
            onMouseDown={(event) => event.stopPropagation()}
            className="flex max-h-full max-w-full flex-col overflow-hidden rounded-xl border border-sf-dark-700 bg-sf-dark-950 shadow-[0_28px_80px_rgba(0,0,0,0.7)]"
          >
            <div className="flex flex-shrink-0 items-center gap-3 border-b border-sf-dark-700 px-3 py-2">
              <h2 id="canvas-original-image-title" className="min-w-0 flex-1 truncate text-xs font-medium text-sf-text-primary">
                {originalImageAsset.name || originalImageAsset.path || t('canvas.portTypes.image')} · {t('canvas.information.originalSize')}
              </h2>
              <button
                type="button"
                onClick={() => setOriginalImageAsset(null)}
                className="rounded-lg border border-sf-dark-700 p-1.5 text-sf-text-muted hover:bg-sf-dark-800 hover:text-sf-text-primary"
                aria-label={t('canvas.actions.closeOriginalImage')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[calc(100vh-7rem)] max-w-[calc(100vw-3rem)] overflow-auto bg-black">
              <img
                src={originalImageAsset.url}
                alt={originalImageAsset.name || t('canvas.assets.originalImage')}
                className="block h-auto w-auto max-w-none"
              />
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

