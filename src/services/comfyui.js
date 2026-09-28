export { modifyVdnH3Workflow } from './vdnH3Workflow.mjs'
export { modifyFastMinimaxH3Workflow } from './fastMinimaxH3Workflow.mjs'
/**
 * ComfyUI API Service
 * Handles communication with the ComfyUI backend
 */
import { generationMemory } from './generationMemory'
import {
  checkLocalComfyConnection,
  getLocalComfyHttpBaseSync,
  getLocalComfyWsBaseSync,
  hydrateLocalComfyConnection,
} from './localComfyConnection'
import {
  isInsufficientCreditsError,
  notifyComfyPartnerCreditsLow,
} from './comfyPartnerAuth'
import { extractCreditCountFromText } from '../utils/comfyCredits'
export { modifyMinimaxH3GGUFReferenceWorkflow } from './minimaxH3ReferenceWorkflow.mjs'
export { modifyMinimaxH3PinkReferenceWorkflow } from './minimaxH3PinkReferenceWorkflow.mjs'
import {
  MUSIC_VIDEO_SHOT_DEFAULTS,
  getMusicVideoShotTypeOption,
  normalizeMusicVideoShot,
} from '../config/musicVideoShotConfig'

const COMFY_ORG_API_KEY_SETTING_KEY = 'comfyApiKeyComfyOrg';
const COMFY_ORG_API_KEY_LOCAL_KEY = 'comfystudio-comfy-api-key';
const COMFY_BINARY_EVENT_TYPES = Object.freeze({
  TEXT: 3,
})
const UTF8_DECODER = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8') : null
// Canonical marker titles are VELORN_*; legacy COMFYSTUDIO_* titles from
// graphs tagged before the rename still match (see endpointTitleAliases).
export const CUSTOM_KEYFRAME_ENDPOINTS = Object.freeze({
  inputImage: 'VELORN_INPUT_IMAGE',
  prompt: 'VELORN_PROMPT',
  seed: 'VELORN_SEED',
  width: 'VELORN_WIDTH',
  height: 'VELORN_HEIGHT',
  referenceImage1: 'VELORN_REFERENCE_IMAGE_1',
  referenceImage2: 'VELORN_REFERENCE_IMAGE_2',
  outputImage: 'VELORN_OUTPUT_IMAGE',
})
export const CUSTOM_VIDEO_ENDPOINTS = Object.freeze({
  inputImage: 'VELORN_INPUT_IMAGE',
  prompt: 'VELORN_PROMPT',
  seed: 'VELORN_SEED',
  width: 'VELORN_WIDTH',
  height: 'VELORN_HEIGHT',
  fps: 'VELORN_FPS',
  duration: 'VELORN_DURATION',
  inputAudio: 'VELORN_AUDIO',
  outputVideo: 'VELORN_OUTPUT_VIDEO',
})
const VELORN_OUTPUT_RESIZE_TITLE = 'Velorn Output Resize'
const LEGACY_COMFYSTUDIO_OUTPUT_RESIZE_TITLE = 'ComfyStudio Output Resize'
const OUTPUT_RESIZE_TITLES = [VELORN_OUTPUT_RESIZE_TITLE, LEGACY_COMFYSTUDIO_OUTPUT_RESIZE_TITLE]

// Users commonly organize ComfyUI model folders into subfolders (e.g.
// models/diffusion_models/WAN/wan2.2_i2v.safetensors); ComfyUI then lists the
// file to loader nodes as the relative path "WAN/wan2.2_i2v.safetensors".
// Velorn's built-in workflows reference bare filenames, so an unmatched
// model input is resolved against the node's actual choice list by basename
// before queueing (see resolveSubfolderModelPaths).
const MODEL_FILE_INPUT_RE = /\.(safetensors|sft|ckpt|pt|pth|bin|gguf|onnx)$/i

function modelPathBasename(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  const parts = normalized.split(/[\\/]+/)
  return parts[parts.length - 1] || ''
}

function extractComboChoicesFromSpec(inputSpec) {
  const asList = (values) => Array.isArray(values)
    ? values.map((entry) => String(entry || '').trim()).filter(Boolean)
    : []
  const choicesFromObject = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    return asList(value.values || value.choices || value.options || value.enum)
  }
  if (!inputSpec) return []
  if (Array.isArray(inputSpec)) {
    const [first, config] = inputSpec
    if (Array.isArray(first)) return asList(first)
    const firstChoices = choicesFromObject(first)
    if (firstChoices.length > 0) return firstChoices

    // Newer ComfyUI versions describe dynamic combo inputs as
    // ["COMBO", { options: [...] }], while older versions put the choice
    // array directly in the first item. Support both response shapes so
    // built-in workflow filenames can still be resolved to subfolders.
    if (String(first || '').toUpperCase() === 'COMBO') {
      return choicesFromObject(config)
    }
  }
  if (typeof inputSpec === 'object') {
    return choicesFromObject(inputSpec)
  }
  return []
}

function getSchemaInputSpec(nodeSchema, inputKey) {
  const requiredSpec = nodeSchema?.input?.required?.[inputKey]
  if (requiredSpec !== undefined) return requiredSpec
  const optionalSpec = nodeSchema?.input?.optional?.[inputKey]
  if (optionalSpec !== undefined) return optionalSpec
  return null
}

function parseNumericLike(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    if (!normalized) return null
    const parsed = Number(normalized)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function normalizeEndpointTitle(value = '') {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function endpointTitleAliases(endpointName) {
  return [endpointName, endpointName.replace(/^VELORN_/, 'COMFYSTUDIO_')]
}

function titleMatchesEndpoint(title, endpointName) {
  const normalizedTitle = normalizeEndpointTitle(title)
  return Boolean(normalizedTitle) && endpointTitleAliases(endpointName)
    .some((name) => normalizedTitle.includes(normalizeEndpointTitle(name)))
}

function nodeHasEndpointTitle(node, endpointName) {
  return titleMatchesEndpoint(normalizeEndpointTitle(node?._meta?.title), endpointName)
}

function findCustomEndpointNodes(workflow, endpointConfig) {
  const endpoints = {}
  for (const [nodeId, node] of Object.entries(workflow || {})) {
    if (!node || typeof node !== 'object') continue
    for (const [key, endpointName] of Object.entries(endpointConfig || {})) {
      if (nodeHasEndpointTitle(node, endpointName) && !endpoints[key]) {
        endpoints[key] = { nodeId, node }
      }
    }
  }
  return endpoints
}

function findCustomKeyframeEndpointNodes(workflow) {
  return findCustomEndpointNodes(workflow, CUSTOM_KEYFRAME_ENDPOINTS)
}

function findCustomVideoEndpointNodes(workflow) {
  return findCustomEndpointNodes(workflow, CUSTOM_VIDEO_ENDPOINTS)
}

const REQUIRED_CUSTOM_KEYFRAME_ENDPOINT_KEYS = ['inputImage', 'prompt', 'outputImage']
const REQUIRED_CUSTOM_VIDEO_ENDPOINT_KEYS = ['inputImage', 'prompt', 'outputVideo']

/**
 * Pre-check a UI-format graph (as saved in the personal workflow library)
 * against a custom slot's VELORN node-title contract. Mirrors the
 * required markers of validateCustomKeyframeWorkflow /
 * validateCustomVideoWorkflow but reads LiteGraph `node.title`, so it can run
 * without converting the graph to API format first.
 */
export function scanUiWorkflowForCustomEndpoints(uiWorkflow, kind = 'keyframe') {
  const isVideo = kind === 'video'
  const config = isVideo ? CUSTOM_VIDEO_ENDPOINTS : CUSTOM_KEYFRAME_ENDPOINTS
  const requiredKeys = isVideo ? REQUIRED_CUSTOM_VIDEO_ENDPOINT_KEYS : REQUIRED_CUSTOM_KEYFRAME_ENDPOINT_KEYS

  const titles = []
  const nodeLists = [uiWorkflow?.nodes]
  for (const subgraph of uiWorkflow?.definitions?.subgraphs || []) nodeLists.push(subgraph?.nodes)
  for (const nodes of nodeLists) {
    if (!Array.isArray(nodes)) continue
    for (const node of nodes) {
      const title = normalizeEndpointTitle(node?.title)
      if (title) titles.push(title)
    }
  }

  const found = {}
  for (const [key, endpointName] of Object.entries(config)) {
    found[key] = titles.some((title) => titleMatchesEndpoint(title, endpointName))
  }
  const missingKeys = requiredKeys.filter((key) => !found[key])
  const missing = missingKeys.map((key) => config[key])
  return { eligible: missing.length === 0, found, missing, missingKeys }
}

function firstWritableInputKey(node, preferredKeys = []) {
  const inputs = node?.inputs || {}
  for (const key of preferredKeys) {
    if (Object.prototype.hasOwnProperty.call(inputs, key)) return key
  }
  return null
}

function setEndpointValue(node, value, preferredKeys = []) {
  if (!node?.inputs) return false
  const key = firstWritableInputKey(node, preferredKeys)
  if (!key) return false
  node.inputs[key] = value
  return true
}

function inputRefEquals(value, nodeId, outputIndex = 0) {
  return Array.isArray(value) && String(value[0]) === String(nodeId) && Number(value[1]) === Number(outputIndex)
}

function getUniqueWorkflowNodeId(workflow, preferredId) {
  const base = String(preferredId || 'comfystudio_node')
  if (!workflow[base]) return base
  let suffix = 1
  while (workflow[`${base}_${suffix}`]) suffix += 1
  return `${base}_${suffix}`
}

function findNodeIdByTitle(workflow, title) {
  const needle = String(title || '').trim().toLowerCase()
  if (!needle) return null
  for (const [nodeId, node] of Object.entries(workflow || {})) {
    const nodeTitle = String(node?._meta?.title || '').trim().toLowerCase()
    if (nodeTitle === needle) return nodeId
  }
  return null
}

function findFirstNodeIdByClass(workflow, classType) {
  const needle = String(classType || '').trim()
  if (!needle) return null
  for (const [nodeId, node] of Object.entries(workflow || {})) {
    if (String(node?.class_type || '') === needle) return nodeId
  }
  return null
}

export function addQwenImageEditResolutionControls(workflow, options = {}) {
  const {
    width = 1280,
    height = 720,
    useEndpointNodes = false,
  } = options

  if (!workflow || typeof workflow !== 'object') return workflow

  const numericWidth = Math.max(256, Math.round(Number(width) || 1280))
  const numericHeight = Math.max(256, Math.round(Number(height) || 720))
  const sourceNodeId = findFirstNodeIdByClass(workflow, 'FluxKontextImageScale')
    || findFirstNodeIdByClass(workflow, 'LoadImage')
  if (!sourceNodeId) return workflow

  let widthNodeId = findNodeIdByTitle(workflow, CUSTOM_KEYFRAME_ENDPOINTS.width)
  let heightNodeId = findNodeIdByTitle(workflow, CUSTOM_KEYFRAME_ENDPOINTS.height)
  if (useEndpointNodes && !widthNodeId) {
    widthNodeId = getUniqueWorkflowNodeId(workflow, 'comfystudio_width')
    workflow[widthNodeId] = {
      class_type: 'PrimitiveInt',
      inputs: { value: numericWidth },
      _meta: { title: CUSTOM_KEYFRAME_ENDPOINTS.width },
    }
  }
  if (useEndpointNodes && !heightNodeId) {
    heightNodeId = getUniqueWorkflowNodeId(workflow, 'comfystudio_height')
    workflow[heightNodeId] = {
      class_type: 'PrimitiveInt',
      inputs: { value: numericHeight },
      _meta: { title: CUSTOM_KEYFRAME_ENDPOINTS.height },
    }
  }

  let resizeNodeId = findOutputResizeNodeId(workflow)
  if (!resizeNodeId) {
    resizeNodeId = getUniqueWorkflowNodeId(workflow, 'comfystudio_output_resize')
    workflow[resizeNodeId] = {
      class_type: 'ImageScale',
      inputs: {},
      _meta: { title: VELORN_OUTPUT_RESIZE_TITLE },
    }
  }

  const resizeNode = workflow[resizeNodeId]
  resizeNode.class_type = 'ImageScale'
  resizeNode.inputs = {
    ...(resizeNode.inputs || {}),
    image: [sourceNodeId, 0],
    upscale_method: resizeNode.inputs?.upscale_method || 'lanczos',
    width: useEndpointNodes && widthNodeId ? [widthNodeId, 0] : numericWidth,
    height: useEndpointNodes && heightNodeId ? [heightNodeId, 0] : numericHeight,
    crop: 'center',
  }
  resizeNode._meta = {
    ...(resizeNode._meta || {}),
    title: VELORN_OUTPUT_RESIZE_TITLE,
  }

  const resizeRef = [resizeNodeId, 0]
  for (const [nodeId, node] of Object.entries(workflow)) {
    if (!node?.inputs || String(nodeId) === String(resizeNodeId)) continue
    for (const [inputName, inputValue] of Object.entries(node.inputs)) {
      if (inputRefEquals(inputValue, sourceNodeId, 0)) {
        node.inputs[inputName] = resizeRef
      }
    }
  }
  resizeNode.inputs.image = [sourceNodeId, 0]

  return workflow
}

function normalizeComfyStudioOutputResize(workflow) {
  const resizeNodeId = findOutputResizeNodeId(workflow)
  const resizeNode = resizeNodeId ? workflow?.[resizeNodeId] : null
  if (resizeNode?.class_type === 'ImageScale' && resizeNode.inputs) {
    resizeNode.inputs.crop = 'center'
    resizeNode._meta = {
      ...(resizeNode._meta || {}),
      title: VELORN_OUTPUT_RESIZE_TITLE,
    }
  }
  return workflow
}

function findOutputResizeNodeId(workflow) {
  for (const title of OUTPUT_RESIZE_TITLES) {
    const nodeId = findNodeIdByTitle(workflow, title)
    if (nodeId) return nodeId
  }
  return null
}

export function validateCustomKeyframeWorkflow(workflow, options = {}) {
  const {
    requireInputImage = true,
    requirePrompt = true,
    validateOptionalEndpoints = true,
  } = options || {}
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return {
      ok: false,
      missing: ['workflow_json'],
      warnings: [],
      endpoints: {},
      message: 'Workflow JSON is empty or invalid.',
    }
  }

  const endpoints = findCustomKeyframeEndpointNodes(workflow)
  const missing = []
  const warnings = []
  if (requireInputImage && !endpoints.inputImage) missing.push(CUSTOM_KEYFRAME_ENDPOINTS.inputImage)
  if (requirePrompt && !endpoints.prompt) missing.push(CUSTOM_KEYFRAME_ENDPOINTS.prompt)
  if (!endpoints.outputImage) missing.push(CUSTOM_KEYFRAME_ENDPOINTS.outputImage)
  const blocking = [...missing]

  if (endpoints.inputImage && endpoints.inputImage.node?.class_type !== 'LoadImage') {
    blocking.push(`${CUSTOM_KEYFRAME_ENDPOINTS.inputImage} must be a LoadImage node`)
  }
  if (endpoints.outputImage && endpoints.outputImage.node?.class_type !== 'SaveImage') {
    blocking.push(`${CUSTOM_KEYFRAME_ENDPOINTS.outputImage} must be a SaveImage node`)
  }
  if (requirePrompt && endpoints.prompt && !firstWritableInputKey(endpoints.prompt.node, ['value', 'prompt', 'text', 'string'])) {
    blocking.push(`${CUSTOM_KEYFRAME_ENDPOINTS.prompt} needs a writable value, prompt, text, or string input`)
  }
  if (validateOptionalEndpoints && endpoints.seed && !firstWritableInputKey(endpoints.seed.node, ['seed', 'noise_seed', 'value'])) {
    warnings.push(`${CUSTOM_KEYFRAME_ENDPOINTS.seed} exists but has no seed, noise_seed, or value input.`)
  }
  if (validateOptionalEndpoints && endpoints.width && !firstWritableInputKey(endpoints.width.node, ['width', 'value'])) {
    warnings.push(`${CUSTOM_KEYFRAME_ENDPOINTS.width} exists but has no width or value input.`)
  }
  if (validateOptionalEndpoints && endpoints.height && !firstWritableInputKey(endpoints.height.node, ['height', 'value'])) {
    warnings.push(`${CUSTOM_KEYFRAME_ENDPOINTS.height} exists but has no height or value input.`)
  }

  return {
    ok: blocking.length === 0,
    missing,
    warnings,
    endpoints: Object.fromEntries(Object.entries(endpoints).map(([key, entry]) => [key, entry.nodeId])),
    message: blocking.length === 0
      ? 'Custom keyframe workflow is ready.'
      : `Custom workflow needs: ${blocking.join(', ')}`,
  }
}

export function validateCustomVideoWorkflow(workflow, options = {}) {
  const {
    requireInputImage = true,
  } = options || {}
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) {
    return {
      ok: false,
      missing: ['workflow_json'],
      warnings: [],
      endpoints: {},
      message: 'Workflow JSON is empty or invalid.',
    }
  }

  const endpoints = findCustomVideoEndpointNodes(workflow)
  const missing = []
  const warnings = []
  if (requireInputImage && !endpoints.inputImage) missing.push(CUSTOM_VIDEO_ENDPOINTS.inputImage)
  if (!endpoints.prompt) missing.push(CUSTOM_VIDEO_ENDPOINTS.prompt)
  if (!endpoints.outputVideo) missing.push(CUSTOM_VIDEO_ENDPOINTS.outputVideo)
  const blocking = [...missing]

  if (endpoints.inputImage && endpoints.inputImage.node?.class_type !== 'LoadImage') {
    blocking.push(`${CUSTOM_VIDEO_ENDPOINTS.inputImage} must be a LoadImage node`)
  }
  if (endpoints.prompt && !firstWritableInputKey(endpoints.prompt.node, ['value', 'prompt', 'text', 'string'])) {
    blocking.push(`${CUSTOM_VIDEO_ENDPOINTS.prompt} needs a writable value, prompt, text, or string input`)
  }
  if (
    endpoints.outputVideo
    && !firstWritableInputKey(endpoints.outputVideo.node, ['filename_prefix'])
    && !/video|save|combine/i.test(String(endpoints.outputVideo.node?.class_type || ''))
  ) {
    warnings.push(`${CUSTOM_VIDEO_ENDPOINTS.outputVideo} should be the node that writes or returns the final video.`)
  }
  if (endpoints.seed && !firstWritableInputKey(endpoints.seed.node, ['seed', 'noise_seed', 'value'])) {
    warnings.push(`${CUSTOM_VIDEO_ENDPOINTS.seed} exists but has no seed, noise_seed, or value input.`)
  }
  if (endpoints.width && !firstWritableInputKey(endpoints.width.node, ['width', 'value'])) {
    warnings.push(`${CUSTOM_VIDEO_ENDPOINTS.width} exists but has no width or value input.`)
  }
  if (endpoints.height && !firstWritableInputKey(endpoints.height.node, ['height', 'value'])) {
    warnings.push(`${CUSTOM_VIDEO_ENDPOINTS.height} exists but has no height or value input.`)
  }
  if (endpoints.fps && !firstWritableInputKey(endpoints.fps.node, ['fps', 'frame_rate', 'value'])) {
    warnings.push(`${CUSTOM_VIDEO_ENDPOINTS.fps} exists but has no fps, frame_rate, or value input.`)
  }
  if (endpoints.duration && !firstWritableInputKey(endpoints.duration.node, ['duration', 'seconds', 'length', 'value'])) {
    warnings.push(`${CUSTOM_VIDEO_ENDPOINTS.duration} exists but has no duration, seconds, length, or value input.`)
  }
  if (endpoints.inputAudio && !firstWritableInputKey(endpoints.inputAudio.node, ['audio', 'file', 'filename', 'value'])) {
    warnings.push(`${CUSTOM_VIDEO_ENDPOINTS.inputAudio} exists but has no audio, file, filename, or value input.`)
  }

  return {
    ok: blocking.length === 0,
    missing,
    warnings,
    endpoints: Object.fromEntries(Object.entries(endpoints).map(([key, entry]) => [key, entry.nodeId])),
    message: blocking.length === 0
      ? 'Custom video workflow is ready.'
      : `Custom video workflow needs: ${blocking.join(', ')}`,
  }
}

function inferUploadExtension(file, filename) {
  const nameMatch = String(filename || file?.name || '').match(/\.([a-zA-Z0-9]{1,8})(?:[?#].*)?$/)
  if (nameMatch) return `.${nameMatch[1].toLowerCase()}`
  const mimeType = String(file?.type || '').toLowerCase()
  if (mimeType.includes('jpeg')) return '.jpg'
  if (mimeType.includes('png')) return '.png'
  if (mimeType.includes('webp')) return '.webp'
  if (mimeType.includes('gif')) return '.gif'
  if (mimeType.includes('mp4')) return '.mp4'
  if (mimeType.includes('mpeg')) return '.mp3'
  if (mimeType.includes('wav')) return '.wav'
  return ''
}

function sanitizeUploadFilename(file, filename) {
  const rawName = String(filename || file?.name || `upload_${Date.now()}`)
  const extension = inferUploadExtension(file, rawName)
  const base = rawName
    .split(/[\\/]/)
    .pop()
    .replace(/\.[a-zA-Z0-9]{1,8}$/, '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || `upload_${Date.now()}`
  return `${base}${extension}`
}

function extractCreditBalanceFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null

  const preferredExactKeys = new Set([
    'credits',
    'credit_balance',
    'creditbalance',
    'remaining_credits',
    'remainingcredits',
    'available_credits',
    'availablecredits',
  ])

  const fallbackKeyPattern = /(credit|balance)/i
  const queue = [payload]
  const visited = new Set()

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current || typeof current !== 'object') continue
    if (visited.has(current)) continue
    visited.add(current)

    for (const [rawKey, rawValue] of Object.entries(current)) {
      const key = String(rawKey || '').trim()
      const normalizedKey = key.toLowerCase().replace(/[\s-]/g, '')

      if (preferredExactKeys.has(normalizedKey)) {
        const parsed = parseNumericLike(rawValue)
        if (parsed !== null) return parsed
      }

      if (fallbackKeyPattern.test(key)) {
        const parsed = parseNumericLike(rawValue)
        if (parsed !== null) return parsed
      }

      if (rawValue && typeof rawValue === 'object') {
        queue.push(rawValue)
      }
    }
  }

  return null
}

class ComfyUIService {
  constructor() {
    this.ws = null;
    this.clientId = this.generateClientId();
    this.listeners = new Map();
    this.wsFailCount = 0;
    this.lastWsAttempt = 0;
    this.wsBackoffMs = 5000; // Minimum time between reconnection attempts
    // Small rolling cache of promptId -> { [nodeId]: classType }. Consumers
    // (e.g. the launcher log bridge) can use this to label node IDs with
    // their class_type in human-readable log output.
    this._promptNodeMeta = new Map();
    this._promptNodeMetaMax = 32;
    this._currentExecutionPromptId = null;
    this._recentPromptByNodeId = new Map();
    this._recentPromptByNodeIdMax = 64;
    void hydrateLocalComfyConnection()
  }

  /**
   * Look up the class_type of a node in a recently-submitted prompt.
   * Returns null if the prompt has aged out of the cache or the node is
   * unknown.
   */
  getNodeClassType(promptId, nodeId) {
    if (!promptId || nodeId == null) return null;
    const meta = this._promptNodeMeta.get(String(promptId));
    if (!meta) return null;
    return meta[String(nodeId)] || null;
  }

  _rememberPromptNodeMeta(promptId, workflow) {
    if (!promptId || !workflow || typeof workflow !== 'object') return;
    try {
      const map = {};
      for (const [nodeId, node] of Object.entries(workflow)) {
        if (node && typeof node === 'object' && typeof node.class_type === 'string') {
          map[String(nodeId)] = node.class_type;
        }
      }
      this._promptNodeMeta.set(String(promptId), map);
      while (this._promptNodeMeta.size > this._promptNodeMetaMax) {
        const firstKey = this._promptNodeMeta.keys().next().value;
        if (firstKey === undefined) break;
        this._promptNodeMeta.delete(firstKey);
      }
    } catch (_) { /* ignore */ }
  }

  _rememberExecutingNodePrompt(promptId, nodeId) {
    if (!promptId || nodeId == null) return;
    const normalizedPromptId = String(promptId);
    const normalizedNodeId = String(nodeId);
    this._currentExecutionPromptId = normalizedPromptId;
    this._recentPromptByNodeId.set(normalizedNodeId, normalizedPromptId);
    while (this._recentPromptByNodeId.size > this._recentPromptByNodeIdMax) {
      const firstKey = this._recentPromptByNodeId.keys().next().value;
      if (firstKey === undefined) break;
      this._recentPromptByNodeId.delete(firstKey);
    }
  }

  _clearExecutionPrompt(promptId) {
    if (!promptId) {
      this._currentExecutionPromptId = null;
      return;
    }
    const normalizedPromptId = String(promptId);
    if (this._currentExecutionPromptId === normalizedPromptId) {
      this._currentExecutionPromptId = null;
    }
  }

  _resolvePromptIdForNode(nodeId) {
    if (nodeId != null) {
      const recentPromptId = this._recentPromptByNodeId.get(String(nodeId));
      if (recentPromptId) return recentPromptId;
    }
    return this._currentExecutionPromptId;
  }

  _parseProgressTextPayload(bytes) {
    if (!UTF8_DECODER || !(bytes instanceof Uint8Array) || bytes.byteLength < 4) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const nodeIdByteLength = view.getUint32(0);
    const nodeIdStart = 4;
    const textStart = nodeIdStart + nodeIdByteLength;
    if (nodeIdByteLength < 0 || textStart > bytes.byteLength) return null;
    return {
      nodeId: UTF8_DECODER.decode(bytes.slice(nodeIdStart, textStart)),
      text: UTF8_DECODER.decode(bytes.slice(textStart)),
    };
  }

  async handleSocketData(rawData) {
    if (typeof rawData === 'string') {
      this.handleMessage(JSON.parse(rawData));
      return;
    }

    if (rawData instanceof ArrayBuffer) {
      this.handleBinaryMessage(rawData);
      return;
    }

    if (ArrayBuffer.isView(rawData)) {
      const view = rawData;
      this.handleBinaryMessage(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
      return;
    }

    if (typeof Blob !== 'undefined' && rawData instanceof Blob) {
      const buffer = await rawData.arrayBuffer();
      this.handleBinaryMessage(buffer);
    }
  }

  handleBinaryMessage(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 4) return;
    const view = new DataView(buffer);
    const eventType = view.getUint32(0);
    if (eventType !== COMFY_BINARY_EVENT_TYPES.TEXT) return;

    const payload = this._parseProgressTextPayload(new Uint8Array(buffer, 4));
    if (!payload?.text) return;

    const promptId = this._resolvePromptIdForNode(payload.nodeId);
    const nodeType = promptId ? this.getNodeClassType(promptId, payload.nodeId) : null;
    this.emit('progress_text', {
      nodeId: payload.nodeId,
      nodeType,
      promptId,
      text: payload.text,
      credits: extractCreditCountFromText(payload.text),
    });
  }

  generateClientId() {
    return 'comfystudio-' + Math.random().toString(36).substring(2, 15);
  }

  getHttpBase() {
    return getLocalComfyHttpBaseSync()
  }

  getWsBase() {
    return getLocalComfyWsBaseSync()
  }

  /**
   * Connect to ComfyUI WebSocket for progress updates
   * Always connects directly to ComfyUI (bypassing Vite proxy)
   */
  connect() {
    return new Promise((resolve, reject) => {
      // Skip if already connected
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      // Rate limit reconnection attempts to avoid spam
      const now = Date.now();
      if (now - this.lastWsAttempt < this.wsBackoffMs) {
        reject(new Error('WebSocket reconnection rate limited'));
        return;
      }
      this.lastWsAttempt = now;
      
      // Close existing connection if in connecting/closing state
      if (this.ws) {
        try {
          this.ws.close();
        } catch (e) {}
        this.ws = null;
      }

      // Always connect directly to ComfyUI (Vite proxy doesn't handle WS well)
      const wsUrl = `${this.getWsBase()}/ws?clientId=${this.clientId}`;
      
      // Only log first attempt
      if (this.wsFailCount === 0) {
        console.log('Connecting to ComfyUI WebSocket:', wsUrl);
      }
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';
      
      // Set a timeout for connection
      const timeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
          this.wsFailCount++;
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
      
      this.ws.onopen = () => {
        clearTimeout(timeout);
        console.log('Connected to ComfyUI WebSocket');
        this.wsFailCount = 0;
        resolve();
      };

      this.ws.onerror = (error) => {
        clearTimeout(timeout);
        // Only log first few errors to avoid spam
        if (this.wsFailCount < 3) {
          console.warn('WebSocket connection failed (ComfyUI may not support WebSocket or is blocked)');
        }
        this.wsFailCount++;
        // Increase backoff on repeated failures
        this.wsBackoffMs = Math.min(30000, this.wsBackoffMs * 1.5);
        reject(error);
      };

      this.ws.onmessage = async (event) => {
        try {
          await this.handleSocketData(event.data);
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed');
        this.ws = null;
      };
    });
  }
  
  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleMessage(data) {
    const { type } = data;
    if (type === 'execution_start' || (type === 'executing' && data.data?.node !== null)) generationMemory.activity()
    if (type === 'execution_success' || (type === 'executing' && data.data?.node === null)) generationMemory.completed(data.data?.prompt_id)
    
    if (type === 'progress') {
      this.emit('progress', {
        value: data.data.value,
        max: data.data.max,
        promptId: data.data.prompt_id
      });
    } else if (type === 'executing') {
      if (data.data.node === null) {
        // Execution complete
        this._clearExecutionPrompt(data.data?.prompt_id);
        this.emit('complete', { promptId: data.data.prompt_id });
      } else {
        this._rememberExecutingNodePrompt(data.data?.prompt_id, data.data?.node);
        this.emit('executing', { 
          node: data.data.node,
          promptId: data.data.prompt_id 
        });
      }
    } else if (type === 'executed') {
      this.emit('executed', {
        node: data.data.node,
        output: data.data.output,
        promptId: data.data.prompt_id
      });
    } else if (type === 'status') {
      this.emit('status', data.data);
    } else if (type === 'execution_start') {
      if (data.data?.prompt_id) {
        this._currentExecutionPromptId = String(data.data.prompt_id);
      }
      this.emit('execution_start', {
        promptId: data.data?.prompt_id,
        timestamp: data.data?.timestamp,
      });
    } else if (type === 'execution_cached') {
      this.emit('execution_cached', {
        promptId: data.data?.prompt_id,
        nodes: Array.isArray(data.data?.nodes) ? data.data.nodes : [],
      });
    } else if (type === 'execution_success') {
      this._clearExecutionPrompt(data.data?.prompt_id);
      this.emit('execution_success', {
        promptId: data.data?.prompt_id,
        timestamp: data.data?.timestamp,
      });
    } else if (type === 'execution_error') {
      this._clearExecutionPrompt(data.data?.prompt_id);
      this.emit('execution_error', {
        promptId: data.data?.prompt_id,
        nodeId: data.data?.node_id,
        nodeType: data.data?.node_type,
        message: data.data?.exception_message || data.data?.exception_type || 'Execution error',
        traceback: Array.isArray(data.data?.traceback) ? data.data.traceback : undefined,
      });
    } else if (type === 'execution_interrupted') {
      this._clearExecutionPrompt(data.data?.prompt_id);
      this.emit('execution_interrupted', {
        promptId: data.data?.prompt_id,
        nodeId: data.data?.node_id,
      });
    }
  }

  /**
   * Event emitter methods
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  /**
   * Check if ComfyUI is running
   */
  async checkConnection() {
    // Sleeping is available on demand; background heartbeats must not wake it.
    if (generationMemory.sleeping) return true
    const result = await checkLocalComfyConnection()
    if (!result.ok) {
      console.log('ComfyUI connection check failed:', result.error)
    }
    return result.ok
  }

  /**
   * Get ComfyUI object metadata (available node classes and input schemas).
   * Optionally scopes to a single class when classType is provided.
   */
  async getObjectInfo(classType = null) {
    await generationMemory.wake()
    const suffix = classType
      ? `/object_info/${encodeURIComponent(String(classType).trim())}`
      : '/object_info'
    const response = await fetch(`${this.getHttpBase()}${suffix}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch ComfyUI object info (${response.status})`)
    }
    return response.json()
  }

  async getObjectInfoCached(maxAgeMs = 60000) {
    const now = Date.now()
    if (this._objectInfoCache && (now - this._objectInfoCacheAt) < maxAgeMs) {
      return this._objectInfoCache
    }
    const info = await this.getObjectInfo()
    this._objectInfoCache = info
    this._objectInfoCacheAt = now
    return info
  }

  /**
   * Rewrite model-file inputs whose bare filename lives in a subfolder of a
   * ComfyUI models directory. ComfyUI validates combo inputs against its own
   * choice list ("WAN/wan2.2.safetensors"), so a bare "wan2.2.safetensors"
   * from a built-in workflow would be rejected with value_not_in_list even
   * though the file is installed. Exact matches are left untouched; ambiguous
   * basenames (same filename in several subfolders) pick the first
   * alphabetically and say so in the log. Fails open: any error returns the
   * workflow unchanged and lets ComfyUI's own validation report the problem.
   */
  async resolveSubfolderModelPaths(workflow) {
    try {
      if (!workflow || typeof workflow !== 'object') return workflow

      const pending = []
      for (const [nodeId, node] of Object.entries(workflow)) {
        const inputs = node?.inputs
        if (!inputs || typeof inputs !== 'object') continue
        for (const [inputKey, value] of Object.entries(inputs)) {
          if (typeof value !== 'string') continue
          const trimmed = value.trim()
          if (!MODEL_FILE_INPUT_RE.test(trimmed)) continue
          const aliases = Array.isArray(node?._meta?.model_aliases?.[inputKey])
            ? node._meta.model_aliases[inputKey]
              .map((alias) => String(alias || '').trim())
              .filter(Boolean)
            : []
          pending.push({ nodeId, classType: String(node?.class_type || '').trim(), inputKey, value: trimmed, aliases })
        }
      }
      if (pending.length === 0) return workflow

      const objectInfo = await this.getObjectInfoCached()
      if (!objectInfo || typeof objectInfo !== 'object') return workflow

      const substitutions = []
      for (const entry of pending) {
        const nodeSchema = objectInfo[entry.classType]
        if (!nodeSchema) continue
        const choices = extractComboChoicesFromSpec(getSchemaInputSpec(nodeSchema, entry.inputKey))
        if (choices.length === 0) continue
        const lowerValue = entry.value.toLowerCase()
        if (choices.some((choice) => String(choice).toLowerCase() === lowerValue)) continue
        const wantedBasename = modelPathBasename(entry.value)
        if (!wantedBasename) continue
        let candidates = choices.filter((choice) => modelPathBasename(choice) === wantedBasename)
        if (candidates.length === 0 && entry.aliases.length > 0) {
          const aliasBasenames = new Set(entry.aliases.map((alias) => modelPathBasename(alias)))
          candidates = choices.filter((choice) => aliasBasenames.has(modelPathBasename(choice)))
        }
        if (candidates.length === 0) continue
        const resolved = [...candidates].sort()[0]
        substitutions.push({ ...entry, resolved, ambiguous: candidates.length > 1 })
      }
      if (substitutions.length === 0) return workflow

      const resolvedWorkflow = JSON.parse(JSON.stringify(workflow))
      for (const sub of substitutions) {
        const target = resolvedWorkflow?.[sub.nodeId]?.inputs
        if (target) target[sub.inputKey] = sub.resolved
        console.log(
          `[ComfyUI] Resolved model input to subfolder path: ${sub.classType}.${sub.inputKey} '${sub.value}' -> '${sub.resolved}'`
          + (sub.ambiguous ? ' (multiple matches; picked first alphabetically)' : '')
        )
      }
      return resolvedWorkflow
    } catch (error) {
      try { console.warn('[ComfyUI] Subfolder model path resolution skipped:', error?.message) } catch (_) { /* ignore */ }
      return workflow
    }
  }

  /**
   * Fail before /prompt when a workflow still points at an author-only sample
   * image (for example example.png or model_placeholder.jpg). LoadImage only
   * accepts files that exist in ComfyUI's input list. Query that list fresh:
   * the normal Lumeweft path uploads the user's image immediately before this
   * check, so the general object-info cache could otherwise be stale.
   */
  async validateInputImageReferences(workflow) {
    if (!workflow || typeof workflow !== 'object') return

    const references = []
    for (const [nodeId, node] of Object.entries(workflow)) {
      if (node?.class_type !== 'LoadImage') continue
      const filename = typeof node?.inputs?.image === 'string' ? node.inputs.image.trim() : ''
      if (filename) references.push({ nodeId, filename })
    }
    if (references.length === 0) return

    try {
      const response = await this.getObjectInfo('LoadImage')
      const schema = response?.LoadImage || response
      const choices = extractComboChoicesFromSpec(getSchemaInputSpec(schema, 'image'))
      if (choices.length === 0) return

      const normalize = (value) => String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/\s+\[(?:input|output|temp)\]\s*$/i, '')
        .toLowerCase()
      const available = new Set(choices.map(normalize))
      const missing = references.filter(({ filename }) => !available.has(normalize(filename)))
      if (missing.length === 0) return

      const names = [...new Set(missing.map(({ filename }) => filename))]
      throw new Error(
        `入力画像がComfyUIに見つかりません: ${names.join(', ')}。`
        + ' 参照画像を選び直してからキューに追加してください。'
        + ` (Input image not found in ComfyUI: ${names.join(', ')}. Select the reference image again.)`
      )
    } catch (error) {
      // Our actionable missing-input error must reach the queue UI. If the
      // metadata endpoint itself is unavailable, fail open and let /prompt
      // provide its normal validation response instead.
      if (/入力画像がComfyUIに見つかりません/.test(String(error?.message || ''))) throw error
      try { console.warn('[ComfyUI] Input image preflight skipped:', error?.message) } catch (_) { /* ignore */ }
    }
  }

  /**
   * Queue a prompt for execution
   */
  async queuePrompt(workflow, options = {}) {
    return generationMemory.submit(workflow, () => this._queuePrompt(workflow, options))
  }

  async _queuePrompt(workflow, options = {}) {
    try {
      const resolvedWorkflow = await this.resolveSubfolderModelPaths(workflow)
      await this.validateInputImageReferences(resolvedWorkflow)
      const apiKey = await this.getComfyOrgApiKey();
      const payload = {
        prompt: resolvedWorkflow,
        client_id: this.clientId
      };
      if (apiKey) {
        payload.extra_data = {
          api_key_comfy_org: apiKey
        };
      }
      if (options.canvasOutput) {
        payload.extra_data = { ...payload.extra_data, lumeweft_canvas_output: options.canvasOutput }
      }
      const response = await fetch(`${this.getHttpBase()}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try to pull a structured body for better error messages. Some
        // ComfyUI / partner-node failures return JSON, others a plain string.
        let errorBody = null
        try {
          errorBody = await response.json()
        } catch (_) {
          try { errorBody = await response.text() } catch (_) { /* ignore */ }
        }

        // ComfyUI's /prompt validation failures put the real cause in
        // `node_errors` (per-node diagnostics like "value_not_in_list",
        // "required_input_missing", or custom validators) and extra context
        // in `error.details` / `error.extra_info`. The top-level
        // `error.message` is usually just the generic label
        // ("Prompt outputs failed validation"), so we synthesise a richer
        // message that callers (and users) can actually act on.
        const topMessage =
          (errorBody && typeof errorBody === 'object' && (errorBody.error?.message || errorBody.message)) ||
          (typeof errorBody === 'string' && errorBody) ||
          `Failed to queue prompt (${response.status})`

        const nodeErrorLines = []
        if (errorBody && typeof errorBody === 'object' && errorBody.node_errors && typeof errorBody.node_errors === 'object') {
          for (const [nodeId, nodeInfo] of Object.entries(errorBody.node_errors)) {
            const classType = nodeInfo?.class_type || 'unknown'
            const errs = Array.isArray(nodeInfo?.errors) ? nodeInfo.errors : []
            for (const nodeErr of errs) {
              const parts = [
                `Node ${nodeId} (${classType})`,
                nodeErr?.type ? `[${nodeErr.type}]` : null,
                nodeErr?.message || null,
                nodeErr?.details ? `— ${nodeErr.details}` : null,
              ].filter(Boolean)
              nodeErrorLines.push(parts.join(' '))
            }
          }
        }

        const extraDetails =
          errorBody && typeof errorBody === 'object'
            ? errorBody.error?.details || errorBody.details || null
            : null

        const message = [
          topMessage,
          nodeErrorLines.length ? nodeErrorLines.join('\n') : null,
          extraDetails && typeof extraDetails === 'string' && !nodeErrorLines.length ? extraDetails : null,
        ]
          .filter(Boolean)
          .join('\n')

        // Detect Comfy partner credit exhaustion at the earliest possible
        // point. Dispatching the event here means any chip/banner anywhere
        // in the UI can flip into the actionable "out of credits" state
        // regardless of which code path triggered the submission.
        const insufficient =
          response.status === 402 ||
          isInsufficientCreditsError({ status: response.status, message, error: errorBody })
        if (insufficient) {
          notifyComfyPartnerCreditsLow({
            status: response.status,
            message,
          })
        }

        try { console.error('[ComfyUI] /prompt error body:', errorBody) } catch (_) { /* ignore */ }

        const err = new Error(message)
        err.status = response.status
        err.insufficientCredits = insufficient
        err.rawBody = errorBody
        err.nodeErrors = (errorBody && typeof errorBody === 'object' && errorBody.node_errors) || null
        throw err
      }

      const result = await response.json();
      this._rememberPromptNodeMeta(result?.prompt_id, workflow);
      return result.prompt_id;
    } catch (error) {
      console.error('Error queuing prompt:', error);
      // Also catch cases where the error string surfaced from deeper in the
      // stack already signalled insufficient funds (e.g. partner node threw
      // after the initial /prompt queue accepted the request).
      if (!error?.insufficientCredits && isInsufficientCreditsError(error)) {
        notifyComfyPartnerCreditsLow({
          status: error?.status ?? null,
          message: error?.message ?? String(error),
        })
      }
      throw error;
    }
  }

  /**
   * Resolve optional Comfy account API key for paid API nodes.
   */
  async getComfyOrgApiKey() {
    try {
      if (typeof window !== 'undefined' && window?.electronAPI?.getSetting) {
        const stored = await window.electronAPI.getSetting(COMFY_ORG_API_KEY_SETTING_KEY)
        const normalized = String(stored || '').trim()
        if (normalized) return normalized
      }
    } catch (_) {
      // Ignore and fall back to localStorage.
    }

    try {
      if (typeof localStorage !== 'undefined') {
        return String(localStorage.getItem(COMFY_ORG_API_KEY_LOCAL_KEY) || '').trim()
      }
    } catch (_) {
      // Ignore storage access errors.
    }
    return ''
  }

  /**
   * Best-effort credit balance lookup for Comfy partner credits.
   * Returns status + optional numeric credits when exposed by backend/API.
   */
  async getComfyOrgCreditBalance() {
    const apiKey = await this.getComfyOrgApiKey()
    if (!apiKey) {
      return {
        status: 'missing-key',
        credits: null,
        source: '',
        error: 'Comfy Partner API key not configured.',
        payload: null,
      }
    }

    const localBase = this.getHttpBase()
    const candidateUrls = [
      `${localBase}/api/user`,
      `${localBase}/api/account`,
      'https://api.comfy.org/api/user',
    ]

    const failures = []
    for (const url of candidateUrls) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 6000)
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'X-API-Key': apiKey,
          },
          signal: controller.signal,
        })
        clearTimeout(timeout)

        if (!response.ok) {
          failures.push({ url, status: response.status, message: `${response.status}` })
          continue
        }

        const payload = await response.json()
        const credits = extractCreditBalanceFromPayload(payload)
        return {
          status: credits === null ? 'available-no-credit-field' : 'ok',
          credits,
          source: url,
          error: '',
          payload,
        }
      } catch (error) {
        failures.push({
          url,
          status: null,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    const statusCodes = failures
      .map((failure) => Number(failure?.status))
      .filter((code) => Number.isFinite(code))
    const hasAuthFailure = statusCodes.some((code) => code === 401 || code === 403)
    const hasNotSupported = statusCodes.length > 0 && statusCodes.every((code) => code === 404 || code === 405)

    if (hasAuthFailure) {
      return {
        status: 'auth-failed',
        credits: null,
        source: '',
        error: 'Credit endpoints rejected the current API key.',
        payload: null,
      }
    }

    if (hasNotSupported) {
      return {
        status: 'not-supported',
        credits: null,
        source: '',
        error: 'Credit balance endpoint is not exposed by this ComfyUI server.',
        payload: null,
      }
    }

    const firstFailure = failures[0] || null
    return {
      status: 'unavailable',
      credits: null,
      source: '',
      error: firstFailure?.message || 'No supported credit endpoint responded.',
      payload: null,
    }
  }

  /**
   * Get history/output for a prompt (or full history if no promptId)
   */
  async getHistory(promptId) {
    try {
      const url = promptId
        ? `${this.getHttpBase()}/history/${promptId}`
        : `${this.getHttpBase()}/history`;
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error('Error getting history:', error);
      throw error;
    }
  }

  /**
   * Get an image/video from ComfyUI output
   */
  getMediaUrl(filename, subfolder = '', type = 'output') {
    const params = new URLSearchParams({
      filename,
      subfolder,
      type
    });
    return `${this.getHttpBase()}/view?${params}`;
  }

  /**
   * Download a video from ComfyUI and return as a File object
   * @param {string} filename - The filename on ComfyUI
   * @param {string} subfolder - The subfolder (usually 'video')
   * @param {string} type - The type (usually 'output')
   * @returns {Promise<File>} - The video as a File object
   */
  async downloadVideo(filename, subfolder = '', type = 'output') {
    const url = this.getMediaUrl(filename, subfolder, type);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download video: ${response.status}`);
      }
      
      const blob = await response.blob();
      const mimeType = blob.type || 'video/mp4';
      
      // Create a File object from the blob
      return new File([blob], filename, { type: mimeType });
    } catch (error) {
      console.error('Error downloading video from ComfyUI:', error);
      throw error;
    }
  }

  /**
   * Interrupt the current generation
   */
  async interrupt() {
    try {
      await fetch(`${this.getHttpBase()}/interrupt`, { method: 'POST' });
    } catch (error) {
      console.error('Error interrupting:', error);
    }
  }

  /**
   * Ask ComfyUI to release cached models and device memory before loading a
   * particularly large workflow. This is best-effort: older ComfyUI builds
   * may not expose /free, in which case generation continues normally.
   */
  async freeMemory({ unloadModels = true, freeMemory = true } = {}) {
    try {
      const response = await fetch(`${this.getHttpBase()}/free`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unload_models: Boolean(unloadModels), free_memory: Boolean(freeMemory) }),
      })
      return response.ok
    } catch (error) {
      console.warn('[ComfyUI] Memory release request skipped:', error?.message)
      return false
    }
  }

  /**
   * Get queue status
   */
  async getQueueStatus() {
    try {
      const response = await fetch(`${this.getHttpBase()}/queue`);
      return await response.json();
    } catch (error) {
      console.error('Error getting queue:', error);
      return { queue_running: [], queue_pending: [] };
    }
  }
  
  /**
   * Upload a file to ComfyUI
   * @param {File|Blob} file - The file to upload
   * @param {string} filename - Optional filename override
   * @param {string} subfolder - Optional subfolder (default: empty)
   * @param {string} type - 'input', 'temp', or 'output' (default: 'input')
   * @returns {Promise<{name: string, subfolder: string, type: string}>}
   */
  async uploadFile(file, filename = null, subfolder = '', type = 'input') {
    await generationMemory.wake()
    generationMemory.activity()
    try {
      const formData = new FormData();
      
      // Use provided filename or file's name
      const uploadFilename = sanitizeUploadFilename(file, filename || file.name || `upload_${Date.now()}`);
      
      // Append the file with the correct filename
      formData.append('image', file, uploadFilename);
      
      if (subfolder) {
        formData.append('subfolder', subfolder);
      }
      formData.append('type', type);
      formData.append('overwrite', 'true');

      const response = await fetch(`${this.getHttpBase()}/upload/image`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to upload file: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('File uploaded to ComfyUI:', result);
      return result;
    } catch (error) {
      console.error('Error uploading file to ComfyUI:', error);
      throw error;
    }
  }

  /**
   * Download an image from ComfyUI and return as a File object
   * @param {string} filename - The filename on ComfyUI
   * @param {string} subfolder - The subfolder
   * @param {string} type - The type (usually 'output')
   * @returns {Promise<File>} - The image as a File object
   */
  async downloadImage(filename, subfolder = '', type = 'output') {
    const url = this.getMediaUrl(filename, subfolder, type);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      
      const blob = await response.blob();
      const mimeType = blob.type || 'image/png';
      
      // Create a File object from the blob
      return new File([blob], filename, { type: mimeType });
    } catch (error) {
      console.error('Error downloading image from ComfyUI:', error);
      throw error;
    }
  }

  /**
   * Download multiple images (PNG sequence) from ComfyUI
   * @param {Array<{filename: string, subfolder: string, type: string}>} images - Array of image info
   * @returns {Promise<File[]>} - Array of File objects
   */
  async downloadImageSequence(images) {
    const files = [];
    for (const img of images) {
      const file = await this.downloadImage(img.filename, img.subfolder || '', img.type || 'output');
      files.push(file);
    }
    return files;
  }

  /**
   * Get detailed prompt execution info for progress tracking
   * This is useful when WebSocket is unavailable
   */
  async getPromptProgress(promptId) {
    try {
      // First check if it's in the queue
      const queueStatus = await this.getQueueStatus();
      
      // Check if it's currently running
      const running = queueStatus.queue_running || [];
      for (const item of running) {
        if (item[1] === promptId) {
          // It's running - try to get progress from history
          const history = await this.getHistory(promptId);
          const promptHistory = history[promptId];
          
          if (promptHistory?.status?.messages) {
            // Parse messages for progress info
            const messages = promptHistory.status.messages;
            for (const msg of messages) {
              if (msg[0] === 'execution_cached') {
                // Some nodes were cached
              }
            }
          }
          
          return { status: 'running', position: 0, promptId };
        }
      }
      
      // Check if it's pending
      const pending = queueStatus.queue_pending || [];
      for (let i = 0; i < pending.length; i++) {
        if (pending[i][1] === promptId) {
          return { status: 'pending', position: i + 1, promptId };
        }
      }
      
      // Check if it's completed
      const history = await this.getHistory(promptId);
      if (history[promptId]) {
        const promptHistory = history[promptId];
        if (promptHistory.outputs && Object.keys(promptHistory.outputs).length > 0) {
          return { status: 'completed', promptId };
        }
        if (promptHistory.status?.status_str === 'error') {
          return { status: 'error', promptId, error: promptHistory.status.messages };
        }
      }
      
      return { status: 'unknown', promptId };
    } catch (error) {
      console.error('Error getting prompt progress:', error);
      return { status: 'error', promptId, error: error.message };
    }
  }
}

// Singleton instance
export const comfyui = new ComfyUIService();

const IMAGE_EXTENSIONS_FOR_MASK_WORKFLOW = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.tif']

/**
 * Heuristic: is `filename` a still image (versus a video)? Used to decide
 * whether the mask workflow should wire up `VHS_LoadVideo` or `LoadImage` for
 * node 8. We only peek at the extension because that's the same signal ComfyUI
 * itself uses to route uploads into `input/` — the file contents have already
 * been validated by the uploader.
 */
function isImageFilenameForMaskWorkflow(filename) {
  const name = String(filename || '').toLowerCase()
  const dot = name.lastIndexOf('.')
  if (dot < 0) return false
  const ext = name.slice(dot)
  return IMAGE_EXTENSIONS_FOR_MASK_WORKFLOW.includes(ext)
}

/**
 * Workflow modifier for Mask Generation (SAM3 + MatAnyone)
 *
 * Workflow nodes:
 * - Node 8 (VHS_LoadVideo OR LoadImage): Load the input video/image
 * - Node 12 (SAM3VideoSegmentation): Text prompt for segmentation
 * - Node 5 (SaveImage): Output filename prefix
 *
 * Why two loader classes: `VHS_LoadVideo` goes through OpenCV's VideoCapture,
 * which can (and does, inconsistently) fail to open single-frame PNG/JPG/WEBP
 * files with a generic `ValueError: ... could not be loaded with cv.` This
 * bites every user who tries to mask a still image — the most common mask-gen
 * use case. The failure surfaces in the app as a useless "Generation failed"
 * banner because the error only lives in ComfyUI's history payload.
 *
 * The fix is the same trick we applied to the caption transcription workflow:
 * inspect the uploaded filename, and if it's an image, rewrite node 8 as a
 * ComfyUI-builtin `LoadImage` (which reads PIL-supported formats natively and
 * returns a 1-frame IMAGE tensor `[1,H,W,C]`). Downstream nodes
 * (`SAM3VideoSegmentation`, `MatAnyoneVideoMatting`) already declare their
 * `video_frames` input as IMAGE, so a 1-frame batch drops right in without
 * re-wiring slots.
 *
 * @param {Object} workflow - The base mask generation workflow
 * @param {Object} options - Configuration options
 * @returns {Object} Modified workflow
 */
export function modifyMaskWorkflow(workflow, options = {}) {
  const {
    inputFilename = '',       // The uploaded filename in ComfyUI
    textPrompt = '',          // What to segment (e.g., "person on the left")
    outputPrefix = 'VelornMask',  // Output filename prefix
    scoreThreshold = 0.04,    // Detection sensitivity (lower = more sensitive)
    frameIdx = 0,             // Which frame to use for initial detection
  } = options;

  // Create a deep copy
  const modified = JSON.parse(JSON.stringify(workflow));

  if (modified['8']) {
    if (isImageFilenameForMaskWorkflow(inputFilename)) {
      // Replace VHS_LoadVideo with LoadImage. Output slot 0 is IMAGE on both
      // classes, so the existing `["8", 0]` references in downstream nodes stay
      // valid. We intentionally drop VHS-specific inputs (force_rate,
      // frame_load_cap, format, etc.) because LoadImage doesn't accept them
      // and ComfyUI will reject the prompt with "extra inputs not allowed".
      modified['8'] = {
        inputs: {
          image: inputFilename,
          // The `upload` hint is how the ComfyUI web client triggers the upload
          // dropzone, but the server ignores it during graph execution. Still,
          // we include it so the workflow matches what ComfyUI exports when a
          // user picks an uploaded image manually.
          upload: 'image',
        },
        class_type: 'LoadImage',
        _meta: {
          title: 'Load Image',
        },
      }
    } else {
      modified['8'].inputs.video = inputFilename;
    }
  }

  // Update text prompt and threshold (node 12 - SAM3VideoSegmentation)
  if (modified['12']) {
    modified['12'].inputs.text_prompt = textPrompt;
    modified['12'].inputs.score_threshold = scoreThreshold;
    modified['12'].inputs.frame_idx = frameIdx;
  }

  // Update output filename prefix (node 5 - SaveImage)
  if (modified['5']) {
    modified['5'].inputs.filename_prefix = outputPrefix;
  }

  return modified;
}

/**
 * Configure the CANVAS MiniMax H3 GGUF image-to-video graph.
 * H3 only accepts frame counts on the 17n+5 grid at 24fps.
 */
export function modifyMinimaxH3GGUFI2VWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    lastImage = '',
    width = 608,
    height = 352,
    duration = 5,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'video/CANVAS_minimax_h3_gguf',
    loraName = '',
    steps = 8,
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const normalizedWidth = Math.max(32, Math.round((Number(width) || 608) / 32) * 32)
  const normalizedHeight = Math.max(32, Math.round((Number(height) || 352) / 32) * 32)
  const requestedFrames = Math.max(5, Math.round((Number(duration) || 5) * 24))
  const length = requestedFrames + ((5 - (requestedFrames % 17)) + 17) % 17
  const isFusedSlaGraph = Object.values(modified).some((entry) => entry?.class_type === 'H3SLAAttention')
  const imageNode = Object.values(modified).find((entry) => entry?.class_type === 'LoadImage')
  const conditioningNode = Object.values(modified).find((entry) => entry?.class_type === 'MiniMaxH3ImageToVideo')
  const noiseNode = Object.values(modified).find((entry) => entry?.class_type === 'RandomNoise')
  const schedulerNode = Object.values(modified).find((entry) => entry?.class_type === 'BasicScheduler')
  const saveNode = Object.values(modified).find((entry) => entry?.class_type === 'SaveVideo')

  if (imageNode?.inputs) imageNode.inputs.image = inputImage
  if (modified['6']?.inputs && loraName) modified['6'].inputs.lora_name = loraName
  if (schedulerNode?.inputs && !isFusedSlaGraph) schedulerNode.inputs.steps = Math.max(1, Math.round(Number(steps) || 8))
  if (conditioningNode?.inputs) {
    conditioningNode.inputs.prompt = String(prompt || '')
    conditioningNode.inputs.width = normalizedWidth
    conditioningNode.inputs.height = normalizedHeight
    conditioningNode.inputs.length = length
    if (lastImage) {
      const lastFrameNodeId = isFusedSlaGraph ? '19' : '18'
      modified[lastFrameNodeId] = {
        inputs: { image: lastImage },
        class_type: 'LoadImage',
        _meta: { title: 'CANVAS Last Frame' },
      }
      conditioningNode.inputs.last_frame = [lastFrameNodeId, 0]
    } else {
      delete conditioningNode.inputs.last_frame
      if (!isFusedSlaGraph) delete modified['18']
      delete modified['19']
    }
  }
  if (noiseNode?.inputs) noiseNode.inputs.noise_seed = seed
  if (saveNode?.inputs) saveNode.inputs.filename_prefix = filenamePrefix

  return modified
}

/**
 * Configure the four-panel MiniMax H3 character-sheet workflow.
 * The underlying 124-frame orbit is decoded only long enough to extract the
 * four sheet views; CANVAS deliberately does not save the intermediate video.
 */
export function modifyMinimaxH3CharacterSheetWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    referenceImages = [],
    width = 480,
    height = 864,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'image/CANVAS_h3_character_sheet',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const normalizedWidth = Math.max(256, Math.round((Number(width) || 480) / 32) * 32)
  const normalizedHeight = Math.max(256, Math.round((Number(height) || 864) / 32) * 32)
  const characterNotes = String(prompt || '').trim()
  const refs = Array.isArray(referenceImages) ? referenceImages.filter(Boolean).slice(0, 2) : []
  const referenceGuide = [
    'Use <Picture 1> as the exact primary character identity.',
    refs[0] ? 'Use <Picture 2> as an additional identity, clothing, and detail reference for the same character.' : '',
    refs[1] ? 'Use <Picture 3> as an additional identity, clothing, and detail reference for the same character.' : '',
  ].filter(Boolean).join(' ')
  const orbitPrompt = [
    characterNotes,
    referenceGuide,
    'From 0 to 2 seconds, the character stands upright in a neutral full-body pose while the camera completes one smooth 360-degree orbit at a constant radius and eye-level height, returning to the front view.',
    'Keep the background plain and lighting stable.',
    'From 2 to 5 seconds, hold the front view and move into a centered head-and-shoulders close-up.',
    'Preserve identity, anatomy, clothing, colors, and accessories in every frame.',
  ].filter(Boolean).join(' ')

  if (modified['1']?.inputs) modified['1'].inputs.image = inputImage
  if (modified['6']?.inputs) {
    modified['6'].inputs.prompt = orbitPrompt
    modified['6'].inputs.width = normalizedWidth
    modified['6'].inputs.height = normalizedHeight
    modified['6'].inputs.length = 124
    modified['6'].inputs['ref_images.ref_image_0'] = ['1', 0]

    for (let index = 0; index < 2; index += 1) {
      const nodeId = `char_ref_${index + 1}`
      const inputKey = `ref_images.ref_image_${index + 1}`
      const filename = refs[index]
      if (filename) {
        modified[nodeId] = {
          inputs: { image: filename, upload: 'image' },
          class_type: 'LoadImage',
          _meta: { title: `CANVAS Character Reference ${index + 2}` },
        }
        modified['6'].inputs[inputKey] = [nodeId, 0]
      } else {
        delete modified[nodeId]
        delete modified['6'].inputs[inputKey]
      }
    }
  }
  if (modified['7']?.inputs) modified['7'].inputs.noise_seed = seed
  if (modified['20']?.inputs) modified['20'].inputs.filename_prefix = filenamePrefix

  return modified
}

/**
 * Workflow modifier for WAN 2.2 14B Image-to-Video
 */
export function modifyWAN22Workflow(workflow, options = {}) {
  const {
    prompt = '',
    negativePrompt = '',
    inputImage = '',      // Filename uploaded to ComfyUI
    width = 800,
    height = 1424,
    frames = 81,
    fps = 16,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'video/Velorn_wan',
    qualityPreset = 'balanced', // balanced | face-lock
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const useFaceLockPreset = String(qualityPreset || 'balanced') === 'face-lock'
  const positivePrompt = String(prompt || '')
  const effectiveNegativePrompt = String(negativePrompt || '')

  const samplerSteps = useFaceLockPreset ? 6 : 4
  const samplerCfg = useFaceLockPreset ? 1.3 : 1
  const splitStep = Math.max(2, Math.floor(samplerSteps / 2))
  const modelShift = useFaceLockPreset ? 4.5 : 5.0
  const loraStrength = useFaceLockPreset ? 1.05 : 1.0
  const numericFps = Math.max(1, Math.round(Number(fps) || 16))
  const numericFrames = Math.max(2, Math.round(Number(frames) || 81))
  const numericDuration = Math.max(0.1, (numericFrames - 1) / numericFps)

  const findNodeId = (predicate) => {
    for (const [nodeId, node] of Object.entries(modified || {})) {
      if (predicate(node, nodeId)) return nodeId
    }
    return null
  }

  const findNodeByClassAndTitle = (classType, titlePattern) => findNodeId((node) => (
    String(node?.class_type || '') === classType
    && titlePattern.test(String(node?._meta?.title || ''))
  ))

  const findPrimitiveByTitle = (titlePattern) => findNodeId((node) => (
    /^Primitive/.test(String(node?.class_type || ''))
    && titlePattern.test(String(node?._meta?.title || ''))
  ))

  const setNodeInput = (nodeId, key, value) => {
    if (!nodeId || !modified[nodeId]?.inputs) return false
    modified[nodeId].inputs[key] = value
    return true
  }

  const setDirectNodeInput = (nodeId, key, value) => {
    if (!nodeId || !modified[nodeId]?.inputs) return false
    if (Array.isArray(modified[nodeId].inputs[key])) return false
    modified[nodeId].inputs[key] = value
    return true
  }

  const positiveNodeId = modified['93']
    ? '93'
    : findNodeByClassAndTitle('CLIPTextEncode', /positive\s*prompt/i)
      || findNodeId((node) => (
        String(node?.class_type || '') === 'CLIPTextEncode'
        && 'text' in (node.inputs || {})
      ))
  const negativeNodeId = modified['89']
    ? '89'
    : findNodeByClassAndTitle('CLIPTextEncode', /negative\s*prompt/i)
  const imageNodeId = modified['97']
    ? '97'
    : findFirstNodeIdByClass(modified, 'LoadImage')
  const wanNodeId = modified['98']
    ? '98'
    : findFirstNodeIdByClass(modified, 'WanImageToVideo')
  const createVideoNodeId = modified['94']
    ? '94'
    : findFirstNodeIdByClass(modified, 'CreateVideo')

  setNodeInput(positiveNodeId, 'text', positivePrompt)
  setNodeInput(negativeNodeId, 'text', effectiveNegativePrompt)
  setNodeInput(imageNodeId, 'image', inputImage)
  setNodeInput(wanNodeId, 'width', width)
  setNodeInput(wanNodeId, 'height', height)
  if (!setDirectNodeInput(wanNodeId, 'length', numericFrames)) {
    setNodeInput(findPrimitiveByTitle(/\bduration\b/i), 'value', numericDuration)
  }
  if (!setDirectNodeInput(createVideoNodeId, 'fps', numericFps)) {
    setNodeInput(findPrimitiveByTitle(/\bfps\b/i), 'value', numericFps)
  }
  // Seed (node 86 - KSamplerAdvanced 1st pass)
  if (modified['86']) {
    modified['86'].inputs.noise_seed = seed
    modified['86'].inputs.steps = samplerSteps
    modified['86'].inputs.cfg = samplerCfg
    modified['86'].inputs.start_at_step = 0
    modified['86'].inputs.end_at_step = splitStep
  }
  // Seed + sampler tuning (node 85 - KSamplerAdvanced 2nd pass)
  if (modified['85']) {
    modified['85'].inputs.noise_seed = seed
    modified['85'].inputs.steps = samplerSteps
    modified['85'].inputs.cfg = samplerCfg
    modified['85'].inputs.start_at_step = splitStep
    modified['85'].inputs.end_at_step = samplerSteps
  }
  for (const [, node] of Object.entries(modified)) {
    if (node?.class_type !== 'KSamplerAdvanced' || !node.inputs) continue
    if ('noise_seed' in node.inputs && node.inputs.add_noise === 'enable') {
      node.inputs.noise_seed = seed
    }
    if (!Array.isArray(node.inputs.steps) && !modified['85'] && !modified['86']) {
      node.inputs.steps = samplerSteps
    }
    if (!Array.isArray(node.inputs.cfg) && !modified['85'] && !modified['86']) {
      node.inputs.cfg = samplerCfg
    }
  }
  // LoRA strength tuning (nodes 101/102)
  if (modified['101']) {
    modified['101'].inputs.strength_model = loraStrength
  }
  if (modified['102']) {
    modified['102'].inputs.strength_model = loraStrength
  }
  // Model sampling shift tuning (nodes 103/104)
  if (modified['103']) {
    modified['103'].inputs.shift = modelShift
  }
  if (modified['104']) {
    modified['104'].inputs.shift = modelShift
  }
  // Output prefix (node 108)
  if (modified['108']) {
    modified['108'].inputs.filename_prefix = filenamePrefix
  }

  return modified
}

/**
 * Workflow modifier for LTX 2.3 Image-to-Video
 */
export function modifyLTX23I2VWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    negativePrompt = '',
    inputImage = '',
    width = 1080,
    height = 1920,
    duration,
    frames,
    fps = 24,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'video/ltx23_i2v',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const numericWidth = Math.max(256, Math.round(Number(width) || 1080))
  const numericHeight = Math.max(256, Math.round(Number(height) || 1920))
  const numericFps = Math.max(1, Math.round(Number(fps) || 24))
  // This graph computes the frame count internally from duration(seconds) * fps,
  // so it wants seconds. Prefer an explicit duration; otherwise derive seconds
  // from a legacy frames count (callers still pass frames).
  let numericDuration = Number(duration)
  if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
    const numericFrames = Number(frames)
    numericDuration = (Number.isFinite(numericFrames) && numericFrames > 1)
      ? (numericFrames - 1) / numericFps
      : 5
  }
  numericDuration = Math.max(1, Math.round(numericDuration))
  const numericSeed = Math.round(Number(seed) || Math.floor(Math.random() * 1000000000000))
  const effectiveNegativePrompt = String(negativePrompt || '')

  const nodes = Object.values(modified)
  const findByTitle = (title) => nodes.find((node) => String(node?._meta?.title || '').trim() === title)
  const imageNode = nodes.find((node) => node?.class_type === 'LoadImage')
  const promptNode = nodes.find((node) => (
    node?.class_type === 'PrimitiveStringMultiline'
    && String(node?._meta?.title || '').trim() === 'Prompt'
  ))
  const negativeNode = nodes.find((node) => (
    node?.class_type === 'CLIPTextEncode'
    && typeof node?.inputs?.text === 'string'
  ))

  // Resolve controls by their stable titles. The bundled LTX graph has moved
  // between 320:* and 340:* node ids across ComfyUI releases.
  if (inputImage && imageNode?.inputs) imageNode.inputs.image = inputImage
  if (prompt && promptNode?.inputs) promptNode.inputs.value = prompt
  if (negativeNode?.inputs) negativeNode.inputs.text = effectiveNegativePrompt
  const widthNode = findByTitle('Width')
  const heightNode = findByTitle('Height')
  const fpsNode = findByTitle('Frame Rate')
  const durationNode = findByTitle('Duration')
  if (widthNode?.inputs) widthNode.inputs.value = numericWidth
  if (heightNode?.inputs) heightNode.inputs.value = numericHeight
  if (fpsNode?.inputs) fpsNode.inputs.value = numericFps
  if (durationNode?.inputs) durationNode.inputs.value = numericDuration
  for (const node of nodes) {
    if (node?.class_type === 'RandomNoise' && node.inputs && 'noise_seed' in node.inputs) {
      node.inputs.noise_seed = numericSeed
    }
  }

  for (const node of Object.values(modified)) {
    if (node?.class_type === 'SaveVideo' && node.inputs && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix
    }
  }

  return modified
}

/**
 * LTX 2.3 native audio-driven image-to-video with the exact source waveform.
 *
 * The persisted workflow id retains its historical "latentsync" name, but the
 * current anime-safe route no longer injects the third-party LatentSync node
 * (whose own documentation excludes anime/cartoon faces). Instead, the source
 * audio latent is frozen during LTX sampling so it drives the generated video,
 * and the original TTS waveform is muxed into the final output unchanged.
 */
export function modifyLTX23LatentSyncWorkflow(workflow, options = {}) {
  const {
    inputAudio = '',
    ...i2vOptions
  } = options

  if (!inputAudio) {
    throw new Error('Exact Audio lip-sync needs a completed TTS audio clip.')
  }

  const modified = modifyLTX23I2VWorkflow(workflow, i2vOptions)
  const entries = Object.entries(modified)
  const findEntry = (predicate) => entries.find(([, node]) => predicate(node))
  const loadAudioEntry = findEntry((node) => node?.class_type === 'LoadAudio')
  const audioVaeEntry = findEntry((node) => node?.class_type === 'LTXVAudioVAELoader')
  const referenceAudioEntry = findEntry((node) => node?.class_type === 'LTXVReferenceAudio')
  const conditioningEntry = findEntry((node) => node?.class_type === 'LTXVConditioning')
  const createVideoEntry = findEntry((node) => node?.class_type === 'CreateVideo')
  const firstConcatEntry = entries.find(([, node]) => (
    node?.class_type === 'LTXVConcatAVLatent'
    && Array.isArray(node?.inputs?.audio_latent)
    && modified[node.inputs.audio_latent[0]]?.class_type === 'LTXVEmptyLatentAudio'
  ))
  const guiderEntry = entries.find(([, node]) => (
    node?.class_type === 'CFGGuider'
    && Array.isArray(node?.inputs?.model)
    && node.inputs.model[0] === referenceAudioEntry?.[0]
  ))

  if (!loadAudioEntry || !audioVaeEntry || !referenceAudioEntry || !conditioningEntry || !createVideoEntry || !firstConcatEntry || !guiderEntry) {
    throw new Error('Exact Audio lip-sync could not resolve the required LTX 2.3 audio-conditioning nodes.')
  }

  const [loadAudioId, loadAudioNode] = loadAudioEntry
  const [audioVaeId] = audioVaeEntry
  const [referenceAudioId, referenceAudioNode] = referenceAudioEntry
  const [, conditioningNode] = conditioningEntry
  const [, createVideoNode] = createVideoEntry
  const [, firstConcatNode] = firstConcatEntry
  const [, guiderNode] = guiderEntry
  const sourceModel = Array.isArray(referenceAudioNode?.inputs?.model)
    ? [...referenceAudioNode.inputs.model]
    : null
  if (!sourceModel) {
    throw new Error('Exact Audio lip-sync could not resolve the LTX model input.')
  }

  loadAudioNode.inputs.audio = inputAudio
  delete loadAudioNode.inputs.audioUI

  const encodedAudioId = 'lumeweft_exact_audio_encode'
  const frozenAudioId = 'lumeweft_exact_audio_conditioning'
  modified[encodedAudioId] = {
    inputs: {
      audio: [loadAudioId, 0],
      audio_vae: [audioVaeId, 0],
    },
    class_type: 'LTXVAudioVAEEncode',
    _meta: { title: 'Encode Final TTS Audio' },
  }
  modified[frozenAudioId] = {
    inputs: {
      positive: [...referenceAudioNode.inputs.positive],
      negative: [...referenceAudioNode.inputs.negative],
      audio_latent: [encodedAudioId, 0],
    },
    class_type: 'LTXVSetAudioRefTokens',
    _meta: { title: 'Freeze Exact Audio for LTX Video' },
  }

  guiderNode.inputs.model = sourceModel
  conditioningNode.inputs.positive = [frozenAudioId, 0]
  conditioningNode.inputs.negative = [frozenAudioId, 1]
  firstConcatNode.inputs.audio_latent = [frozenAudioId, 2]
  createVideoNode.inputs.audio = [loadAudioId, 0]
  delete modified[referenceAudioId]

  // TalkVid's identity adapter belongs to the reference-voice route. The
  // frozen-audio route uses the base model with its existing distillation LoRA.
  for (const [nodeId, node] of Object.entries(modified)) {
    if (node?.class_type !== 'LoraLoaderModelOnly'
      || String(node.inputs?.lora_name || '').replace(/\\/g, '/').split('/').pop() !== 'ltx-2.3-id-lora-talkvid-3k.safetensors') continue
    const modelInput = node.inputs.model
    if (!Array.isArray(modelInput)) throw new Error('Exact Audio could not resolve the model before the TalkVid adapter.')
    for (const consumer of Object.values(modified)) {
      for (const [key, value] of Object.entries(consumer?.inputs || {})) {
        if (Array.isArray(value) && value[0] === nodeId) consumer.inputs[key] = [...modelInput]
      }
    }
    delete modified[nodeId]
  }

  return modified
}

/**
 * Workflow modifier for LTX 2.3 Image + Audio-to-Video.
 */
export function modifyLTX23IA2VWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    negativePrompt = '',
    inputImage = '',
    inputAudio = '',
    width = 1280,
    height = 720,
    duration = 9,
    fps = 24,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'video/ltx23_ia2v',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const numericWidth = Math.max(256, Math.round(Number(width) || 1280))
  const numericHeight = Math.max(256, Math.round(Number(height) || 720))
  const numericDuration = Math.max(1, Number(duration) || 9)
  const numericFps = Math.max(1, Math.round(Number(fps) || 24))
  const numericSeed = Math.round(Number(seed) || Math.floor(Math.random() * 1000000000000))
  const effectiveNegativePrompt = String(negativePrompt || '')

  for (const imageNodeId of ['269', '345']) {
    if (modified[imageNodeId]?.inputs && inputImage) {
      modified[imageNodeId].inputs.image = inputImage
    }
  }

  for (const audioNodeId of ['276', '346']) {
    if (modified[audioNodeId]?.inputs && inputAudio) {
      modified[audioNodeId].inputs.audio = inputAudio
      delete modified[audioNodeId].inputs.audioUI
    }
  }

  if (modified['340:319']?.inputs && 'value' in modified['340:319'].inputs) {
    modified['340:319'].inputs.value = prompt
  }

  if (modified['340:314']?.inputs && 'text' in modified['340:314'].inputs) {
    modified['340:314'].inputs.text = effectiveNegativePrompt
  }

  if (modified['340:330']?.inputs && 'value' in modified['340:330'].inputs) {
    modified['340:330'].inputs.value = numericWidth
  }

  if (modified['340:324']?.inputs && 'value' in modified['340:324'].inputs) {
    modified['340:324'].inputs.value = numericHeight
  }

  if (modified['340:331']?.inputs && 'value' in modified['340:331'].inputs) {
    modified['340:331'].inputs.value = numericDuration
  }

  if (modified['340:323']?.inputs && 'value' in modified['340:323'].inputs) {
    modified['340:323'].inputs.value = numericFps
  }

  if (modified['340:305']?.inputs && 'value' in modified['340:305'].inputs) {
    modified['340:305'].inputs.value = false
  }

  if (modified['340:285']?.inputs && 'noise_seed' in modified['340:285'].inputs) {
    modified['340:285'].inputs.noise_seed = numericSeed
  }

  if (modified['340:286']?.inputs && 'noise_seed' in modified['340:286'].inputs) {
    modified['340:286'].inputs.noise_seed = (numericSeed + 1000003) >>> 0
  }

  if (modified['341']?.inputs && 'filename_prefix' in modified['341'].inputs) {
    modified['341'].inputs.filename_prefix = filenamePrefix
  }

  return modified
}

/**
 * Workflow modifier for LTX 2.3 ID-LoRA lip-sync (image + reference audio ->
 * talking video). Unlike modifyLTX23IA2VWorkflow, this graph uses the TalkVid
 * ID-LoRA + LTXVReferenceAudio node to condition voice identity/performance;
 * the target words are supplied in the prompt's [SPEECH] field. Control node ids come from
 * public/workflows/video_ltx2_3_id_lora.json:
 *   269 LoadImage, 276 LoadAudio, 340:319 prompt, 340:314 negative,
 *   340:330 width, 340:324 height, 340:323 fps, 340:331 duration (seconds),
 *   340:285 / 340:286 seeds.
 */
export function modifyLTX23IdLoraWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    negativePrompt = '',
    inputImage = '',
    inputAudio = '',
    width = 720,
    height = 1280,
    duration = 5,
    fps = 24,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'video/ltx23_id_lora',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const numericWidth = Math.max(256, Math.round(Number(width) || 720))
  const numericHeight = Math.max(256, Math.round(Number(height) || 1280))
  const numericDuration = Math.max(1, Number(duration) || 5)
  const numericFps = Math.max(1, Math.round(Number(fps) || 24))
  const numericSeed = Math.round(Number(seed) || Math.floor(Math.random() * 1000000000000))
  const effectiveNegativePrompt = String(negativePrompt || '')

  const setInput = (nodeId, key, value) => {
    if (modified[nodeId]?.inputs && key in modified[nodeId].inputs) modified[nodeId].inputs[key] = value
  }

  if (inputImage) setInput('269', 'image', inputImage)
  if (inputAudio && modified['276']?.inputs) {
    modified['276'].inputs.audio = inputAudio
    delete modified['276'].inputs.audioUI
  }
  if (prompt) setInput('340:319', 'value', prompt)
  setInput('340:314', 'text', effectiveNegativePrompt)
  setInput('340:330', 'value', numericWidth)
  setInput('340:324', 'value', numericHeight)
  setInput('340:323', 'value', numericFps)
  setInput('340:331', 'value', numericDuration)
  setInput('340:285', 'noise_seed', numericSeed)
  setInput('340:286', 'noise_seed', (numericSeed + 1000003) >>> 0)

  for (const node of Object.values(modified)) {
    if (node?.class_type === 'SaveVideo' && node.inputs && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix
    }
  }

  return modified
}

/**
 * Workflow modifier for 1-Click Multiple Angles (Qwen Image Edit)
 * Generates 8 camera angles from a single image
 */
export function modifyMultipleAnglesWorkflow(workflow, options = {}) {
  const {
    inputImage = '',      // Filename uploaded to ComfyUI
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = '',
    // Allow overriding individual angle prompts
    prompts = {},
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))

  // Image input (node 25)
  if (modified['25']) {
    modified['25'].inputs.image = inputImage
  }

  // Default angle prompts
  const defaultPrompts = {
    closeUp:  '<sks> front view eye-level shot close-up',
    wide:     '<sks> front view eye-level shot wide shot',
    right45:  '<sks> front-right quarter view eye-level shot medium shot',
    right90:  '<sks> right side view eye-level shot medium shot',
    aerial:   '<sks> front view high-angle shot medium shot',
    lowAngle: '<sks> front view low-angle shot medium shot',
    left45:   '<sks> front-left quarter view eye-level shot medium shot',
    left90:   '<sks> left side view eye-level shot medium shot',
  }

  // Prompt node mapping: angle key -> node ID
  const promptNodes = {
    closeUp:  '66',
    wide:     '67',
    right45:  '69',
    right90:  '68',
    aerial:   '70',
    lowAngle: '71',
    left45:   '73',
    left90:   '72',
  }

  // KSampler node mapping for seeds
  const seedNodes = [
    '65:33:21', '65:35:21', '65:37:21', '65:39:21',
    '65:40:21', '65:42:21', '65:44:21', '65:46:21',
  ]

  // Update prompts
  for (const [key, nodeId] of Object.entries(promptNodes)) {
    if (modified[nodeId]) {
      modified[nodeId].inputs.value = prompts[key] || defaultPrompts[key]
    }
  }

  // Update seeds (same seed for consistency, or random per angle)
  for (const nodeId of seedNodes) {
    if (modified[nodeId]) {
      modified[nodeId].inputs.seed = seed
    }
  }

  // Give every persistent output the CANVAS run prefix.
  const saveNodes = { '31': 'close_up', '34': 'wide_shot', '36': '45_right', '38': '90_right', '47': '90_left', '41': 'aerial_view', '43': 'low_angle', '45': '45_left' }
  for (const [nodeId, suffix] of Object.entries(saveNodes)) {
    if (modified[nodeId]) {
      modified[nodeId].inputs.filename_prefix = filenamePrefix
        ? `${filenamePrefix}_${suffix}`
        : `Lumeweft-${suffix}`
    }
  }

  return modified
}

/**
 * Generic modifier for user-supplied music-video keyframe workflows.
 *
 * Contract:
 * - Required node titles:
 *   VELORN_PROMPT, VELORN_OUTPUT_IMAGE
 * - Optional node titles:
 *   VELORN_INPUT_IMAGE, VELORN_SEED, VELORN_WIDTH, VELORN_HEIGHT,
 *   VELORN_REFERENCE_IMAGE_1, VELORN_REFERENCE_IMAGE_2
 */
export function modifyCustomKeyframeWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    seed = Math.floor(Math.random() * 1000000000000),
    width = null,
    height = null,
    referenceImages = [],
    filenamePrefix = 'image/custom_keyframe',
    requireInputImage = true,
    requirePrompt = true,
    validateOptionalEndpoints = true,
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const validation = validateCustomKeyframeWorkflow(modified, {
    requireInputImage,
    requirePrompt,
    validateOptionalEndpoints,
  })
  if (!validation.ok) {
    throw new Error(validation.message || 'Custom keyframe workflow is missing required endpoints.')
  }

  const endpoints = findCustomKeyframeEndpointNodes(modified)
  if (endpoints.inputImage && (inputImage || requireInputImage)) {
    setEndpointValue(endpoints.inputImage.node, inputImage, ['image'])
  }
  if (endpoints.prompt && (prompt || requirePrompt)) {
    setEndpointValue(endpoints.prompt.node, prompt, ['value', 'prompt', 'text', 'string'])
  }
  if (endpoints.seed && seed !== null && seed !== undefined) {
    setEndpointValue(endpoints.seed.node, seed, ['seed', 'noise_seed', 'value'])
  }
  if (endpoints.width && Number(width) > 0) setEndpointValue(endpoints.width.node, Number(width), ['width', 'value'])
  if (endpoints.height && Number(height) > 0) setEndpointValue(endpoints.height.node, Number(height), ['height', 'value'])

  const ref1 = Array.isArray(referenceImages) ? referenceImages[0] : null
  const ref2 = Array.isArray(referenceImages) ? referenceImages[1] : null
  if (ref1 && endpoints.referenceImage1) setEndpointValue(endpoints.referenceImage1.node, ref1, ['image'])
  if (ref2 && endpoints.referenceImage2) setEndpointValue(endpoints.referenceImage2.node, ref2, ['image'])

  if (endpoints.outputImage?.node?.inputs && 'filename_prefix' in endpoints.outputImage.node.inputs) {
    endpoints.outputImage.node.inputs.filename_prefix = filenamePrefix || endpoints.outputImage.node.inputs.filename_prefix || 'image/custom_keyframe'
  }

  normalizeComfyStudioOutputResize(modified)

  return modified
}

/**
 * Generic modifier for user-supplied music-video workflows.
 *
 * Contract:
 * - Required node titles:
 *   VELORN_INPUT_IMAGE, VELORN_PROMPT, VELORN_OUTPUT_VIDEO
 * - Optional node titles:
 *   VELORN_SEED, VELORN_WIDTH, VELORN_HEIGHT,
 *   VELORN_FPS, VELORN_DURATION, VELORN_AUDIO
 */
export function modifyCustomVideoWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    inputAudio = '',
    seed = Math.floor(Math.random() * 1000000000000),
    width = null,
    height = null,
    fps = null,
    duration = null,
    filenamePrefix = 'video/custom_music',
    requireInputImage = true,
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const validation = validateCustomVideoWorkflow(modified, { requireInputImage })
  if (!validation.ok) {
    throw new Error(validation.message || 'Custom video workflow is missing required endpoints.')
  }

  const endpoints = findCustomVideoEndpointNodes(modified)
  if (endpoints.inputImage && (inputImage || requireInputImage)) {
    setEndpointValue(endpoints.inputImage.node, inputImage, ['image'])
  }
  setEndpointValue(endpoints.prompt?.node, prompt, ['value', 'prompt', 'text', 'string'])
  if (endpoints.inputAudio && inputAudio) {
    setEndpointValue(endpoints.inputAudio.node, inputAudio, ['audio', 'file', 'filename', 'value'])
  }
  if (endpoints.seed) setEndpointValue(endpoints.seed.node, seed, ['seed', 'noise_seed', 'value'])
  if (endpoints.width && Number(width) > 0) setEndpointValue(endpoints.width.node, Number(width), ['width', 'value'])
  if (endpoints.height && Number(height) > 0) setEndpointValue(endpoints.height.node, Number(height), ['height', 'value'])
  if (endpoints.fps && Number(fps) > 0) setEndpointValue(endpoints.fps.node, Number(fps), ['fps', 'frame_rate', 'value'])
  if (endpoints.duration && Number(duration) > 0) setEndpointValue(endpoints.duration.node, Number(duration), ['duration', 'seconds', 'length', 'value'])
  if (endpoints.outputVideo?.node?.inputs && 'filename_prefix' in endpoints.outputVideo.node.inputs) {
    endpoints.outputVideo.node.inputs.filename_prefix = filenamePrefix || endpoints.outputVideo.node.inputs.filename_prefix || 'video/custom_music'
  }

  normalizeComfyStudioOutputResize(modified)

  return modified
}

/**
 * Workflow modifier for Image Edit (Qwen 2509)
 * Finds nodes by class_type / _meta.title so it works with exported API workflow.
 * Optional referenceImages: [filename1?, filename2?] – add LoadImage nodes and wire image2/image3 when present.
 */
export function modifyQwenImageEdit2509Workflow(workflow, options = {}) {
  const {
    prompt = 'edit the image',
    inputImage = '',
    seed = Math.floor(Math.random() * 1000000000000),
    width = null,
    height = null,
    referenceImages = [],
    maskImage = '',
    filenamePrefix = '',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  if (Number(width) > 0 && Number(height) > 0) {
    addQwenImageEditResolutionControls(modified, { width, height })
  }
  const ref1 = referenceImages[0]
  const ref2 = referenceImages[1]
  const hasDedicatedModelAndProductLoaders = Object.values(modified).some((node) => {
    if (!node || typeof node !== 'object') return false
    if (node.class_type !== 'LoadImage' || !node.inputs || !('image' in node.inputs)) return false
    const title = String(node?._meta?.title || '')
    return /load\s*model/i.test(title)
  }) && Object.values(modified).some((node) => {
    if (!node || typeof node !== 'object') return false
    if (node.class_type !== 'LoadImage' || !node.inputs || !('image' in node.inputs)) return false
    const title = String(node?._meta?.title || '')
    return /load\s*product/i.test(title)
  })

  for (const node of Object.values(modified)) {
    if (!node || typeof node !== 'object') continue
    const title = (node._meta && node._meta.title) ? String(node._meta.title) : ''
    const cls = node.class_type || ''

    // Main image handling:
    // - default workflows: set main LoadImage from inputImage
    // - model/product workflow: map dedicated loaders from model + product refs
    if (cls === 'LoadImage' && node.inputs && 'image' in node.inputs) {
      if (hasDedicatedModelAndProductLoaders) {
        if (/load\s*model/i.test(title)) {
          const modelImage = inputImage || ref2 || ref1
          if (modelImage) node.inputs.image = modelImage
        } else if (/load\s*product/i.test(title)) {
          const productImage = ref1 || ref2 || inputImage
          if (productImage) node.inputs.image = productImage
        } else if (inputImage) {
          node.inputs.image = inputImage
        }
      } else {
        node.inputs.image = inputImage
      }
    }
    // Text prompt: node with string/prompt/text or value (only if node looks like a prompt node)
    if (node.inputs) {
      const key = ['prompt', 'text', 'string'].find(k => k in node.inputs)
      const valueKey = (key === undefined && 'value' in node.inputs && (title.includes('Prompt') || cls.includes('Prompt'))) ? 'value' : null
      if (key) node.inputs[key] = prompt
      else if (valueKey) node.inputs[valueKey] = prompt
    }
    // Seed: apply to edit-specific nodes and sampler nodes.
    // The 2509 workflows use KSampler seed directly, so this must be updated per take.
    const isSeedTargetNode = (
      title.includes('Image Edit') ||
      title.includes('Qwen') ||
      cls.includes('Edit') ||
      cls === 'KSampler' ||
      title.includes('KSampler') ||
      cls.includes('Sampler')
    )
    if (node.inputs && 'seed' in node.inputs && isSeedTargetNode) {
      node.inputs.seed = seed
    }
    // Save Image: set prefix
    if (cls === 'SaveImage' && node.inputs && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'image/Velorn_edit'
    }
  }

  // Optional reference images: default qwen-edit workflows wire refs into image2/image3.
  // Dedicated model/product workflows already consume refs via their own loader nodes.
  if (!hasDedicatedModelAndProductLoaders) {
    if (ref1) {
      modified['ref_img_1'] = {
        class_type: 'LoadImage',
        inputs: { image: ref1 },
        _meta: { title: 'Load Image (ref 1)' },
      }
    }
    if (ref2) {
      modified['ref_img_2'] = {
        class_type: 'LoadImage',
        inputs: { image: ref2 },
        _meta: { title: 'Load Image (ref 2)' },
      }
    }
    // Wire refs into node that accepts them (e.g. TextEncodeQwenImageEditPlus).
    // Export often omits image2/image3 when unconnected, so set them if we have refs.
    for (const node of Object.values(modified)) {
      if (!node?.inputs) continue
      const hasImage1 = 'image1' in node.inputs
      const isQwenEdit = (node.class_type === 'TextEncodeQwenImageEditPlus') || ((node._meta?.title || '').includes('Image Edit') && hasImage1)
      if (!isQwenEdit) continue
      if (ref1) node.inputs.image2 = ['ref_img_1', 0]
      if (ref2) node.inputs.image3 = ['ref_img_2', 0]
    }
  }

  // Optional masked edit: Qwen produces the requested edit, then core ComfyUI
  // nodes composite only the white mask area over the scaled source image.
  // This keeps every unmasked pixel from the original character image intact.
  if (maskImage && !hasDedicatedModelAndProductLoaders) {
    const primaryLoadEntry = Object.entries(modified).find(([, node]) => (
      node?.class_type === 'LoadImage'
      && node?.inputs?.image === inputImage
      && !/ref|mask/i.test(String(node?._meta?.title || ''))
    ))
    const primaryLoadId = primaryLoadEntry?.[0] || ''
    const scaledSourceEntry = Object.entries(modified).find(([, node]) => (
      node?.class_type === 'FluxKontextImageScale'
      && Array.isArray(node?.inputs?.image)
      && (!primaryLoadId || node.inputs.image[0] === primaryLoadId)
    ))
    const sourceImageOutput = scaledSourceEntry
      ? [scaledSourceEntry[0], 0]
      : (primaryLoadId ? [primaryLoadId, 0] : null)

    if (sourceImageOutput) {
      modified['canvas_inpaint_mask_image'] = {
        class_type: 'LoadImage',
        inputs: { image: maskImage },
        _meta: { title: 'CANVAS Inpaint Mask' },
      }
      modified['canvas_inpaint_mask'] = {
        class_type: 'ImageToMask',
        inputs: {
          image: ['canvas_inpaint_mask_image', 0],
          channel: 'red',
        },
        _meta: { title: 'CANVAS Inpaint Mask (white = replace)' },
      }

      let compositeIndex = 0
      for (const node of Object.values(modified)) {
        if (node?.class_type !== 'SaveImage' || !Array.isArray(node?.inputs?.images)) continue
        const generatedImageOutput = [...node.inputs.images]
        const compositeId = `canvas_inpaint_composite_${compositeIndex}`
        compositeIndex += 1
        modified[compositeId] = {
          class_type: 'ImageCompositeMasked',
          inputs: {
            destination: sourceImageOutput,
            source: generatedImageOutput,
            x: 0,
            y: 0,
            resize_source: true,
            mask: ['canvas_inpaint_mask', 0],
          },
          _meta: { title: 'CANVAS Masked Inpaint Composite' },
        }
        node.inputs.images = [compositeId, 0]
      }
    }
  }

  // PreviewImage duplicates the eight SaveImage results in ComfyUI's temp
  // output and history. Remove those terminal nodes before queueing so only
  // the eight persistent training images are produced.
  for (const [nodeId, node] of Object.entries(modified)) {
    if (node?.class_type === 'PreviewImage') delete modified[nodeId]
  }

  return modified
}

function resolveImageAspectRatioLabel(width, height) {
  const ratio = resolveClosestAspectRatio(width, height)
  if (ratio === '1:1') return '1:1 (Square)'
  if (ratio === '16:9') return '16:9 (Widescreen)'
  if (ratio === '9:16') return '9:16 (Portrait)'
  if (ratio === '4:3') return '4:3'
  if (ratio === '3:4') return '3:4'
  return '1:1 (Square)'
}

function isLikelyNegativePromptText(text = '') {
  return /(blurry|low quality|watermark|bad anatomy|distorted|ugly|cartoon|oversaturated|logo|extra fingers)/i.test(String(text || ''))
}

/**
 * Generic modifier for local API-format ComfyUI workflows with standard
 * prompt/image/video/seed/size controls.
 */
export function modifyLocalApiWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    negativePrompt = '',
    inputImage = '',
    inputVideo = '',
    width = 1024,
    height = 1024,
    duration = 5,
    fps = 24,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = '',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const numericWidth = Math.max(256, Math.round(Number(width) || 1024))
  const numericHeight = Math.max(256, Math.round(Number(height) || 1024))
  const numericFps = Math.max(1, Math.round(Number(fps) || 24))
  const numericDuration = Math.max(1, Number(duration) || 5)
  const frameCount = Math.round(numericDuration * numericFps) + 1

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue
    const cls = String(node.class_type || '')
    const title = String(node?._meta?.title || '')
    const lowerTitle = title.toLowerCase()

    if (inputImage && cls === 'LoadImage' && 'image' in node.inputs) {
      node.inputs.image = inputImage
    }
    if (inputVideo && cls === 'LoadVideo' && 'file' in node.inputs) {
      node.inputs.file = inputVideo
    }

    if (cls === 'SaveImage' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'image/velorn_local'
    }
    if (cls === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'video/velorn_local'
    }

    if (cls === 'CLIPTextEncode' && typeof node.inputs.text === 'string') {
      if (lowerTitle.includes('negative') || isLikelyNegativePromptText(node.inputs.text)) {
        node.inputs.text = negativePrompt
      } else {
        node.inputs.text = prompt
      }
    }
    if (cls === 'TextEncodeQwenImageEdit' && typeof node.inputs.prompt === 'string') {
      node.inputs.prompt = node.inputs.prompt.trim() ? prompt : negativePrompt
    }
    if (cls === 'PrimitiveStringMultiline' && 'value' in node.inputs && /prompt/i.test(title)) {
      node.inputs.value = prompt
    }

    if ('seed' in node.inputs && (cls.includes('Sampler') || cls.includes('TextEncode') || title.includes('KSampler'))) {
      node.inputs.seed = seed
    }
    if ('noise_seed' in node.inputs && (
      cls === 'RandomNoise' ||
      title.includes('RandomNoise') ||
      (cls.includes('Sampler') && node.inputs.add_noise !== 'disable')
    )) {
      node.inputs.noise_seed = seed
    }

    if (cls === 'ResolutionSelector') {
      if ('aspect_ratio' in node.inputs) node.inputs.aspect_ratio = resolveImageAspectRatioLabel(numericWidth, numericHeight)
      if ('megapixels' in node.inputs) node.inputs.megapixels = Math.max(0.5, Math.round((numericWidth * numericHeight) / 100000) / 10)
    }

    const canSetDirectSize = (
      cls.includes('Empty') ||
      cls.includes('Latent') ||
      cls.includes('Scheduler')
    )
    if (canSetDirectSize && typeof node.inputs.width === 'number') node.inputs.width = numericWidth
    if (canSetDirectSize && typeof node.inputs.height === 'number') node.inputs.height = numericHeight
    if (cls === 'PrimitiveInt' && lowerTitle === 'width' && 'value' in node.inputs) node.inputs.value = numericWidth
    if (cls === 'PrimitiveInt' && lowerTitle === 'height' && 'value' in node.inputs) node.inputs.value = numericHeight

    if ((cls === 'PrimitiveFloat' || cls === 'PrimitiveInt') && /frame rate|fps/i.test(title) && 'value' in node.inputs) {
      node.inputs.value = numericFps
    }
    if ((cls === 'PrimitiveFloat' || cls === 'PrimitiveInt') && /duration/i.test(title) && 'value' in node.inputs) {
      node.inputs.value = numericDuration
    }
    if (cls === 'CreateVideo' && typeof node.inputs.fps === 'number') {
      node.inputs.fps = numericFps
    }
    if (cls === 'HunyuanVideo15ImageToVideo' && 'length' in node.inputs) {
      node.inputs.length = frameCount
    }
  }

  return modified
}

export function modifyFrameInterpolationWorkflow(workflow, options = {}) {
  const {
    inputVideo = '',
    interpolationMultiplier = 4,
    enableFpsMultiplier = false,
    filenamePrefix = 'video/frame_interpolation',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const safeMultiplier = Math.max(2, Math.min(16, Math.round(Number(interpolationMultiplier) || 4)))

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue
    const cls = String(node.class_type || '')
    const title = String(node?._meta?.title || '')

    if (inputVideo && cls === 'LoadVideo' && 'file' in node.inputs) {
      node.inputs.file = inputVideo
    }
    if (cls === 'PrimitiveInt' && /multiplier/i.test(title) && 'value' in node.inputs) {
      node.inputs.value = safeMultiplier
    }
    if (cls === 'PrimitiveBoolean' && /apply multiplier to fps/i.test(title) && 'value' in node.inputs) {
      node.inputs.value = Boolean(enableFpsMultiplier)
    }
    if (cls === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix
    }
  }

  return modified
}

/**
 * Workflow modifier for Z Image Turbo (text-to-image).
 * Sets prompt on CLIPTextEncode and seed on KSampler.
 */
export function modifyZImageTurboWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    seed = Math.floor(Math.random() * 1000000000000),
    width = 1024,
    height = 1024,
    variantCount = 1,
    filenamePrefix = '',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const numericWidth = Math.max(256, Math.round(Number(width) || 1024))
  const numericHeight = Math.max(256, Math.round(Number(height) || 1024))
  const safeVariantCount = Math.max(1, Math.min(10, Math.round(Number(variantCount) || 1)))

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue
    if (node.class_type === 'CLIPTextEncode' && (node._meta?.title || '').includes('Prompt')) {
      node.inputs.text = prompt
    }
    if (node.class_type === 'KSampler' && 'seed' in node.inputs) {
      node.inputs.seed = seed
    }
    if ((node.class_type === 'EmptySD3LatentImage' || node.class_type === 'EmptyLatentImage')) {
      if ('width' in node.inputs) node.inputs.width = numericWidth
      if ('height' in node.inputs) node.inputs.height = numericHeight
      if ('batch_size' in node.inputs) node.inputs.batch_size = safeVariantCount
    }
    if (node.class_type === 'SaveImage' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'image/z_image_turbo'
    }
  }

  return modified
}

/**
 * Workflow modifier for Grok text-to-image.
 * Expects GrokImageNode + SaveImage in the workflow JSON.
 */
export function modifyGrokTextToImageWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    seed = Math.floor(Math.random() * 1000000000000),
    model = 'grok-imagine-image-beta',
    width = 1024,
    height = 1024,
    variantCount = 1,
    filenamePrefix = 'image/grok_text_to_image',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const safeAspectRatio = resolveClosestAspectRatio(width, height)
  const longestEdge = Math.max(Number(width) || 0, Number(height) || 0)
  const safeResolution = longestEdge >= 1800 ? '2K' : '1K'
  const safeVariantCount = Math.max(1, Math.min(10, Math.round(Number(variantCount) || 1)))

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'GrokImageNode') {
      if ('model' in node.inputs) node.inputs.model = model
      if ('prompt' in node.inputs) node.inputs.prompt = prompt
      if ('seed' in node.inputs) node.inputs.seed = seed
      if ('aspect_ratio' in node.inputs) node.inputs.aspect_ratio = safeAspectRatio
      if ('resolution' in node.inputs) node.inputs.resolution = safeResolution
      if ('number_of_images' in node.inputs) node.inputs.number_of_images = safeVariantCount
    }

    if (node.class_type === 'SaveImage' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'image/grok_text_to_image'
    }
  }

  return modified
}

/**
 * Workflow modifier for ByteDance Seedream 5.0 Lite image edit.
 * Expects ByteDanceSeedreamNode + SaveImage, with optional LoadImage/BatchImagesNode refs.
 * referenceImages order: [productImage?, modelImage?] from Director Mode.
 */
export function modifySeedream5LiteImageEditWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    seed = Math.floor(Math.random() * 1000000000000),
    inputImage = '',
    width = 2048,
    height = 2048,
    variantCount = 1,
    model = 'seedream 5.0 lite',
    filenamePrefix = 'image/seedream_5_lite',
    referenceImages = [],
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const numericWidth = Math.max(256, Math.round(Number(width) || 0))
  const numericHeight = Math.max(256, Math.round(Number(height) || 0))
  const sizePreset = resolveSeedreamSizePreset(numericWidth, numericHeight)
  const safeVariantCount = Math.max(1, Math.min(10, Math.round(Number(variantCount) || 1)))
  const validReferences = (Array.isArray(referenceImages) ? referenceImages : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .slice(0, 2)

  // Director Mode passes [product, model]. Prefer model first when both exist.
  const productReference = validReferences[0] || ''
  const modelReference = validReferences[1] || ''
  const orderedReferenceImages = [modelReference, productReference].filter(Boolean)
  const selectedReferenceImages = orderedReferenceImages.length > 0
    ? orderedReferenceImages
    : (inputImage ? [String(inputImage).trim()] : [])

  const getUniqueNodeId = (baseId) => {
    let nextId = baseId
    let suffix = 1
    while (modified[nextId]) {
      nextId = `${baseId}_${suffix}`
      suffix += 1
    }
    return nextId
  }

  let seedreamNode = null
  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'ByteDanceSeedreamNode') {
      seedreamNode = node
      if ('model' in node.inputs) node.inputs.model = model
      if ('prompt' in node.inputs) node.inputs.prompt = prompt
      if ('seed' in node.inputs) node.inputs.seed = seed
      if ('size_preset' in node.inputs && sizePreset) node.inputs.size_preset = sizePreset
      if ('width' in node.inputs && Number.isFinite(numericWidth)) node.inputs.width = numericWidth
      if ('height' in node.inputs && Number.isFinite(numericHeight)) node.inputs.height = numericHeight
      if ('max_images' in node.inputs) node.inputs.max_images = safeVariantCount
      if ('sequential_image_generation' in node.inputs) node.inputs.sequential_image_generation = 'disabled'
    }

    if (node.class_type === 'SaveImage' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'image/seedream_5_lite'
    }
  }

  if (!seedreamNode) return modified

  if (selectedReferenceImages.length === 0) {
    if (Object.prototype.hasOwnProperty.call(seedreamNode.inputs, 'image')) {
      delete seedreamNode.inputs.image
    }
    return modified
  }

  const loadNodeIds = selectedReferenceImages.map((filename, index) => {
    const loadNodeId = getUniqueNodeId(`seedream_ref_${index + 1}`)
    modified[loadNodeId] = {
      class_type: 'LoadImage',
      inputs: { image: filename },
      _meta: { title: `Load Image (Seedream ref ${index + 1})` },
    }
    return loadNodeId
  })

  if (loadNodeIds.length === 1) {
    seedreamNode.inputs.image = [loadNodeIds[0], 0]
    return modified
  }

  const batchNodeId = getUniqueNodeId('seedream_ref_batch')
  modified[batchNodeId] = {
    class_type: 'BatchImagesNode',
    inputs: {
      'images.image0': [loadNodeIds[0], 0],
      'images.image1': [loadNodeIds[1], 0],
    },
    _meta: { title: 'Batch Images' },
  }
  seedreamNode.inputs.image = [batchNodeId, 0]

  return modified
}

export function modifyOpenAIGPTImage2Workflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    referenceImages = [],
    seed = Math.floor(Math.random() * 1000000000000),
    width = 1024,
    height = 1024,
    model = 'gpt-image-2',
    quality = null,
    useCustomSize = false,
    minimumCustomSize = false,
    filenamePrefix = 'image/gpt_image_2',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const requestedWidth = Math.max(256, Math.round(Number(width) || 1024))
  const requestedHeight = Math.max(256, Math.round(Number(height) || 1024))
  const customSize = minimumCustomSize
    ? resolveOpenAIGPTImage2MinimumCustomSize(requestedWidth, requestedHeight)
    : { width: requestedWidth, height: requestedHeight }
  const size = useCustomSize ? 'Custom' : resolveOpenAIGPTImage2Size(requestedWidth, requestedHeight)
  if (!useCustomSize && size !== `${requestedWidth}x${requestedHeight}`) {
    console.warn(`[modifyOpenAIGPTImage2Workflow] Unsupported size ${requestedWidth}x${requestedHeight}; mapped to ${size}`)
  }
  const referenceImageList = (Array.isArray(referenceImages) ? referenceImages : [])
    .map((filename) => String(filename || '').trim())
    .filter(Boolean)
  const usesReferenceBatch = referenceImageList.length > 0

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'OpenAIGPTImage1') {
      if ('prompt' in node.inputs && typeof node.inputs.prompt === 'string') node.inputs.prompt = prompt
      if ('seed' in node.inputs) node.inputs.seed = seed
      if ('size' in node.inputs) node.inputs.size = size
      if (useCustomSize && 'custom_width' in node.inputs) node.inputs.custom_width = customSize.width
      if (useCustomSize && 'custom_height' in node.inputs) node.inputs.custom_height = customSize.height
      if ('model' in node.inputs) node.inputs.model = model
      if (quality && 'quality' in node.inputs) node.inputs.quality = quality
    }

    if (node.class_type === 'StringReplace' && typeof node.inputs.string === 'string') {
      node.inputs.string = prompt
    }

    if (inputImage && !usesReferenceBatch && node.class_type === 'LoadImage' && 'image' in node.inputs) {
      node.inputs.image = inputImage
    }

    if (node.class_type === 'SaveImage' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'image/gpt_image_2'
    }
  }

  if (usesReferenceBatch) {
    applyOpenAIGPTImage2ReferenceBatch(modified, referenceImageList)
  }

  return modified
}

const OPENAI_GPT_IMAGE_2_ALLOWED_SIZES = Object.freeze([
  Object.freeze({ width: 1024, height: 1024 }),
  Object.freeze({ width: 1024, height: 1536 }),
  Object.freeze({ width: 1536, height: 1024 }),
  Object.freeze({ width: 2048, height: 2048 }),
  Object.freeze({ width: 2048, height: 1152 }),
  Object.freeze({ width: 1152, height: 2048 }),
  Object.freeze({ width: 3840, height: 2160 }),
  Object.freeze({ width: 2160, height: 3840 }),
])

function resolveOpenAIGPTImage2Size(width, height) {
  const w = Math.max(256, Math.round(Number(width) || 1024))
  const h = Math.max(256, Math.round(Number(height) || 1024))
  const exactMatch = OPENAI_GPT_IMAGE_2_ALLOWED_SIZES.find((entry) => entry.width === w && entry.height === h)
  if (exactMatch) return `${exactMatch.width}x${exactMatch.height}`

  const targetRatio = w / h
  const targetArea = w * h
  const targetLandscape = w >= h
  let best = OPENAI_GPT_IMAGE_2_ALLOWED_SIZES[0]
  let bestScore = Number.POSITIVE_INFINITY

  for (const candidate of OPENAI_GPT_IMAGE_2_ALLOWED_SIZES) {
    const candidateRatio = candidate.width / candidate.height
    const candidateArea = candidate.width * candidate.height
    const ratioDelta = Math.abs(Math.log(candidateRatio / targetRatio))
    const areaDelta = Math.abs(Math.log(candidateArea / targetArea))
    const orientationPenalty = (candidate.width >= candidate.height) === targetLandscape ? 0 : 0.25
    const score = (ratioDelta * 6) + areaDelta + orientationPenalty
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }

  return `${best.width}x${best.height}`
}

function resolveOpenAIGPTImage2MinimumCustomSize(width, height) {
  const w = Math.max(256, Math.round(Number(width) || 1024))
  const h = Math.max(256, Math.round(Number(height) || 1024))
  const ratio = w / h
  if (ratio > 1.1) return { width: 1824, height: 1024 }
  if (ratio < 0.9) return { width: 1024, height: 1824 }
  return { width: 1024, height: 1024 }
}

function applyOpenAIGPTImage2ReferenceBatch(workflow, referenceImages) {
  const filenames = (Array.isArray(referenceImages) ? referenceImages : [])
    .map((filename) => String(filename || '').trim())
    .filter(Boolean)
  if (filenames.length === 0) return

  const batchEntry = Object.entries(workflow).find(([, node]) => (
    node?.class_type === 'BatchImagesNode' &&
    Object.keys(node.inputs || {}).some((key) => /^images\.image\d+$/.test(key))
  ))

  if (!batchEntry) {
    let index = 0
    for (const node of Object.values(workflow)) {
      if (node?.class_type !== 'LoadImage' || !node.inputs || !('image' in node.inputs)) continue
      node.inputs.image = filenames[Math.min(index, filenames.length - 1)]
      index += 1
    }
    return
  }

  const [, batchNode] = batchEntry
  const batchInputKeys = Object.keys(batchNode.inputs || {})
    .filter((key) => /^images\.image\d+$/.test(key))
    .sort((a, b) => Number(a.match(/\d+$/)?.[0] || 0) - Number(b.match(/\d+$/)?.[0] || 0))

  batchInputKeys.forEach((inputKey, index) => {
    const filename = filenames[index]
    if (!filename) {
      delete batchNode.inputs[inputKey]
      return
    }
    const link = batchNode.inputs[inputKey]
    if (!Array.isArray(link)) return
    const loadNode = workflow[String(link[0])]
    if (loadNode?.class_type === 'LoadImage' && loadNode.inputs && 'image' in loadNode.inputs) {
      loadNode.inputs.image = filename
    }
  })
}

function resolveSeedanceResolution(width, height) {
  // Seedance's resolution tier ("720p"/"1080p") is keyed to the SHORT side, not
  // the literal height. For portrait 9:16, "720p" is 720x1280 — keying off height
  // (1280) wrongly rounds up to 1080p. Use the short side so portrait, landscape,
  // and square all map to the tier the user actually selected.
  const shortSide = Math.min(Number(width) || 0, Number(height) || 0)
  return shortSide >= 1080 ? '1080p' : '720p'
}

function applySeedanceCommonInputs(node, {
  prompt,
  width,
  height,
  duration,
  seed,
  generateAudio = true,
}) {
  if (!node?.inputs) return
  if ('model.prompt' in node.inputs) node.inputs['model.prompt'] = prompt
  if ('model.resolution' in node.inputs) node.inputs['model.resolution'] = resolveSeedanceResolution(width, height)
  if ('model.ratio' in node.inputs) node.inputs['model.ratio'] = resolveClosestAspectRatio(width, height)
  if ('model.duration' in node.inputs) node.inputs['model.duration'] = Math.max(1, Math.round(Number(duration) || 5))
  if ('model.generate_audio' in node.inputs) node.inputs['model.generate_audio'] = Boolean(generateAudio)
  if ('seed' in node.inputs) node.inputs.seed = seed
  if ('watermark' in node.inputs) node.inputs.watermark = false
}

export function modifySeedance2Workflow(workflow, options = {}) {
  const {
    prompt = '',
    width = 1280,
    height = 720,
    duration = 5,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'video/seedance2',
    assetFilenames = {},
    generateAudio = true,
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const firstFrame = assetFilenames.firstFrameAsset || ''
  const lastFrame = assetFilenames.lastFrameAsset || ''
  const referenceImages = [
    assetFilenames.referenceImage1,
    assetFilenames.referenceImage2,
    assetFilenames.referenceImage3,
    assetFilenames.referenceImage4,
  ]
  const referenceAudios = [
    assetFilenames.referenceAudio1,
    assetFilenames.referenceAudio2,
    assetFilenames.referenceAudio3,
    assetFilenames.referenceAudio4,
  ]
  const referenceVideos = [
    assetFilenames.referenceVideo1,
    assetFilenames.referenceVideo2,
    assetFilenames.referenceVideo3,
  ]

  for (const [nodeId, node] of Object.entries(modified)) {
    if (!node?.inputs) continue

    if (
      node.class_type === 'ByteDance2TextToVideoNode' ||
      node.class_type === 'ByteDance2FirstLastFrameNode' ||
      node.class_type === 'ByteDance2ReferenceNode'
    ) {
      applySeedanceCommonInputs(node, { prompt, width, height, duration, seed, generateAudio })

      if (node.class_type === 'ByteDance2FirstLastFrameNode') {
        if (firstFrame && Array.isArray(node.inputs.first_frame)) {
          const loadNode = modified[String(node.inputs.first_frame[0])]
          if (loadNode?.inputs && 'image' in loadNode.inputs) loadNode.inputs.image = firstFrame
        }
        if (lastFrame && Array.isArray(node.inputs.last_frame)) {
          const loadNode = modified[String(node.inputs.last_frame[0])]
          if (loadNode?.inputs && 'image' in loadNode.inputs) loadNode.inputs.image = lastFrame
        }
      }

      if (node.class_type === 'ByteDance2ReferenceNode') {
        referenceImages.forEach((filename, index) => {
          const inputKey = `model.reference_images.image_${index + 1}`
          if (!filename) {
            if (inputKey in node.inputs) delete node.inputs[inputKey]
            return
          }
          if (!Array.isArray(node.inputs[inputKey])) return
          const loadNode = modified[String(node.inputs[inputKey][0])]
          if (loadNode?.inputs && 'image' in loadNode.inputs) loadNode.inputs.image = filename
        })
        referenceAudios.forEach((filename, index) => {
          const inputKey = `model.reference_audios.audio_${index + 1}`
          if (!filename) {
            if (inputKey in node.inputs) delete node.inputs[inputKey]
            return
          }
          if (!Array.isArray(node.inputs[inputKey])) return
          const loadNode = modified[String(node.inputs[inputKey][0])]
          if (loadNode?.inputs && 'audio' in loadNode.inputs) loadNode.inputs.audio = filename
        })
        referenceVideos.forEach((filename, index) => {
          const inputKey = `model.reference_videos.video_${index + 1}`
          if (!filename) {
            if (inputKey in node.inputs) delete node.inputs[inputKey]
            return
          }
          if (!Array.isArray(node.inputs[inputKey])) return
          const loadNode = modified[String(node.inputs[inputKey][0])]
          if (loadNode?.class_type === 'LoadVideo' && loadNode.inputs && 'file' in loadNode.inputs) {
            loadNode.inputs.file = filename
          }
        })
      }
    }

    if (node.class_type === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'video/seedance2'
    }
  }

  return modified
}

function resolveMinimaxH3Resolution(width, height) {
  const longestSide = Math.max(Number(width) || 0, Number(height) || 0)
  if (longestSide >= 2000) return '2K'
  return '768P'
}

/**
 * Configure MiniMax H3 reference-to-video without touching the ComfyUI graph.
 * H3 receives one exact still and one exact audio segment. The audio is a
 * reference input, not a request for H3 to compose replacement music.
 */
export function modifyMinimaxH3ReferenceWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    width = 2560,
    height = 1440,
    duration = 5,
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'video/velorn_minimax_h3',
    assetFilenames = {},
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const referenceImage = String(assetFilenames.referenceImage1 || '').trim()
  const referenceAudio = String(assetFilenames.referenceAudio1 || '').trim()

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'MinimaxHailuo03ReferenceNode') {
      if ('model.prompt' in node.inputs) node.inputs['model.prompt'] = prompt
      if ('model.resolution' in node.inputs) node.inputs['model.resolution'] = resolveMinimaxH3Resolution(width, height)
      if ('model.ratio' in node.inputs) node.inputs['model.ratio'] = resolveClosestAspectRatio(width, height)
      if ('model.duration' in node.inputs) {
        node.inputs['model.duration'] = Math.max(5, Math.min(15, Math.round(Number(duration) || 5)))
      }
      if ('seed' in node.inputs) node.inputs.seed = seed
      if ('watermark' in node.inputs) node.inputs.watermark = false

      if (referenceImage && Array.isArray(node.inputs['model.reference_images.image_1'])) {
        const loadNode = modified[String(node.inputs['model.reference_images.image_1'][0])]
        if (loadNode?.inputs && 'image' in loadNode.inputs) loadNode.inputs.image = referenceImage
      }
      if (referenceAudio && Array.isArray(node.inputs['model.reference_audios.audio_1'])) {
        const loadNode = modified[String(node.inputs['model.reference_audios.audio_1'][0])]
        if (loadNode?.inputs && 'audio' in loadNode.inputs) loadNode.inputs.audio = referenceAudio
      }
    }

    if (node.class_type === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'video/velorn_minimax_h3'
    }
  }

  return modified
}

export function modifySoniloVideoToMusicWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputVideo = '',
    seed = Math.floor(Math.random() * 1000000000000),
    filenamePrefix = 'audio/sonilo',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'SoniloVideoToMusic') {
      if ('prompt' in node.inputs) node.inputs.prompt = prompt
      if ('seed' in node.inputs) node.inputs.seed = seed
    }

    if (inputVideo && node.class_type === 'LoadVideo' && 'file' in node.inputs) {
      node.inputs.file = inputVideo
    }

    if (node.class_type === 'SaveAudioMP3' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'audio/sonilo'
    }
  }

  return modified
}

/**
 * Workflow modifier for Nano Banana 2.
 * Supports both GeminiNanoBanana2 (new) and GeminiImage2Node (legacy) nodes.
 */
export function modifyNanoBanana2Workflow(workflow, options = {}) {
  const {
    prompt = '',
    seed = Math.floor(Math.random() * 1000000000000),
    model = 'Nano Banana 2 (Gemini 3.1 Flash Image)',
    width = null,
    height = null,
    aspectRatio = 'auto',
    resolution = '2K',
    filenamePrefix = 'image/nano_banana_2',
    systemPrompt = null,
    thinkingLevel = 'MINIMAL',
    referenceImages = [],
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const validReferences = (Array.isArray(referenceImages) ? referenceImages : [])
    .map((name) => String(name || '').trim())
    .filter(Boolean)
    .slice(0, 2)
  const numericWidth = Number(width)
  const numericHeight = Number(height)
  const hasExplicitDimensions = Number.isFinite(numericWidth) && numericWidth > 0 && Number.isFinite(numericHeight) && numericHeight > 0
  const safeAspectRatio = String(aspectRatio || '').trim() && aspectRatio !== 'auto'
    ? aspectRatio
    : resolveClosestAspectRatio(numericWidth, numericHeight)
  const safeResolution = String(resolution || '').trim() || (
    hasExplicitDimensions
      ? resolveTieredImageResolution(numericWidth, numericHeight, '1K')
      : '2K'
  )

  let geminiNode = null

  const getUniqueNodeId = (baseId) => {
    let nextId = baseId
    let suffix = 1
    while (modified[nextId]) {
      nextId = `${baseId}_${suffix}`
      suffix += 1
    }
    return nextId
  }

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    const isNanoBananaNode = (
      node.class_type === 'GeminiNanoBanana2' ||
      node.class_type === 'GeminiImage2Node'
    )
    if (isNanoBananaNode) {
      geminiNode = node
      if ('prompt' in node.inputs) node.inputs.prompt = prompt
      if ('model' in node.inputs) node.inputs.model = model
      if ('seed' in node.inputs) node.inputs.seed = seed
      if ('aspect_ratio' in node.inputs) node.inputs.aspect_ratio = safeAspectRatio
      if ('resolution' in node.inputs) node.inputs.resolution = safeResolution
      if ('response_modalities' in node.inputs) node.inputs.response_modalities = 'IMAGE'
      if ('thinking_level' in node.inputs) node.inputs.thinking_level = thinkingLevel
      if (systemPrompt && 'system_prompt' in node.inputs) {
        node.inputs.system_prompt = systemPrompt
      }
    }

    if (node.class_type === 'SaveImage' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix
    }
  }

  if (geminiNode && validReferences.length === 0) {
    // Remove placeholder image linkage from exported workflow when no refs were provided.
    if (Object.prototype.hasOwnProperty.call(geminiNode.inputs, 'images')) {
      delete geminiNode.inputs.images
    }
  }

  if (geminiNode && validReferences.length > 0) {
    const referenceNodeIds = validReferences.map((filename, index) => {
      const loadNodeId = getUniqueNodeId(`ref_img_${index + 1}`)
      modified[loadNodeId] = {
        class_type: 'LoadImage',
        inputs: { image: filename },
        _meta: { title: `Load Image (reference ${index + 1})` },
      }
      return loadNodeId
    })

    if (referenceNodeIds.length === 1) {
      geminiNode.inputs.images = [referenceNodeIds[0], 0]
    } else {
      const batchNodeId = getUniqueNodeId('ref_img_batch')
      modified[batchNodeId] = {
        class_type: 'ImageBatch',
        inputs: {
          image1: [referenceNodeIds[0], 0],
          image2: [referenceNodeIds[1], 0],
        },
        _meta: { title: 'Batch reference images' },
      }
      geminiNode.inputs.images = [batchNodeId, 0]
    }
  }

  return modified
}

export function modifyGeminiPromptWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    seed = Math.floor(Math.random() * 1000000000000),
    model = 'gemini-3-1-flash-lite',
    systemPrompt = null,
    inputImage = null,
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  let geminiNode = null

  const getUniqueNodeId = (baseId) => {
    let nextId = baseId
    let suffix = 1
    while (modified[nextId]) {
      nextId = `${baseId}_${suffix}`
      suffix += 1
    }
    return nextId
  }

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue
    if (node.class_type !== 'GeminiNode') continue

    geminiNode = node
    if ('prompt' in node.inputs) node.inputs.prompt = prompt
    if ('model' in node.inputs) node.inputs.model = model
    if ('seed' in node.inputs) node.inputs.seed = seed
    if (typeof systemPrompt === 'string' && systemPrompt.trim() && 'system_prompt' in node.inputs) {
      node.inputs.system_prompt = systemPrompt
    }
  }

  if (!geminiNode) return modified

  if (inputImage) {
    const loadNodeId = getUniqueNodeId('gemini_ref_img')
    modified[loadNodeId] = {
      class_type: 'LoadImage',
      inputs: { image: inputImage },
      _meta: { title: 'Load Image (reference)' },
    }
    geminiNode.inputs.images = [loadNodeId, 0]
  } else if (Object.prototype.hasOwnProperty.call(geminiNode.inputs, 'images')) {
    delete geminiNode.inputs.images
  }

  return modified
}

export function modifyMinimaxH3MediaPromptWorkflow(workflow, options = {}) {
  const {
    description = '',
    duration = 15,
    uploadedFilename = '',
    mediaKind = 'image',
    visionProvider = '',
    promptorProvider = '',
    outputLanguage = 'English',
    imageMode = 'Comprehensive',
    videoMode = 'Comprehensive',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const normalizedKind = mediaKind === 'video' ? 'video' : 'image'
  const mediaState = uploadedFilename
    ? JSON.stringify({
        media: [[
          'slot_1',
          { name: String(uploadedFilename), kind: normalizedKind },
        ]],
      })
    : JSON.stringify({ media: [] })

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue
    if (node.class_type === 'H3_Vision') {
      node.inputs._media_state = mediaState
      node.inputs.global_image_mode = imageMode
      node.inputs.global_video_mode = videoMode
      node.inputs.output_language = outputLanguage
      if (visionProvider) node.inputs.provider = visionProvider
    }
    if (node.class_type === 'H3_Promptor') {
      node.inputs.scene_direction = description
      node.inputs.duration = Math.max(4, Math.min(15, Number(duration) || 15))
      node.inputs.output_language = outputLanguage
      if (promptorProvider) node.inputs.provider = promptorProvider
    }
  }

  return modified
}

// Backward-compatible alias for legacy callers.
export const modifyNanoBananaProWorkflow = modifyNanoBanana2Workflow

function resolveTieredImageResolution(width, height, fallback = '1K') {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h)) return fallback
  const longestEdge = Math.max(w, h)
  return longestEdge >= 1800 ? '2K' : '1K'
}

function resolveSeedreamSizePreset(width, height) {
  const w = Math.max(256, Math.round(Number(width) || 0))
  const h = Math.max(256, Math.round(Number(height) || 0))
  const sizePresetMap = {
    '1280x720': '1280x720 (16:9)',
    '1920x1080': '1920x1080 (16:9)',
    '720x1280': '720x1280 (9:16)',
    '1080x1920': '1080x1920 (9:16)',
    '1024x1024': '1024x1024 (1:1)',
    '2048x2048': '2048x2048 (1:1)',
  }
  return sizePresetMap[`${w}x${h}`] || null
}

function resolveClosestAspectRatio(width, height) {
  const w = Number(width)
  const h = Number(height)
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return '16:9'

  const target = w / h
  const candidates = [
    { label: '16:9', value: 16 / 9 },
    { label: '9:16', value: 9 / 16 },
    { label: '1:1', value: 1 },
    { label: '4:3', value: 4 / 3 },
    { label: '3:4', value: 3 / 4 },
  ]

  let best = candidates[0]
  let bestDelta = Math.abs(target - best.value)
  for (const candidate of candidates.slice(1)) {
    const delta = Math.abs(target - candidate.value)
    if (delta < bestDelta) {
      best = candidate
      bestDelta = delta
    }
  }

  return best.label
}

/**
 * Workflow modifier for Grok Imagine Video image-to-video.
 * Expects LoadImage + GrokVideoNode + SaveVideo in the workflow JSON.
 */
export function modifyGrokVideoI2VWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    width = 1280,
    height = 720,
    duration = 5,
    seed = Math.floor(Math.random() * 1000000000000),
    model = 'grok-imagine-video-beta',
    filenamePrefix = 'video/grok_video_i2v',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const parsedDuration = Number(duration)
  const safeDuration = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? Math.max(1, Math.round(parsedDuration))
    : 5
  const aspectRatio = resolveClosestAspectRatio(width, height)
  const resolution = Number(height) >= 1080 ? '1080p' : '720p'

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'LoadImage' && 'image' in node.inputs) {
      node.inputs.image = inputImage
    }

    if (node.class_type === 'GrokVideoNode') {
      if ('model' in node.inputs) node.inputs.model = model
      if ('prompt' in node.inputs) node.inputs.prompt = prompt
      if ('resolution' in node.inputs) node.inputs.resolution = resolution
      if ('aspect_ratio' in node.inputs) node.inputs.aspect_ratio = aspectRatio
      if ('duration' in node.inputs) node.inputs.duration = safeDuration
      if ('seed' in node.inputs) node.inputs.seed = seed
    }

    if (node.class_type === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'video/grok_video_i2v'
    }
  }

  return modified
}

/**
 * Workflow modifier for Vidu Q2 image-to-video.
 * Expects LoadImage + Vidu2ImageToVideoNode + SaveVideo in the workflow JSON.
 */
export function modifyViduQ2I2VWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    width = 1280,
    height = 720,
    duration = 5,
    seed = Math.floor(Math.random() * 1000000000000),
    model = 'viduq2-pro-fast',
    movementAmplitude = 'auto',
    filenamePrefix = 'video/vidu_q2_i2v',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const parsedDuration = Number(duration)
  const safeDuration = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? Math.max(1, Math.round(parsedDuration))
    : 5
  const resolution = Number(height) >= 1080 ? '1080p' : '720p'

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'LoadImage' && 'image' in node.inputs) {
      node.inputs.image = inputImage
    }

    if (node.class_type === 'Vidu2ImageToVideoNode') {
      if ('model' in node.inputs) node.inputs.model = model
      if ('prompt' in node.inputs) node.inputs.prompt = prompt
      if ('duration' in node.inputs) node.inputs.duration = safeDuration
      if ('seed' in node.inputs) node.inputs.seed = seed
      if ('resolution' in node.inputs) node.inputs.resolution = resolution
      if ('movement_amplitude' in node.inputs) node.inputs.movement_amplitude = movementAmplitude
    }

    if (node.class_type === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'video/vidu_q2_i2v'
    }
  }

  return modified
}

/**
 * Workflow modifier for Kling 3.0 Omni image-to-video.
 * Expects LoadImage + KlingOmniProImageToVideoNode + SaveVideo in the workflow JSON.
 */
export function modifyKlingO3I2VWorkflow(workflow, options = {}) {
  const {
    prompt = '',
    inputImage = '',
    width = 1280,
    height = 720,
    duration = 5,
    frames = null,
    fps = 24,
    seed = Math.floor(Math.random() * 1000000000000),
    generateAudio = false,
    modelName = 'kling-v3-omni',
    filenamePrefix = 'video/kling_o3_i2v',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const parsedDuration = Number(duration)
  const fallbackDuration = (
    Number.isFinite(Number(frames)) && Number(frames) > 1 && Number.isFinite(Number(fps)) && Number(fps) > 0
  )
    ? Number(frames) / Number(fps)
    : 5
  const safeDuration = Number.isFinite(parsedDuration) && parsedDuration > 0
    ? parsedDuration
    : Math.max(1, Math.round(fallbackDuration))
  const aspectRatio = resolveClosestAspectRatio(width, height)
  const resolution = Number(height) >= 1080 ? '1080p' : '720p'

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'LoadImage' && 'image' in node.inputs) {
      node.inputs.image = inputImage
    }

    if (node.class_type === 'KlingOmniProImageToVideoNode') {
      if ('model_name' in node.inputs) node.inputs.model_name = modelName
      if ('prompt' in node.inputs) node.inputs.prompt = prompt
      if ('aspect_ratio' in node.inputs) node.inputs.aspect_ratio = aspectRatio
      if ('duration' in node.inputs) node.inputs.duration = safeDuration
      if ('resolution' in node.inputs) node.inputs.resolution = resolution
      if ('generate_audio' in node.inputs) node.inputs.generate_audio = Boolean(generateAudio)
      if ('seed' in node.inputs) node.inputs.seed = seed
    }

    if (node.class_type === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix
    }
  }

  return modified
}

/**
 * Workflow modifier for Topaz Video Upscale.
 * Expects LoadVideo + TopazVideoEnhance + SaveVideo in the workflow JSON.
 */
export function modifyTopazVideoUpscaleWorkflow(workflow, options = {}) {
  const {
    inputVideo = '',
    upscalerModel = 'Starlight Precise 2.5',
    upscalerResolution = 'FullHD (1080p)',
    upscalerCreativity = 'low',
    filenamePrefix = 'video/topaz_video_upscale',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const creativity = upscalerModel === 'Starlight (Astra) Creative'
    ? String(upscalerCreativity || 'low').trim() || 'low'
    : 'low'

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'LoadVideo' && 'file' in node.inputs) {
      node.inputs.file = inputVideo
    }

    if (node.class_type === 'TopazVideoEnhance') {
      if ('upscaler_enabled' in node.inputs) node.inputs.upscaler_enabled = true
      if ('upscaler_model' in node.inputs) node.inputs.upscaler_model = upscalerModel
      if ('upscaler_resolution' in node.inputs) node.inputs.upscaler_resolution = upscalerResolution
      if ('upscaler_creativity' in node.inputs) node.inputs.upscaler_creativity = creativity
      if ('interpolation_enabled' in node.inputs) node.inputs.interpolation_enabled = false
    }

    if (node.class_type === 'SaveVideo' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'video/topaz_video_upscale'
    }
  }

  return modified
}

/**
 * Workflow modifier for Vocal Extract (Mel-Band RoFormer).
 *
 * Runs once per project as a preprocessing step when the user imports a
 * mixed-track song and needs an isolated vocal stem for lip-sync.
 */
export function modifyVocalExtractWorkflow(workflow, options = {}) {
  const {
    inputAudio = '',
    filenamePrefix = 'audio/vocal_stem',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue
    if (node.class_type === 'LoadAudio' && 'audio' in node.inputs) {
      node.inputs.audio = inputAudio || node.inputs.audio
    }
    if (node.class_type === 'SaveAudioMP3' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'audio/vocal_stem'
    }
  }
  return modified
}

/**
 * Workflow modifier for Music Video Shot (LTX 2.3 + Audio).
 *
 * Maps a normalized shot object (see musicVideoShotConfig.normalizeMusicVideoShot)
 * plus per-project audio onto the node inputs of
 * public/workflows/music_video_shot_ltx2_3_i2v_audio.json.
 *
 * Shape of `options`:
 *   {
 *     shot: { shotType, length, audioStart, shotPrompt, ... },
 *     inputAudio: 'song_or_vocal_stem.mp3' (uploaded to ComfyUI),
 *     inputImage: 'shot_reference.png' (uploaded to ComfyUI),
 *     useVocalsOnly: false (true = run Mel-Band at graph time; prefer false +
 *       pre-extracted stem),
 *     enablePromptEnhancer: false,
 *     width, height, fps,
 *     filenamePrefix: 'video/music_video/shot_01',
 *     seed: <optional override; shot.seed wins if set>,
 *     negativePrompt: <optional; keeps workflow default if omitted>,
 *   }
 */
export function modifyMusicVideoShotWorkflow(workflow, options = {}) {
  const {
    shot: rawShot = {},
    inputAudio = '',
    inputImage = '',
    useVocalsOnly = false,
    enablePromptEnhancer = false,
    width = MUSIC_VIDEO_SHOT_DEFAULTS.width,
    height = MUSIC_VIDEO_SHOT_DEFAULTS.height,
    fps = MUSIC_VIDEO_SHOT_DEFAULTS.fps,
    filenamePrefix = 'video/music_video/shot',
    seed: seedOverride = null,
    negativePrompt = '',
  } = options

  const shot = normalizeMusicVideoShot(rawShot)
  const shotTypeOption = getMusicVideoShotTypeOption(shot.shotType) || getMusicVideoShotTypeOption('performance')
  const hasExplicitImageStrength = Number.isFinite(Number(rawShot?.imageStrength))
  const resolvedImageStrength = hasExplicitImageStrength
    ? shot.imageStrength
    : (Number.isFinite(Number(shotTypeOption?.defaultImageStrength))
        ? Number(shotTypeOption.defaultImageStrength)
        : shot.imageStrength)

  const resolvedPrompt = [shot.shotPrompt, shotTypeOption.promptSuffix]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('\n\n')

  const resolvedSeed = Number.isFinite(Number(shot.seed))
    ? Math.round(Number(shot.seed))
    : Number.isFinite(Number(seedOverride))
      ? Math.round(Number(seedOverride))
      : Math.floor(Math.random() * 1000000000000)

  const numericWidth = Math.max(256, Math.round(Number(width) || MUSIC_VIDEO_SHOT_DEFAULTS.width))
  const numericHeight = Math.max(256, Math.round(Number(height) || MUSIC_VIDEO_SHOT_DEFAULTS.height))
  const numericFps = Math.max(1, Math.round(Number(fps) || MUSIC_VIDEO_SHOT_DEFAULTS.fps))

  const modified = JSON.parse(JSON.stringify(workflow))

  // LoadImage (reference still) — node 444
  if (modified['444']?.inputs && 'image' in modified['444'].inputs) {
    modified['444'].inputs.image = inputImage || modified['444'].inputs.image
  }
  // LoadAudio (project song or pre-extracted vocal stem) — node 1594
  if (modified['1594']?.inputs && 'audio' in modified['1594'].inputs) {
    modified['1594'].inputs.audio = inputAudio || modified['1594'].inputs.audio
  }
  // USE VOCALS ONLY switch — node 1616
  // Keep this false when we have a pre-extracted stem (the normal path) so we
  // don't pay the Mel-Band RoFormer cost on every shot.
  if (modified['1616']?.inputs && 'switch' in modified['1616'].inputs) {
    modified['1616'].inputs.switch = Boolean(useVocalsOnly)
  }
  // Audio start / length — nodes 5100 and 2012
  if (modified['5100']?.inputs && 'value' in modified['5100'].inputs) {
    modified['5100'].inputs.value = shot.audioStart
  }
  if (modified['2012']?.inputs && 'value' in modified['2012'].inputs) {
    modified['2012'].inputs.value = shot.length
  }
  // Video geometry — nodes 1586 (FPS), 1606 (WIDTH), 1591 (HEIGHT)
  if (modified['1586']?.inputs && 'value' in modified['1586'].inputs) {
    modified['1586'].inputs.value = numericFps
  }
  if (modified['1606']?.inputs && 'value' in modified['1606'].inputs) {
    modified['1606'].inputs.value = numericWidth
  }
  if (modified['1591']?.inputs && 'value' in modified['1591'].inputs) {
    modified['1591'].inputs.value = numericHeight
  }
  // Prompt — node 1624
  if (modified['1624']?.inputs && 'value' in modified['1624'].inputs) {
    modified['1624'].inputs.value = resolvedPrompt || modified['1624'].inputs.value
  }
  // Negative prompt — node 1626 (only override if caller supplied one)
  if (negativePrompt && modified['1626']?.inputs && 'text' in modified['1626'].inputs) {
    modified['1626'].inputs.text = negativePrompt
  }
  // Image strength — node 1722
  if (modified['1722']?.inputs && 'value' in modified['1722'].inputs) {
    modified['1722'].inputs.value = resolvedImageStrength
  }
  // Prompt enhancer toggle — node 2116
  if (modified['2116']?.inputs && 'value' in modified['2116'].inputs) {
    modified['2116'].inputs.value = Boolean(enablePromptEnhancer)
  }
  // LoRA toggles (Power Lora Loader rgthree) — node 2150
  //   lora_1 = talking-head (performance)
  //   lora_2 = Licon-VBVR (foundational, always on)
  //   lora_3 = Image2Vid-Adapter (foundational, always on)
  //   lora_4 = camera control / dolly-out (optional per shot)
  if (modified['2150']?.inputs) {
    const loraInputs = modified['2150'].inputs
    if (loraInputs.lora_1 && typeof loraInputs.lora_1 === 'object') {
      loraInputs.lora_1.on = Boolean(shotTypeOption.talkingHeadLoraOn)
      loraInputs.lora_1.strength = Number(shotTypeOption.talkingHeadLoraStrength) || 0
    }
    if (loraInputs.lora_4 && typeof loraInputs.lora_4 === 'object') {
      loraInputs.lora_4.on = Boolean(shotTypeOption.cameraLoraOn)
      loraInputs.lora_4.strength = Number(shotTypeOption.cameraLoraStrength) || 0
    }
  }
  // Seeds — Pass 1 (2179) and Pass 2 (2169)
  if (modified['2179']?.inputs && 'noise_seed' in modified['2179'].inputs) {
    modified['2179'].inputs.noise_seed = resolvedSeed
  }
  if (modified['2169']?.inputs && 'noise_seed' in modified['2169'].inputs) {
    // Offset the pass-2 seed so the two passes don't collapse into the same
    // noise, which visibly hurts detail on LTX 2.3.
    modified['2169'].inputs.noise_seed = (resolvedSeed + 1000003) >>> 0
  }
  // Output — node 5001 (SaveVideo)
  if (modified['5001']?.inputs && 'filename_prefix' in modified['5001'].inputs) {
    modified['5001'].inputs.filename_prefix = filenamePrefix || modified['5001'].inputs.filename_prefix || 'video/music_video/shot'
  }

  return modified
}

/**
 * Workflow modifier for Music Generation (AceStep 1.5)
 */
export function modifyMusicWorkflow(workflow, options = {}) {
  const {
    tags = '',            // Style/genre description
    lyrics = '',          // Song lyrics (can be empty for instrumental)
    duration = 30,        // Duration in seconds
    bpm = 120,
    seed = Math.floor(Math.random() * 1000000),
    timesignature = '4',
    language = 'en',
    keyscale = 'C major',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))

  // Text encoder (node 94 - TextEncodeAceStepAudio1.5)
  // ComfyUI now requires: generate_audio_codes, top_k, top_p, temperature, cfg_scale, min_p
  if (modified['94']) {
    modified['94'].inputs.generate_audio_codes = modified['94'].inputs.generate_audio_codes ?? true
    modified['94'].inputs.top_k = modified['94'].inputs.top_k ?? 0
    modified['94'].inputs.top_p = modified['94'].inputs.top_p ?? 0.9
    modified['94'].inputs.temperature = modified['94'].inputs.temperature ?? 1
    modified['94'].inputs.cfg_scale = modified['94'].inputs.cfg_scale ?? 1
    modified['94'].inputs.min_p = modified['94'].inputs.min_p ?? 0
    modified['94'].inputs.tags = tags
    modified['94'].inputs.lyrics = lyrics
    modified['94'].inputs.duration = duration
    modified['94'].inputs.bpm = bpm
    modified['94'].inputs.seed = seed
    modified['94'].inputs.timesignature = timesignature
    modified['94'].inputs.language = language
    modified['94'].inputs.keyscale = keyscale
  }
  // Latent audio duration (node 98)
  if (modified['98']) {
    modified['98'].inputs.seconds = duration
  }
  // KSampler seed (node 3)
  if (modified['3']) {
    modified['3'].inputs.seed = seed
  }
  // Output prefix (node 107)
  if (modified['107']) {
    modified['107'].inputs.filename_prefix = 'audio/Velorn'
  }

  return modified
}

function normalizeElevenLabsVoiceName(value) {
  const raw = String(value || '').trim()
  if (!raw) return 'Roger (male, american)'
  if (raw.includes('(') && raw.includes(')')) return raw

  const voiceAliases = {
    roger: 'Roger (male, american)',
    laura: 'Laura (female, american)',
    sarah: 'Sarah (female, american)',
    charlie: 'Charlie (male, australian)',
    george: 'George (male, british)',
    callum: 'Callum (male, american)',
    river: 'River (non-binary, american)',
    liam: 'Liam (male, american)',
    jessica: 'Jessica (female, american)',
    eric: 'Eric (male, american)',
  }

  return voiceAliases[raw.toLowerCase()] || raw
}

/**
 * Workflow modifier for ElevenLabs Text to Speech.
 *
 * Expected workflow:
 *   - ElevenLabsTextToSpeech
 *   - ElevenLabsVoiceSelector
 *   - SaveAudioMP3
 */
export function modifyElevenLabsTextToSpeechWorkflow(workflow, options = {}) {
  const {
    text = '',
    voice = 'Roger (male, american)',
    stability = 0.5,
    model = 'eleven_multilingual_v2',
    speed = 1,
    similarityBoost = 0.75,
    useSpeakerBoost = false,
    style = 0,
    languageCode = '',
    seed = 1,
    outputFormat = 'mp3_44100_192',
    filenamePrefix = 'audio/short_film_voice',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const safeText = String(text || '').trim()
  const safeVoice = normalizeElevenLabsVoiceName(voice)

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'ElevenLabsTextToSpeech') {
      if ('text' in node.inputs) node.inputs.text = safeText || node.inputs.text
      if ('stability' in node.inputs) node.inputs.stability = Number(stability)
      if ('apply_text_normalization' in node.inputs) node.inputs.apply_text_normalization = 'auto'
      if ('model' in node.inputs) node.inputs.model = model || node.inputs.model
      if ('model.speed' in node.inputs) node.inputs['model.speed'] = Number(speed)
      if ('model.similarity_boost' in node.inputs) node.inputs['model.similarity_boost'] = Number(similarityBoost)
      if ('model.use_speaker_boost' in node.inputs) node.inputs['model.use_speaker_boost'] = Boolean(useSpeakerBoost)
      if ('model.style' in node.inputs) node.inputs['model.style'] = Number(style)
      if ('language_code' in node.inputs) node.inputs.language_code = String(languageCode || '')
      if ('seed' in node.inputs) node.inputs.seed = Math.max(0, Math.round(Number(seed) || 1))
      if ('output_format' in node.inputs) node.inputs.output_format = outputFormat || node.inputs.output_format
    }

    if (node.class_type === 'ElevenLabsVoiceSelector' && 'voice' in node.inputs) {
      node.inputs.voice = safeVoice
    }

    if (node.class_type === 'SaveAudioMP3' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'audio/short_film_voice'
    }
  }

  return modified
}

/**
 * Workflow modifier for the local comfy_IrodoriTTS v3 graph.
 * Automatic duration estimation is enabled with seconds=0 by default.
 */
export function modifyIrodoriTextToSpeechWorkflow(workflow, options = {}) {
  const {
    text = '',
    model = 'irodori-tts-500m-v3.safetensors',
    seed = 1,
    seconds = 0,
    numSteps = 40,
    modelDevice = 'cuda',
    modelPrecision = 'bf16',
    codecDevice = 'cpu',
    codecPrecision = 'fp32',
    enableWatermark = false,
    compileModel = false,
    compileDynamic = false,
    runtimeCachePolicy = 'offload_after_use',
    batchSize = 1,
    decodeMode = 'sequential',
    contextKvCache = true,
    maxTextLen = 0,
    trimTail = true,
    filenamePrefix = 'audio/short_film_irodori',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const safeText = String(text || '').trim()

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'jupo.IrodoriTTS.ModelLoader') {
      // Assign the complete current v3 input contract instead of only
      // rewriting keys found in the bundled JSON. This also repairs an older
      // workflow response that may still be held in the browser cache after
      // comfy-Irodori-TTS adds required inputs.
      node.inputs.model = String(model || node.inputs.model || 'irodori-tts-500m-v3.safetensors')
      node.inputs.model_device = modelDevice || node.inputs.model_device || 'cuda'
      node.inputs.model_precision = modelPrecision || node.inputs.model_precision || 'bf16'
      node.inputs.codec_device = codecDevice || node.inputs.codec_device || 'cpu'
      node.inputs.codec_precision = codecPrecision || node.inputs.codec_precision || 'fp32'
      node.inputs.enable_watermark = Boolean(enableWatermark)
      node.inputs.compile_model = Boolean(compileModel)
      node.inputs.compile_dynamic = Boolean(compileDynamic)
      node.inputs.runtime_cache_policy = runtimeCachePolicy || node.inputs.runtime_cache_policy || 'offload_after_use'
    }

    if (node.class_type === 'jupo.IrodoriTTS.Sampler') {
      node.inputs.text = safeText || node.inputs.text || ''
      node.inputs.seed = Math.max(0, Math.round(Number(seed) || 0))
      node.inputs.seconds = Math.max(0, Number(seconds) || 0)
      node.inputs.num_steps = Math.max(1, Math.min(120, Math.round(Number(numSteps) || 40)))
      node.inputs.batch_size = Math.max(1, Math.min(16, Math.round(Number(batchSize) || 1)))
      node.inputs.decode_mode = decodeMode === 'batch' ? 'batch' : 'sequential'
      node.inputs.context_kv_cache = contextKvCache !== false
      node.inputs.max_text_len = Math.max(0, Math.min(4096, Math.round(Number(maxTextLen) || 0)))
      node.inputs.trim_tail = trimTail !== false
    }

    if (node.class_type === 'SaveAudioMP3' && 'filename_prefix' in node.inputs) {
      node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix || 'audio/short_film_irodori'
      // audioUI belonged to an older UI-facing node schema and is not an API
      // input in current ComfyUI releases.
      delete node.inputs.audioUI
    }
  }

  return modified
}

/**
 * Configure the shared Irodori voice-studio graph. A reference recording
 * selects v3 voice cloning; without one, a VoiceDesign caption can select a
 * reference-free voice. Emoji delivery cues remain embedded in `text`.
 */
export function modifyIrodoriVoiceCloneWorkflow(workflow, options = {}) {
  const {
    text = '',
    inputAudio = '',
    model = 'irodori-tts-500m-v3.safetensors',
    seed = 1,
    seconds = 0,
    numSteps = 30,
    normalizeReference = false,
    maxReferenceSeconds = 30,
    voiceDesignCaption = '',
    cfgText = 3,
    cfgSpeaker = 5,
    cfgCaption = 3,
    modelDevice = 'cuda',
    modelPrecision = 'bf16',
    codecDevice = 'cpu',
    codecPrecision = 'fp32',
    runtimeCachePolicy = 'offload_after_use',
    filenamePrefix = 'audio/irodori_voice_clone',
    outputFormat = 'flac',
  } = options

  const modified = JSON.parse(JSON.stringify(workflow))
  const safeText = String(text || '').trim()
  const safeAudio = String(inputAudio || '').trim()
  const safeVoiceDesignCaption = String(voiceDesignCaption || '').trim()
  const useVoiceDesign = !safeAudio && Boolean(safeVoiceDesignCaption)
  const referenceNodeId = Object.entries(modified).find(([, node]) => node?.class_type === 'jupo.IrodoriTTS.ReferenceAudio')?.[0]
  const voiceDesignNodeId = Object.entries(modified).find(([, node]) => node?.class_type === 'jupo.IrodoriTTS.VoiceDesignConfig')?.[0]

  for (const node of Object.values(modified)) {
    if (!node?.inputs) continue

    if (node.class_type === 'jupo.IrodoriTTS.ModelLoader') {
      if ('model' in node.inputs) node.inputs.model = String(model || node.inputs.model)
      if ('model_device' in node.inputs) node.inputs.model_device = modelDevice || node.inputs.model_device
      if ('model_precision' in node.inputs) node.inputs.model_precision = modelPrecision || node.inputs.model_precision
      if ('codec_device' in node.inputs) node.inputs.codec_device = codecDevice || node.inputs.codec_device
      if ('codec_precision' in node.inputs) node.inputs.codec_precision = codecPrecision || node.inputs.codec_precision
      if ('runtime_cache_policy' in node.inputs) node.inputs.runtime_cache_policy = runtimeCachePolicy || node.inputs.runtime_cache_policy
    }

    if (node.class_type === 'jupo.IrodoriTTS.ReferenceAudio') {
      if ('audio' in node.inputs) node.inputs.audio = safeAudio || node.inputs.audio
      if ('normalize_ref_audio' in node.inputs) node.inputs.normalize_ref_audio = Boolean(normalizeReference)
      if ('max_ref_seconds' in node.inputs) node.inputs.max_ref_seconds = Math.max(1, Math.min(120, Number(maxReferenceSeconds) || 30))
    }

    if (node.class_type === 'jupo.IrodoriTTS.CFGConfig') {
      if ('cfg_scale_text' in node.inputs) node.inputs.cfg_scale_text = Math.max(0, Math.min(10, Number(cfgText) || 3))
      if ('cfg_scale_speaker' in node.inputs) node.inputs.cfg_scale_speaker = Math.max(0, Math.min(10, Number(cfgSpeaker) || 5))
      if ('cfg_scale_caption' in node.inputs) node.inputs.cfg_scale_caption = Math.max(0, Math.min(10, Number(cfgCaption) || 3))
    }

    if (node.class_type === 'jupo.IrodoriTTS.VoiceDesignConfig') {
      if ('caption' in node.inputs) node.inputs.caption = safeVoiceDesignCaption || node.inputs.caption
    }

    if (node.class_type === 'jupo.IrodoriTTS.Sampler') {
      if ('text' in node.inputs) node.inputs.text = safeText || node.inputs.text
      if ('seed' in node.inputs) node.inputs.seed = Math.max(0, Math.round(Number(seed) || 0))
      if ('seconds' in node.inputs) node.inputs.seconds = Math.max(0, Number(seconds) || 0)
      if ('num_steps' in node.inputs) node.inputs.num_steps = Math.max(1, Math.min(120, Math.round(Number(numSteps) || 30)))
      if (useVoiceDesign) {
        delete node.inputs.ref_config
        if (voiceDesignNodeId) node.inputs.voice_design_config = [voiceDesignNodeId, 0]
      } else if (safeAudio) {
        delete node.inputs.voice_design_config
        if (referenceNodeId) node.inputs.ref_config = [referenceNodeId, 0]
      } else {
        delete node.inputs.ref_config
        delete node.inputs.voice_design_config
      }
    }

    if (node.class_type === 'SaveAudioAdvanced') {
      if ('filename_prefix' in node.inputs) node.inputs.filename_prefix = filenamePrefix || node.inputs.filename_prefix
      // COMFY_DYNAMICCOMBO_V3 accepts the selected option key in API prompts.
      // ComfyUI expands it to { format, ...nestedInputs } before node execution.
      if ('format' in node.inputs) node.inputs.format = String(outputFormat || 'flac')
    }
  }

  if (!safeAudio && referenceNodeId) delete modified[referenceNodeId]
  if (!useVoiceDesign && voiceDesignNodeId) delete modified[voiceDesignNodeId]

  return modified
}

export default comfyui;
