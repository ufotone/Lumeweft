import comfyui, {
  modifyGeminiPromptWorkflow,
  modifyMinimaxH3MediaPromptWorkflow,
  modifyMinimaxH3CharacterSheetWorkflow,
  modifyMinimaxH3GGUFI2VWorkflow,
  modifyGrokTextToImageWorkflow,
  modifyGrokVideoI2VWorkflow,
  modifyKlingO3I2VWorkflow,
  modifyLTX23I2VWorkflow,
  modifyMusicWorkflow,
  modifyMultipleAnglesWorkflow,
  modifyNanoBanana2Workflow,
  modifyTopazVideoUpscaleWorkflow,
  modifyQwenImageEdit2509Workflow,
  modifySeedream5LiteImageEditWorkflow,
  modifyViduQ2I2VWorkflow,
  modifyWAN22Workflow,
  modifyZImageTurboWorkflow,
} from './comfyui'
import { BUILTIN_WORKFLOW_PATHS } from '../config/workflowRegistry'
import { checkWorkflowDependencies } from './workflowDependencies'
import { GENERATED_ASSET_FOLDERS, getWorkflowHardwareInfo } from '../config/generateWorkspaceConfig'
import { importAsset, isElectron } from './fileSystem'
import { canImportGifMedia, importGifAsset, isGifFilename } from './gifImport'
import { enqueuePlaybackTranscode } from './playbackCache'
import { enqueueProxyTranscode, isProxyPlaybackEnabled } from './proxyCache'
import { markPromptHandledByApp } from './comfyPromptGuard'
import { useAssetsStore } from '../stores/assetsStore'
import { useProjectStore } from '../stores/projectStore'
import {
  FLOW_AI_NODE_TYPES,
  getFlowAudioWorkflowOptions,
  getFlowImageWorkflowOptions,
  getFlowImageVariantBehavior,
  getFlowNodeSupportsExecution,
  getFlowOutputFolderSegments,
  getFlowTextWorkflowOptions,
  getFlowVideoWorkflowOptions,
  getFlowVideoUpscaleWorkflowOptions,
  normalizeFlowImageVariantCount,
} from './flowAiSchema'
import { TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID } from '../config/topazVideoUpscaleConfig'
import { buildTopazVideoUpscaleBaseName, runTopazVideoUpscale } from './topazVideoUpscale'

const EXECUTABLE_NODE_TYPES = new Set([
  FLOW_AI_NODE_TYPES.promptAssist,
  FLOW_AI_NODE_TYPES.imageGen,
  FLOW_AI_NODE_TYPES.videoGen,
  FLOW_AI_NODE_TYPES.videoUpscale,
  FLOW_AI_NODE_TYPES.musicGen,
])

const SINGLE_VIDEO_WORKFLOW_IDS = new Set([
  'minimax-h3-gguf-i2v',
  'wan22-i2v',
  'ltx23-i2v',
  'kling-o3-i2v',
  'grok-video-i2v',
  'vidu-q2-i2v',
  TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID,
])

const TEXT_OUTPUT_WORKFLOW_IDS = new Set([
  'google-gemini-flash-lite',
  'minimax-h3-media-promptor',
])

const NUMBERED_RUN_FOLDER_TEMPLATE_IDS = new Set([
  'anima-lora-dataset',
  'sdxl-lora-dataset',
])

function documentUsesNumberedRunFolders(document) {
  return NUMBERED_RUN_FOLDER_TEMPLATE_IDS.has(String(document?.templateId || '').trim())
    || (document?.nodes || []).some((node) => (
      node?.type === FLOW_AI_NODE_TYPES.output
      && node?.data?.numberedRunFolders === true
    ))
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'mkv', 'avi', 'gif'])
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac'])

const WORKFLOW_MODIFIERS = Object.freeze({
  'minimax-h3-character-sheet': modifyMinimaxH3CharacterSheetWorkflow,
  'minimax-h3-gguf-i2v': modifyMinimaxH3GGUFI2VWorkflow,
  'wan22-i2v': modifyWAN22Workflow,
  'ltx23-i2v': modifyLTX23I2VWorkflow,
  'kling-o3-i2v': modifyKlingO3I2VWorkflow,
  'grok-video-i2v': modifyGrokVideoI2VWorkflow,
  'vidu-q2-i2v': modifyViduQ2I2VWorkflow,
  'multi-angles': modifyMultipleAnglesWorkflow,
  'multi-angles-scene': modifyMultipleAnglesWorkflow,
  'image-edit': modifyQwenImageEdit2509Workflow,
  'image-edit-model-product': modifyQwenImageEdit2509Workflow,
  'z-image-turbo': modifyZImageTurboWorkflow,
  'nano-banana-2': modifyNanoBanana2Workflow,
  'nano-banana-pro': modifyNanoBanana2Workflow,
  'grok-text-to-image': modifyGrokTextToImageWorkflow,
  'seedream-5-lite-image-edit': modifySeedream5LiteImageEditWorkflow,
  'music-gen': modifyMusicWorkflow,
  'google-gemini-flash-lite': modifyGeminiPromptWorkflow,
  'minimax-h3-media-promptor': modifyMinimaxH3MediaPromptWorkflow,
  [TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID]: modifyTopazVideoUpscaleWorkflow,
})

function getAllWorkflowOptions() {
  return [
    ...getFlowImageWorkflowOptions(),
    ...getFlowVideoWorkflowOptions(),
    ...getFlowVideoUpscaleWorkflowOptions(),
    ...getFlowAudioWorkflowOptions(),
    ...getFlowTextWorkflowOptions(),
  ]
}

function getWorkflowOption(workflowId = '') {
  return getAllWorkflowOptions().find((workflow) => workflow.id === workflowId) || null
}

export function resolveFlowNodeText(document, nodeOrId, visited = new Set()) {
  const nodesById = nodeMapFor(document)
  const node = typeof nodeOrId === 'string' ? nodesById.get(nodeOrId) : nodeOrId
  if (!node || typeof node !== 'object') return ''

  const nodeId = String(node?.id || '').trim()
  if (nodeId && visited.has(nodeId)) return ''

  const nextVisited = new Set(visited)
  if (nodeId) nextVisited.add(nodeId)

  if (node.type === FLOW_AI_NODE_TYPES.prompt) {
    return String(node?.data?.promptText || '').trim()
  }
  if (node.type === FLOW_AI_NODE_TYPES.promptAssist) {
    return String(node?.data?.outputText || '').trim()
  }
  if (node.type === FLOW_AI_NODE_TYPES.textViewer) {
    const parts = []
    for (const edge of collectIncomingEdges(document, node.id, 'in:text')) {
      const sourceNode = nodesById.get(edge.source)
      const text = resolveFlowNodeText(document, sourceNode, nextVisited)
      if (text) parts.push(text)
    }
    return parts.join('\n\n').trim()
  }
  return ''
}

function hasReusableNodeOutput(node) {
  if (!node || typeof node !== 'object') return false
  if (Array.isArray(node?.data?.outputAssetIds) && node.data.outputAssetIds.length > 0) {
    return true
  }
  if (node.type === FLOW_AI_NODE_TYPES.promptAssist) {
    return Boolean(String(node?.data?.outputText || '').trim())
  }
  return false
}

function extensionOf(filename = '') {
  const normalized = String(filename || '').trim()
  const parts = normalized.split('.')
  return parts.length > 1 ? parts.pop().toLowerCase() : ''
}

function isImageFilename(filename = '') {
  return IMAGE_EXTENSIONS.has(extensionOf(filename))
}

function isVideoFilename(filename = '') {
  return VIDEO_EXTENSIONS.has(extensionOf(filename))
}

function isAudioFilename(filename = '') {
  return AUDIO_EXTENSIONS.has(extensionOf(filename))
}

function isInputOutputType(item) {
  return String(item?.type || '').trim().toLowerCase() === 'input'
}

function extractFromItem(item) {
  if (!item || typeof item !== 'object') return null
  const filename = String(item.filename || '').trim()
  if (!filename) return null
  return {
    filename,
    subfolder: String(item.subfolder || '').trim(),
    outputType: String(item.type || 'output').trim() || 'output',
  }
}

function pickBestFromItems(items = [], matcher) {
  for (const item of items) {
    const info = extractFromItem(item)
    if (!info || isInputOutputType(info)) continue
    if (!matcher || matcher(info)) return info
  }
  return null
}

function scanOutputsAnyPrefix(outputs = {}, options = {}) {
  const preferVideo = Boolean(options.preferVideo)
  const collected = []

  for (const [nodeId, nodeOutput] of Object.entries(outputs || {})) {
    if (!nodeOutput || typeof nodeOutput !== 'object') continue
    for (const [key, value] of Object.entries(nodeOutput)) {
      if (!Array.isArray(value)) continue
      for (const item of value) {
        const info = extractFromItem(item)
        if (!info || isInputOutputType(info)) continue
        let kind = null
        if (isVideoFilename(info.filename)) kind = 'video'
        else if (isAudioFilename(info.filename)) kind = 'audio'
        else if (isImageFilename(info.filename)) kind = 'image'
        if (!kind) continue
        collected.push({ kind, nodeId, key, ...info })
      }
    }
  }

  if (collected.length === 0) return null

  collected.sort((left, right) => {
    if (preferVideo) {
      const leftVideo = left.kind === 'video' ? 1 : 0
      const rightVideo = right.kind === 'video' ? 1 : 0
      if (leftVideo !== rightVideo) return rightVideo - leftVideo
    }
    return String(right.filename || '').localeCompare(String(left.filename || ''))
  })

  const first = collected[0]
  if (first.kind === 'video') return { type: 'video', filename: first.filename, subfolder: first.subfolder, outputType: first.outputType }
  if (first.kind === 'audio') return { type: 'audio', filename: first.filename, subfolder: first.subfolder, outputType: first.outputType }
  return {
    type: 'images',
    items: collected
      .filter((entry) => entry.kind === 'image')
      .map((entry) => ({ type: 'image', filename: entry.filename, subfolder: entry.subfolder, outputType: entry.outputType })),
  }
}

function extractTextFromOutputs(outputs = {}) {
  const preferredKeys = [
    'preview_text',
    'TEXT',
    'text',
    'STRING',
    'string',
    'preview_markdown',
    'markdown',
    'result',
  ]

  for (const nodeOutput of Object.values(outputs || {})) {
    if (!nodeOutput || typeof nodeOutput !== 'object') continue

    for (const key of preferredKeys) {
      const value = nodeOutput[key]
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
      if (Array.isArray(value)) {
        const joined = value
          .map((entry) => (typeof entry === 'string' ? entry : ''))
          .join('\n')
          .trim()
        if (joined) return joined
      }
    }

    for (const value of Object.values(nodeOutput)) {
      if (typeof value === 'string' && value.trim()) {
        return value.trim()
      }
      if (Array.isArray(value)) {
        const joined = value
          .map((entry) => (typeof entry === 'string' ? entry : ''))
          .join('\n')
          .trim()
        if (joined) return joined
      }
    }
  }

  return ''
}

function sanitizeNameToken(value = '', fallback = 'flow') {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\s]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
  return cleaned || fallback
}

function ensureAssetFolderPath(pathSegments = []) {
  const segments = (Array.isArray(pathSegments) ? pathSegments : [])
    .map((segment) => String(segment || '').trim())
    .filter(Boolean)
  if (segments.length === 0) return null

  let parentId = null
  for (const segment of segments) {
    const assetsState = useAssetsStore.getState()
    const existing = (assetsState.folders || []).find((folder) => (
      folder.parentId === parentId && String(folder.name || '').trim() === segment
    ))
    if (existing) {
      parentId = existing.id
      continue
    }
    const next = assetsState.addFolder({ name: segment, parentId })
    parentId = next?.id || parentId
  }
  return parentId
}

function createNextNumberedAssetFolder(pathSegments = []) {
  const parentId = ensureAssetFolderPath(pathSegments)
  if (!parentId) return { folderId: null, folderSegments: pathSegments }

  const assetsState = useAssetsStore.getState()
  const highestExistingNumber = (assetsState.folders || []).reduce((highest, folder) => {
    if (folder.parentId !== parentId) return highest
    const name = String(folder.name || '').trim()
    if (!/^\d+$/.test(name)) return highest
    return Math.max(highest, Number(name) || 0)
  }, 0)
  const runFolderName = String(highestExistingNumber + 1).padStart(3, '0')
  const runFolder = assetsState.addFolder({ name: runFolderName, parentId })
  return {
    folderId: runFolder?.id || parentId,
    folderSegments: [...pathSegments, runFolderName],
  }
}

function collectIncomingEdges(document, targetNodeId, targetHandle = null) {
  return (document?.edges || []).filter((edge) => (
    edge.target === targetNodeId
    && (targetHandle == null || edge.targetHandle === targetHandle)
  ))
}

function nodeMapFor(document) {
  return new Map((document?.nodes || []).map((node) => [node.id, node]))
}

function getResultAssetKind(result) {
  if (result?.type === 'images') return 'image'
  if (result?.type === 'video') return 'video'
  if (result?.type === 'audio') return 'audio'
  return ''
}

function getOutputHandleForAssetKind(assetKind = '') {
  if (assetKind === 'image') return 'out:image'
  if (assetKind === 'video') return 'out:video'
  if (assetKind === 'audio') return 'out:audio'
  return ''
}

function getInputHandleForAssetKind(assetKind = '') {
  if (assetKind === 'image') return 'in:image'
  if (assetKind === 'video') return 'in:video'
  if (assetKind === 'audio') return 'in:audio'
  return ''
}

function resolveAssetOutputTarget(document, sourceNode, result, options = {}) {
  const assetKind = getResultAssetKind(result)
  if (!assetKind || !sourceNode?.id) return null

  if (assetKind === 'image' && options.numberedRunFolderState) {
    if (!options.numberedRunFolderState.target) {
      const outputNode = (document?.nodes || []).find((node) => node.type === FLOW_AI_NODE_TYPES.output)
      if (outputNode) {
        const baseFolderSegments = getFlowOutputFolderSegments(outputNode?.data?.folderName, 'image')
        const folderTarget = createNextNumberedAssetFolder(baseFolderSegments)
        options.numberedRunFolderState.target = {
          outputNode,
          folderSegments: folderTarget.folderSegments,
          folderId: folderTarget.folderId,
        }
      }
    }
    if (options.numberedRunFolderState.target) return options.numberedRunFolderState.target
  }

  const sourceHandle = getOutputHandleForAssetKind(assetKind)
  const targetHandle = getInputHandleForAssetKind(assetKind)
  const nodesById = nodeMapFor(document)

  for (const edge of document?.edges || []) {
    if (edge.source !== sourceNode.id) continue
    if (sourceHandle && edge.sourceHandle !== sourceHandle) continue
    if (targetHandle && edge.targetHandle !== targetHandle) continue

    const targetNode = nodesById.get(edge.target)
    if (targetNode?.type !== FLOW_AI_NODE_TYPES.output) continue

    const baseFolderSegments = getFlowOutputFolderSegments(targetNode?.data?.folderName, assetKind)
    const usesNumberedRunFolders = Boolean(targetNode?.data?.numberedRunFolders)
      || NUMBERED_RUN_FOLDER_TEMPLATE_IDS.has(String(document?.templateId || '').trim())
    const folderTarget = usesNumberedRunFolders
      ? createNextNumberedAssetFolder(baseFolderSegments)
      : {
        folderId: ensureAssetFolderPath(baseFolderSegments),
        folderSegments: baseFolderSegments,
      }
    return {
      outputNode: targetNode,
      folderSegments: folderTarget.folderSegments,
      folderId: folderTarget.folderId,
    }
  }

  return null
}

function assetMapFor() {
  return new Map((useAssetsStore.getState().assets || []).map((asset) => [asset.id, asset]))
}

function getExecutableNodeIds(document) {
  return (document?.nodes || [])
    .filter((node) => EXECUTABLE_NODE_TYPES.has(node.type))
    .map((node) => node.id)
}

function topologicalExecutionOrder(document, targetNodeId = null) {
  const nodesById = nodeMapFor(document)
  const executableIds = new Set(getExecutableNodeIds(document))
  let relevant = executableIds

  if (targetNodeId) {
    const upstreamExecutableIds = new Set()
    const visited = new Set()
    const visit = (nodeId) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      for (const edge of collectIncomingEdges(document, nodeId)) {
        if (executableIds.has(edge.source)) {
          upstreamExecutableIds.add(edge.source)
        }
        visit(edge.source)
      }
    }
    visit(targetNodeId)
    if (executableIds.has(targetNodeId)) upstreamExecutableIds.add(targetNodeId)
    relevant = upstreamExecutableIds
  }

  const indegree = new Map()
  const outgoing = new Map()
  for (const nodeId of relevant) {
    indegree.set(nodeId, 0)
    outgoing.set(nodeId, [])
  }

  for (const edge of document?.edges || []) {
    if (!relevant.has(edge.source) || !relevant.has(edge.target)) continue
    outgoing.get(edge.source)?.push(edge.target)
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1)
  }

  const queue = Array.from(relevant).filter((nodeId) => (indegree.get(nodeId) || 0) === 0)
  const ordered = []

  while (queue.length > 0) {
    const nodeId = queue.shift()
    ordered.push(nodeId)
    for (const nextId of outgoing.get(nodeId) || []) {
      const nextDegree = (indegree.get(nextId) || 0) - 1
      indegree.set(nextId, nextDegree)
      if (nextDegree === 0) queue.push(nextId)
    }
  }

  if (ordered.length !== relevant.size) {
    throw new Error('CANVAS detected a cycle between generation nodes. Remove the loop before running the canvas.')
  }

  return ordered.map((nodeId) => nodesById.get(nodeId)).filter(Boolean)
}

function pickAssetFromOutputIds(outputAssetIds = [], desiredType = '') {
  const assetsById = assetMapFor()
  for (const assetId of outputAssetIds || []) {
    const asset = assetsById.get(assetId)
    if (!asset) continue
    if (!desiredType || asset.type === desiredType) return asset
  }
  return null
}

function countMatchingOutputAssets(outputAssetIds = [], desiredType = '') {
  const assetsById = assetMapFor()
  let count = 0
  for (const assetId of outputAssetIds || []) {
    const asset = assetsById.get(assetId)
    if (!asset) continue
    if (!desiredType || asset.type === desiredType || (desiredType === 'image' && asset.type === 'video')) {
      count += 1
    }
  }
  return count
}

function findBundledExecutableInput(document, node, targetHandle, desiredType = 'image') {
  const nodesById = nodeMapFor(document)
  for (const edge of collectIncomingEdges(document, node.id, targetHandle)) {
    const sourceNode = nodesById.get(edge.source)
    if (!sourceNode || !getFlowNodeSupportsExecution(sourceNode.type)) continue
    const matchingCount = countMatchingOutputAssets(sourceNode?.data?.outputAssetIds, desiredType)
    if (matchingCount > 1) {
      return {
        sourceNode,
        matchingCount,
      }
    }
  }
  return null
}

function assertNoBundledExecutableInput(document, node, targetHandle, desiredType = 'image') {
  const bundled = findBundledExecutableInput(document, node, targetHandle, desiredType)
  if (!bundled) return
  const sourceLabel = String(bundled.sourceNode?.data?.label || bundled.sourceNode?.type || 'Upstream node').trim()
  const assetLabel = desiredType === 'image' ? 'image' : desiredType || 'asset'
  throw new Error(
    `CANVAS can't feed a bundled ${assetLabel} output from "${sourceLabel}" into another generation node yet. Save the bundle to Assets or set Variants to 1 until Pick Variant exists.`
  )
}

function resolveConnectedAsset(document, node, targetHandle, desiredType = 'image') {
  const nodesById = nodeMapFor(document)
  const incoming = collectIncomingEdges(document, node.id, targetHandle)
  for (const edge of incoming) {
    const sourceNode = nodesById.get(edge.source)
    if (!sourceNode) continue
    if (sourceNode.type === FLOW_AI_NODE_TYPES.imageInput || sourceNode.type === FLOW_AI_NODE_TYPES.styleReference) {
      const assetId = String(sourceNode?.data?.assetId || '').trim()
      if (!assetId) continue
      const asset = assetMapFor().get(assetId)
      if (!asset) continue
      if (!desiredType || asset.type === desiredType || (desiredType === 'image' && asset.type === 'video')) {
        return asset
      }
    }
    if (getFlowNodeSupportsExecution(sourceNode.type)) {
      const asset = pickAssetFromOutputIds(sourceNode?.data?.outputAssetIds, desiredType)
      if (asset) return asset
    }
  }
  return null
}

function resolveConnectedAssets(document, node, targetHandle, desiredType = 'image') {
  const nodesById = nodeMapFor(document)
  const assetsById = assetMapFor()
  const resolved = []
  for (const edge of collectIncomingEdges(document, node.id, targetHandle)) {
    const sourceNode = nodesById.get(edge.source)
    if (!sourceNode) continue
    if (sourceNode.type === FLOW_AI_NODE_TYPES.imageInput || sourceNode.type === FLOW_AI_NODE_TYPES.styleReference) {
      const asset = assetsById.get(String(sourceNode?.data?.assetId || '').trim())
      if (asset && (!desiredType || asset.type === desiredType || (desiredType === 'image' && asset.type === 'video'))) {
        resolved.push(asset)
      }
      continue
    }
    if (getFlowNodeSupportsExecution(sourceNode.type)) {
      const outputIds = Array.isArray(sourceNode?.data?.outputAssetIds) ? sourceNode.data.outputAssetIds : []
      for (const assetId of outputIds) {
        const asset = assetsById.get(assetId)
        if (asset && (!desiredType || asset.type === desiredType || (desiredType === 'image' && asset.type === 'video'))) {
          resolved.push(asset)
        }
      }
    }
  }
  return resolved
}

function resolvePromptText(document, node) {
  const nodesById = nodeMapFor(document)
  const parts = []
  for (const edge of collectIncomingEdges(document, node.id, 'in:text')) {
    const sourceNode = nodesById.get(edge.source)
    const text = resolveFlowNodeText(document, sourceNode)
    if (text) parts.push(text)
  }
  if (parts.length > 0) return parts.join('\n\n')
  if (node.type === FLOW_AI_NODE_TYPES.musicGen) {
    return String(node?.data?.lyrics || '').trim()
  }
  return String(node?.data?.inlinePrompt || '').trim()
}

function collectOutputAssetIds(document, nodeId) {
  const nodesById = nodeMapFor(document)
  const results = []
  for (const edge of collectIncomingEdges(document, nodeId)) {
    const sourceNode = nodesById.get(edge.source)
    if (!sourceNode) continue
    if (getFlowNodeSupportsExecution(sourceNode.type)) {
      for (const assetId of sourceNode?.data?.outputAssetIds || []) {
        if (!results.includes(assetId)) results.push(assetId)
      }
      continue
    }
    if (sourceNode.type === FLOW_AI_NODE_TYPES.imageInput || sourceNode.type === FLOW_AI_NODE_TYPES.styleReference) {
      const assetId = String(sourceNode?.data?.assetId || '').trim()
      if (assetId && !results.includes(assetId)) results.push(assetId)
    }
  }
  return results
}

export function computeOutputNodeAssetIds(document) {
  const next = {}
  for (const node of document?.nodes || []) {
    if (node.type !== FLOW_AI_NODE_TYPES.output) continue
    next[node.id] = collectOutputAssetIds(document, node.id)
  }
  return next
}

async function extractFrameAsFile(videoUrl, frameTime = 0, filename = 'frame.png') {
  return await new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.crossOrigin = 'anonymous'
    let finished = false

    const cleanup = () => {
      try {
        video.pause()
      } catch (_) {
        // ignore
      }
      video.removeAttribute('src')
      try {
        video.load()
      } catch (_) {
        // ignore
      }
    }

    const captureCurrentFrame = () => {
      if (finished) return
      finished = true
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const context = canvas.getContext('2d')
      if (!context) {
        cleanup()
        reject(new Error('Could not create canvas context for frame extraction'))
        return
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        cleanup()
        if (!blob) {
          reject(new Error('Failed to convert extracted video frame to PNG'))
          return
        }
        resolve(new File([blob], filename, { type: 'image/png' }))
      }, 'image/png')
    }

    video.onerror = () => {
      if (finished) return
      finished = true
      cleanup()
      reject(new Error('Failed to load video frame'))
    }

    video.onloadedmetadata = () => {
      const safeTime = Math.max(0, Math.min(Number(frameTime) || 0, Math.max(0, (video.duration || 0) - 0.05)))
      if (Number.isFinite(safeTime) && safeTime > 0.001) {
        video.currentTime = safeTime
      } else {
        if (video.readyState >= 2) {
          captureCurrentFrame()
        } else {
          video.currentTime = 0
        }
      }
    }

    video.onloadeddata = captureCurrentFrame
    video.onseeked = captureCurrentFrame

    video.src = videoUrl
  })
}

async function assetToUploadFile(asset, frameTime = 0, options = {}) {
  if (!asset?.url) {
    throw new Error('Asset has no playable URL')
  }
  if (asset.type === 'video' && !options.preserveVideo) {
    return await extractFrameAsFile(asset.url, frameTime, `${sanitizeNameToken(asset.name || 'frame', 'frame')}.png`)
  }

  const response = await fetch(asset.url)
  const blob = await response.blob()
  const sourceName = String(asset.name || '').trim()
  const sourceExtension = sourceName.match(/\.[a-z0-9]{2,8}$/i)?.[0] || ''
  const extension = (asset.type === 'image' || asset.type === 'mask')
    ? (sourceExtension || '.png')
    : asset.type === 'video'
      ? (sourceExtension || '.mp4')
      : '.bin'
  const baseName = sourceExtension ? sourceName.slice(0, -sourceExtension.length) : sourceName
  return new File([blob], `${sanitizeNameToken(baseName || 'asset', 'asset')}${extension}`, { type: blob.type || 'application/octet-stream' })
}

async function fitImageFileToSquare(file, size = 1024) {
  const targetSize = Math.max(64, Math.round(Number(size) || 1024))
  const bitmap = await createImageBitmap(file)
  try {
    if (bitmap.width === targetSize && bitmap.height === targetSize) return file
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create the square-image canvas.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, targetSize, targetSize)
    const scale = Math.min(targetSize / Math.max(1, bitmap.width), targetSize / Math.max(1, bitmap.height))
    const drawWidth = Math.max(1, Math.round(bitmap.width * scale))
    const drawHeight = Math.max(1, Math.round(bitmap.height * scale))
    const offsetX = Math.round((targetSize - drawWidth) / 2)
    const offsetY = Math.round((targetSize - drawHeight) / 2)
    context.drawImage(bitmap, offsetX, offsetY, drawWidth, drawHeight)
    const squareBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!squareBlob) throw new Error('Could not prepare the 1024 x 1024 multiple-angle source image.')
    const baseName = String(file?.name || 'character').replace(/\.[^.]+$/, '')
    return new File([squareBlob], `${sanitizeNameToken(baseName, 'character')}_${targetSize}x${targetSize}.png`, {
      type: 'image/png',
    })
  } finally {
    bitmap.close?.()
  }
}

async function resolveMinimaxH3Provider(classType) {
  const response = await comfyui.getObjectInfo(classType)
  const info = response?.[classType] || response
  const providerSpec = info?.input?.optional?.provider || info?.input?.required?.provider
  const choices = Array.isArray(providerSpec?.[0]) ? providerSpec[0] : []
  const defaultChoice = String(providerSpec?.[1]?.default || '').trim()
  if (defaultChoice && !/no provider configured|error loading providers/i.test(defaultChoice)) {
    return defaultChoice
  }
  const configured = choices.find((choice) => {
    const value = String(choice || '').trim()
    return value && !/no provider configured|error loading providers/i.test(value)
  })
  if (!configured) {
    throw new Error('MiniMax H3 Promptor has no LLM provider configured. Open ComfyUI Settings, configure a vision-capable provider for H3 Promptor, then run this node again.')
  }
  return String(configured)
}

async function loadWorkflowDefinition(workflowId) {
  const workflowPath = BUILTIN_WORKFLOW_PATHS[String(workflowId || '').trim()]
  if (!workflowPath) {
    throw new Error(`Unknown workflow "${workflowId}"`)
  }
  const response = await fetch(workflowPath)
  if (!response.ok) {
    throw new Error(`Failed to load workflow file: ${workflowPath} (${response.status})`)
  }
  return response.json()
}

function buildOutputPrefix(node, workflowId) {
  const token = `${sanitizeNameToken(node?.data?.label || workflowId || 'flow_ai', 'flow_ai')}_${Date.now()}`
  if (workflowId === 'music-gen' || TEXT_OUTPUT_WORKFLOW_IDS.has(String(workflowId || '').trim())) return ''
  if (SINGLE_VIDEO_WORKFLOW_IDS.has(workflowId)) return `video/${token}`
  return `image/${token}`
}

async function pollForResult(promptId, workflowId, expectedOutputPrefix = '', onStatus = () => {}) {
  const startedAt = Date.now()
  let lastActivityAt = Date.now()
  let wsReportedSuccess = false
  let consecutivePollErrors = 0

  const MAX_TOTAL_MS = 4 * 60 * 60 * 1000
  const PROGRESS_SILENCE_NOTICE_MS = 10 * 60 * 1000
  const POLL_INTERVAL_MS = 1000
  const MAX_POST_SUCCESS_TRIES = 8
  const maxConsecutivePollErrors = 5
  const normalizedExpectedPrefix = String(expectedOutputPrefix || '').trim().toLowerCase()

  const markActivity = () => {
    lastActivityAt = Date.now()
  }

  const subs = [
    ['progress', markActivity],
    ['executing', markActivity],
    ['executed', markActivity],
    ['execution_cached', markActivity],
    ['execution_start', markActivity],
    ['status', markActivity],
    ['complete', markActivity],
    ['execution_success', () => {
      markActivity()
      wsReportedSuccess = true
    }],
  ]

  for (const [eventName, handler] of subs) {
    try {
      comfyui.on(eventName, handler)
    } catch (_) {
      // ignore
    }
  }

  const matchesExpectedPrefix = (filename = '') => {
    if (!normalizedExpectedPrefix) return true
    return String(filename || '').toLowerCase().includes(normalizedExpectedPrefix)
  }

  try {
    let postSuccessTries = 0
    while (true) {
      const now = Date.now()
      const elapsed = now - startedAt
      const idleFor = now - lastActivityAt

      if (elapsed > MAX_TOTAL_MS) break
      if (wsReportedSuccess && postSuccessTries >= MAX_POST_SUCCESS_TRIES) break

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      if (wsReportedSuccess) postSuccessTries += 1

      const progressPct = Math.min(90, (elapsed / (15 * 60 * 1000)) * 90)
      onStatus({ progress: progressPct, statusMessage: 'Waiting for ComfyUI output…' })

      try {
        const history = await comfyui.getHistory(promptId)
        consecutivePollErrors = 0
        // A successful history response proves that ComfyUI is alive even when a
        // long model-load, offload, upscale, or tiled-decode stage emits no
        // WebSocket progress events. Keep polling until an output/error arrives;
        // actual server loss is handled by consecutivePollErrors below.
        if (!wsReportedSuccess && idleFor > PROGRESS_SILENCE_NOTICE_MS) {
          onStatus({
            progress: progressPct,
            statusMessage: 'ComfyUI is still responding. This video stage is not reporting progress, so CANVAS will keep waiting…',
          })
        }
        const outputs = history?.[promptId]?.outputs ?? history?.outputs
        const topStatus = history?.[promptId]?.status ?? history?.status

        if (topStatus?.status_str === 'error') {
          const messages = Array.isArray(topStatus.messages) ? topStatus.messages : []
          let friendly = 'ComfyUI reported an execution error.'
          for (let index = messages.length - 1; index >= 0; index -= 1) {
            const entry = messages[index]
            if (!Array.isArray(entry) || entry.length < 2) continue
            const [eventName, eventData] = entry
            if (eventName === 'execution_error') {
              const nodeId = eventData?.node_id != null ? String(eventData.node_id) : null
              const nodeType = eventData?.node_type ? String(eventData.node_type) : null
              const detail = String(eventData?.exception_message || '').trim()
              friendly = detail
                ? `ComfyUI failed at node ${nodeId || 'unknown'}${nodeType ? ` (${nodeType})` : ''}: ${detail}`
                : `ComfyUI reported an execution error at node ${nodeId || 'unknown'}${nodeType ? ` (${nodeType})` : ''}`
              break
            }
          }
          throw new Error(friendly)
        }

        if (!outputs || typeof outputs !== 'object') continue

        if (TEXT_OUTPUT_WORKFLOW_IDS.has(String(workflowId || '').trim())) {
          const outputText = extractTextFromOutputs(outputs)
          if (outputText) {
            return { type: 'text', text: outputText }
          }
        }

        for (const nodeOutput of Object.values(outputs)) {
          if (!nodeOutput || typeof nodeOutput !== 'object') continue
          for (const key of ['videos', 'gifs', 'video']) {
            const items = nodeOutput[key]
            if (!Array.isArray(items) || items.length === 0) continue
            const info = pickBestFromItems(items, (entry) => (
              isVideoFilename(entry.filename) && matchesExpectedPrefix(entry.filename)
            ))
            if (info) return { type: 'video', ...info }
          }
          // Custom nodes often publish GIFs under `images` (or another
          // arbitrary array key) even though the filename is animated media.
          for (const [key, items] of Object.entries(nodeOutput)) {
            if (['videos', 'gifs', 'video'].includes(key)) continue
            if (!Array.isArray(items) || items.length === 0) continue
            const info = pickBestFromItems(items, (entry) => (
              isVideoFilename(entry.filename) && matchesExpectedPrefix(entry.filename)
            ))
            if (info) return { type: 'video', ...info }
          }
        }

        const images = []
        for (const nodeOutput of Object.values(outputs)) {
          if (!nodeOutput || typeof nodeOutput !== 'object') continue
          for (const [key, value] of Object.entries(nodeOutput)) {
            if (!Array.isArray(value)) continue
            for (const item of value) {
              const info = extractFromItem(item)
              if (!info || isInputOutputType(info)) continue
              if (isImageFilename(info.filename) && matchesExpectedPrefix(info.filename)) {
                images.push({ type: 'image', ...info, key })
              }
            }
          }
        }
        if (images.length > 0) {
          return {
            type: 'images',
            items: images.map((image) => ({
              type: 'image',
              filename: image.filename,
              subfolder: image.subfolder,
              outputType: image.outputType,
            })),
          }
        }

        for (const nodeOutput of Object.values(outputs)) {
          if (!nodeOutput || typeof nodeOutput !== 'object') continue
          const audioCandidate = nodeOutput.audio
          if (audioCandidate) {
            const info = extractFromItem(Array.isArray(audioCandidate) ? audioCandidate[0] : audioCandidate)
            if (info && matchesExpectedPrefix(info.filename)) {
              return { type: 'audio', ...info }
            }
          }
          for (const value of Object.values(nodeOutput)) {
            if (!Array.isArray(value) || value.length === 0) continue
            const info = extractFromItem(value[0])
            if (info && isAudioFilename(info.filename) && matchesExpectedPrefix(info.filename)) {
              return { type: 'audio', ...info }
            }
          }
        }

        const status = history?.[promptId]?.status ?? history?.status
        if (status?.completed || status?.status_str === 'success') {
          if (TEXT_OUTPUT_WORKFLOW_IDS.has(String(workflowId || '').trim())) {
            const outputText = extractTextFromOutputs(outputs)
            if (outputText) {
              return { type: 'text', text: outputText }
            }
          }
          const fallback = scanOutputsAnyPrefix(outputs, {
            preferVideo: SINGLE_VIDEO_WORKFLOW_IDS.has(String(workflowId || '').trim()),
          })
          if (fallback) return fallback
        }
      } catch (error) {
        if (error instanceof Error && /ComfyUI reported|ComfyUI failed/.test(error.message)) {
          throw error
        }
        consecutivePollErrors += 1
        if (consecutivePollErrors >= maxConsecutivePollErrors) {
          throw new Error('Lost connection to ComfyUI while waiting for a CANVAS result.')
        }
      }
    }

    return null
  } finally {
    for (const [eventName, handler] of subs) {
      try {
        comfyui.off(eventName, handler)
      } catch (_) {
        // ignore
      }
    }
  }
}

function buildAssetBaseName(node, workflowId, promptText = '') {
  const generated = useAssetsStore.getState().generateName(promptText || node?.data?.label || workflowId || 'flow_ai')
  return sanitizeNameToken(`${node?.data?.label || workflowId || 'flow_ai'}_${generated}`, 'flow_ai')
}

function buildVariantOutputPrefix(basePrefix = '', variantIndex = 0) {
  if (!basePrefix) return ''
  return `${basePrefix}_v${String((variantIndex || 0) + 1).padStart(2, '0')}`
}

async function importRunResult({
  result,
  node,
  workflowId,
  promptText = '',
  tagsText = '',
  promptId,
  documentId,
  document,
  baseName: explicitBaseName = '',
  imageIndexOffset = 0,
  numberedRunFolderState = null,
}) {
  const projectHandle = useProjectStore.getState().currentProjectHandle
  const addAsset = useAssetsStore.getState().addAsset
  const importedAssets = []
  const baseName = sanitizeNameToken(explicitBaseName || buildAssetBaseName(node, workflowId, promptText || tagsText), 'flow_ai')
  const outputTarget = resolveAssetOutputTarget(document, node, result, { numberedRunFolderState })

  const flowMetadata = {
    documentId,
    nodeId: node.id,
    workflowId,
    promptId,
    runtime: getWorkflowHardwareInfo(workflowId)?.runtime || 'local',
    importedAt: new Date().toISOString(),
    assetOutputNodeId: outputTarget?.outputNode?.id || null,
    assetOutputFolder: outputTarget?.folderSegments || null,
  }

  if (result?.type === 'video') {
    const gifOutput = isGifFilename(result.filename)
    const shouldNormalizeGif = gifOutput && canImportGifMedia()
    try {
      const videoFile = await comfyui.downloadVideo(result.filename, result.subfolder, result.outputType)
      const assetInfo = shouldNormalizeGif
        ? await importGifAsset(projectHandle, videoFile)
        : await importAsset(projectHandle, videoFile, gifOutput ? 'images' : 'video')
      const assetType = assetInfo?.type || 'video'
      const folderId = outputTarget?.folderId || ensureAssetFolderPath(
        assetType === 'image' ? GENERATED_ASSET_FOLDERS.image : GENERATED_ASSET_FOLDERS.video
      )
      const normalizedGif = assetInfo?.settings?.gifSource?.animated === true
      const assetUrl = assetInfo?.url || URL.createObjectURL(videoFile)
      const asset = addAsset({
        ...assetInfo,
        name: baseName,
        type: assetType,
        url: assetUrl,
        prompt: promptText,
        isImported: true,
        folderId,
        settings: {
          ...(assetInfo?.settings || {}),
          duration: normalizedGif ? assetInfo.duration : node?.data?.duration,
          fps: normalizedGif ? assetInfo.fps : node?.data?.fps,
          seed: node?.data?.seed,
          resolution: `${node?.data?.width || ''}x${node?.data?.height || ''}`,
        },
        flowAi: flowMetadata,
      })
      if (asset) importedAssets.push(asset)
      if (assetType === 'video' && isElectron() && projectHandle && asset?.absolutePath && !normalizedGif) {
        enqueuePlaybackTranscode(projectHandle, asset.id, asset.absolutePath).catch(() => {})
        if (isProxyPlaybackEnabled()) {
          enqueueProxyTranscode(projectHandle, asset.id, asset.absolutePath).catch(() => {})
        }
      }
    } catch (error) {
      if (shouldNormalizeGif) throw error
      const fallbackUrl = comfyui.getMediaUrl(result.filename, result.subfolder, result.outputType)
      const fallbackType = gifOutput ? 'image' : 'video'
      const folderId = outputTarget?.folderId || ensureAssetFolderPath(
        fallbackType === 'image' ? GENERATED_ASSET_FOLDERS.image : GENERATED_ASSET_FOLDERS.video
      )
      const asset = addAsset({
        name: baseName,
        type: fallbackType,
        url: fallbackUrl,
        prompt: promptText,
        folderId,
        settings: {
          duration: node?.data?.duration,
          fps: node?.data?.fps,
          seed: node?.data?.seed,
        },
        flowAi: flowMetadata,
      })
      if (asset) importedAssets.push(asset)
    }
  }

  if (result?.type === 'images') {
    const folderId = outputTarget?.folderId || ensureAssetFolderPath(GENERATED_ASSET_FOLDERS.image)
    let index = Math.max(0, Math.round(Number(imageIndexOffset) || 0))
    for (const image of result.items || []) {
      index += 1
      const imageName = `${baseName}_${String(index).padStart(2, '0')}`
      try {
        const imageFile = await comfyui.downloadImage(image.filename, image.subfolder, image.outputType)
        const assetInfo = await importAsset(projectHandle, imageFile, 'images', {
          subfolderSegments: outputTarget?.folderSegments || [],
        })
        const blobUrl = URL.createObjectURL(imageFile)
        const asset = addAsset({
          ...assetInfo,
          name: imageName,
          type: 'image',
          url: blobUrl,
          prompt: promptText,
          isImported: true,
          folderId,
          flowAi: flowMetadata,
        })
        if (asset) importedAssets.push(asset)
      } catch (error) {
        const fallbackUrl = comfyui.getMediaUrl(image.filename, image.subfolder, image.outputType)
        const asset = addAsset({
          name: imageName,
          type: 'image',
          url: fallbackUrl,
          prompt: promptText,
          folderId,
          flowAi: flowMetadata,
        })
        if (asset) importedAssets.push(asset)
      }
    }
  }

  if (result?.type === 'audio') {
    const folderId = outputTarget?.folderId || ensureAssetFolderPath(GENERATED_ASSET_FOLDERS.audio)
    try {
      const mediaUrl = comfyui.getMediaUrl(result.filename, result.subfolder, result.outputType)
      const response = await fetch(mediaUrl)
      const blob = await response.blob()
      const file = new File([blob], result.filename, { type: 'audio/mpeg' })
      const assetInfo = await importAsset(projectHandle, file, 'audio')
      const blobUrl = URL.createObjectURL(file)
      const asset = addAsset({
        ...assetInfo,
        name: baseName,
        type: 'audio',
        url: blobUrl,
        prompt: tagsText,
        isImported: true,
        folderId,
        settings: {
          duration: node?.data?.duration,
          bpm: node?.data?.bpm,
          keyscale: node?.data?.keyscale,
          seed: node?.data?.seed,
        },
        flowAi: flowMetadata,
      })
      if (asset) importedAssets.push(asset)
    } catch (error) {
      const fallbackUrl = comfyui.getMediaUrl(result.filename, result.subfolder, result.outputType)
      const asset = addAsset({
        name: baseName,
        type: 'audio',
        url: fallbackUrl,
        prompt: tagsText,
        folderId,
        flowAi: flowMetadata,
      })
      if (asset) importedAssets.push(asset)
    }
  }

  return importedAssets
}

async function configureWorkflow(workflowId, workflowJson, context) {
  const modifier = WORKFLOW_MODIFIERS[workflowId]
  if (!modifier) {
    throw new Error(`CANVAS does not know how to configure workflow "${workflowId}" yet.`)
  }

  switch (workflowId) {
    case 'minimax-h3-character-sheet':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        referenceImages: context.referenceFilenames,
        width: context.width,
        height: context.height,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'image/CANVAS_h3_character_sheet',
      })
    case 'minimax-h3-gguf-i2v':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        lastImage: context.lastFrameFilename,
        width: context.width,
        height: context.height,
        duration: context.duration,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/CANVAS_minimax_h3_gguf',
      })
    case 'wan22-i2v':
      return modifier(workflowJson, {
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        frames: Math.round((context.duration || 5) * (context.fps || 24)) + 1,
        fps: context.fps,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/flow_ai_wan',
        qualityPreset: context.wanQualityPreset || 'balanced',
      })
    case 'ltx23-i2v':
      return modifier(workflowJson, {
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        frames: Math.round((context.duration || 5) * (context.fps || 24)) + 1,
        fps: context.fps,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/flow_ai_ltx',
      })
    case 'kling-o3-i2v':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        duration: context.duration,
        frames: Math.round((context.duration || 5) * (context.fps || 24)) + 1,
        fps: context.fps,
        seed: context.seed,
        generateAudio: false,
        filenamePrefix: context.outputPrefix || 'video/flow_ai_kling',
      })
    case 'grok-video-i2v':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        duration: context.duration,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/flow_ai_grok',
      })
    case 'vidu-q2-i2v':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        duration: context.duration,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/flow_ai_vidu',
      })
    case 'multi-angles':
    case 'multi-angles-scene':
      return modifier(workflowJson, {
        inputImage: context.uploadedFilename,
        seed: context.seed,
        filenamePrefix: context.outputPrefix,
      })
    case 'image-edit':
    case 'image-edit-model-product':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        seed: context.seed,
        width: context.preserveInputResolution ? null : context.width,
        height: context.preserveInputResolution ? null : context.height,
        referenceImages: context.referenceFilenames,
        maskImage: context.maskFilename,
        variantCount: context.variantCount,
        filenamePrefix: context.outputPrefix || 'image/flow_ai_edit',
      })
    case 'z-image-turbo':
      return modifier(workflowJson, {
        prompt: context.promptText,
        seed: context.seed,
        width: context.width,
        height: context.height,
        variantCount: context.variantCount,
        filenamePrefix: context.outputPrefix || 'image/flow_ai_z_image',
      })
    case 'nano-banana-2':
    case 'nano-banana-pro':
      return modifier(workflowJson, {
        prompt: context.promptText,
        seed: context.seed,
        width: context.width,
        height: context.height,
        referenceImages: context.referenceFilenames,
        variantCount: context.variantCount,
        filenamePrefix: context.outputPrefix || 'image/flow_ai_nano_banana',
      })
    case 'grok-text-to-image':
      return modifier(workflowJson, {
        prompt: context.promptText,
        seed: context.seed,
        width: context.width,
        height: context.height,
        variantCount: context.variantCount,
        filenamePrefix: context.outputPrefix || 'image/flow_ai_grok_image',
      })
    case 'seedream-5-lite-image-edit':
      return modifier(workflowJson, {
        prompt: context.promptText,
        seed: context.seed,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        referenceImages: context.referenceFilenames,
        variantCount: context.variantCount,
        filenamePrefix: context.outputPrefix || 'image/flow_ai_seedream',
      })
    case 'music-gen':
      return modifier(workflowJson, {
        tags: context.tags,
        lyrics: context.lyrics,
        duration: context.duration,
        bpm: context.bpm,
        seed: context.seed,
        keyscale: context.keyscale,
      })
    case 'google-gemini-flash-lite':
      return modifier(workflowJson, {
        prompt: context.promptText,
        seed: context.seed,
        systemPrompt: context.systemPrompt,
        inputImage: context.uploadedFilename,
      })
    case 'minimax-h3-media-promptor':
      return modifier(workflowJson, {
        description: context.promptText,
        duration: context.duration,
        uploadedFilename: context.uploadedFilename,
        mediaKind: context.uploadedMediaKind,
        visionProvider: context.visionProvider,
        promptorProvider: context.promptorProvider,
        outputLanguage: context.outputLanguage,
        imageMode: context.imageAnalysisMode,
        videoMode: context.videoAnalysisMode,
      })
    case TOPAZ_VIDEO_UPSCALE_WORKFLOW_ID:
      return modifier(workflowJson, {
        inputVideo: context.uploadedFilename,
        upscalerModel: context.upscaleModel,
        upscalerResolution: context.targetResolution,
        upscalerCreativity: context.upscaleCreativity,
        filenamePrefix: context.outputPrefix || 'video/flow_ai_topaz_upscale',
      })
    default:
      throw new Error(`Unhandled CANVAS workflow "${workflowId}"`)
  }
}

async function buildExecutionContext(document, node) {
  const workflowId = String(node?.data?.workflowId || '').trim()
  const workflowOption = getWorkflowOption(workflowId)
  if (!workflowOption) {
    throw new Error('Choose a valid workflow before running this node.')
  }

  assertNoBundledExecutableInput(document, node, 'in:image', 'image')
  assertNoBundledExecutableInput(document, node, 'in:mask', '')
  assertNoBundledExecutableInput(document, node, 'in:last-image', 'image')
  assertNoBundledExecutableInput(document, node, 'in:style', 'image')
  assertNoBundledExecutableInput(document, node, 'in:video', 'video')

  const promptText = resolvePromptText(document, node)
  const primaryAsset = resolveConnectedAsset(document, node, 'in:image', 'image')
  const maskAsset = resolveConnectedAsset(document, node, 'in:mask', '')
  const lastFrameAsset = resolveConnectedAsset(document, node, 'in:last-image', 'image')
  const videoAsset = resolveConnectedAsset(document, node, 'in:video', 'video')
  const styleAssets = resolveConnectedAssets(document, node, 'in:style', 'image')
  const isMinimaxH3Promptor = workflowId === 'minimax-h3-media-promptor'
  const mediaAsset = isMinimaxH3Promptor ? (videoAsset || primaryAsset) : primaryAsset

  const needsImage = Boolean(workflowOption.needsImage)
  if (needsImage && !primaryAsset) {
    throw new Error('This workflow needs an upstream image input or image generation result.')
  }
  if (node?.data?.optionalStage === 'inpaint' && !maskAsset) {
    throw new Error('Turn Inpaint off, or connect an Inpaint Mask before running this optional edit.')
  }
  if (node?.data?.requiresLastFrame && !lastFrameAsset) {
    throw new Error('This flow needs both a Start Frame and a Last Frame image.')
  }
  if (isMinimaxH3Promptor && !mediaAsset) {
    throw new Error('MiniMax H3 Media Promptor needs an upstream image or video asset.')
  }

  const width = Number(node?.data?.width) || 1280
  const height = Number(node?.data?.height) || 720
  const seed = Number(node?.data?.seed)
  const duration = Number(node?.data?.duration) || 5
  const fps = Number(node?.data?.fps) || 24
  const outputPrefix = buildOutputPrefix(node, workflowId)
  const imageVariantBehavior = node?.type === FLOW_AI_NODE_TYPES.imageGen
    ? getFlowImageVariantBehavior(workflowId)
    : null
  const variantCount = node?.type === FLOW_AI_NODE_TYPES.imageGen
    ? normalizeFlowImageVariantCount(node?.data?.variantCount, workflowId)
    : 1

  let uploadedFilename = null
  if (mediaAsset) {
    let fileToUpload = await assetToUploadFile(mediaAsset, Number(node?.data?.frameTime) || 0, {
      preserveVideo: isMinimaxH3Promptor && mediaAsset.type === 'video',
    })
    if (['multi-angles', 'multi-angles-scene'].includes(workflowId)) {
      fileToUpload = await fitImageFileToSquare(fileToUpload, 1024)
    }
    const uploadResult = await comfyui.uploadFile(fileToUpload)
    uploadedFilename = uploadResult?.name || fileToUpload.name
  }

  let lastFrameFilename = null
  if (lastFrameAsset) {
    const lastFrameFile = await assetToUploadFile(lastFrameAsset, Number(node?.data?.lastFrameTime) || 0)
    const lastFrameUpload = await comfyui.uploadFile(
      lastFrameFile,
      `canvas_last_${Date.now()}_${lastFrameFile.name || 'frame.png'}`
    )
    lastFrameFilename = lastFrameUpload?.name || lastFrameFile.name
  }

  let maskFilename = null
  if (maskAsset) {
    const maskFile = await assetToUploadFile(maskAsset, 0)
    const maskUpload = await comfyui.uploadFile(
      maskFile,
      `canvas_inpaint_mask_${Date.now()}_${maskFile.name || 'mask.png'}`
    )
    maskFilename = maskUpload?.name || maskFile.name
  }

  const h3Providers = isMinimaxH3Promptor
    ? await Promise.all([
        resolveMinimaxH3Provider('H3_Vision_Analyzer'),
        resolveMinimaxH3Provider('H3_Promptor'),
      ])
    : ['', '']

  const referenceFilenames = []
  if (styleAssets.length > 0) {
    for (const asset of styleAssets.slice(0, 2)) {
      const fileToUpload = await assetToUploadFile(asset, 0)
      const uploadResult = await comfyui.uploadFile(fileToUpload)
      referenceFilenames.push(uploadResult?.name || fileToUpload.name)
    }
  }

  return {
    workflowId,
    workflowOption,
    promptText,
    negativePrompt: String(node?.data?.negativePrompt || '').trim(),
    systemPrompt: String(node?.data?.systemPrompt || '').trim(),
    tags: String(node?.data?.tags || '').trim(),
    lyrics: promptText || String(node?.data?.lyrics || '').trim(),
    width,
    height,
    duration,
    fps,
    bpm: Number(node?.data?.bpm) || 120,
    keyscale: String(node?.data?.keyscale || 'C Major').trim(),
    seed: Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1000000),
    wanQualityPreset: String(node?.data?.wanQualityPreset || 'balanced').trim(),
    variantCount,
    imageVariantBehavior,
    preserveInputResolution: Boolean(node?.data?.preserveInputResolution),
    uploadedFilename,
    lastFrameFilename,
    uploadedMediaKind: mediaAsset?.type === 'video' ? 'video' : 'image',
    visionProvider: h3Providers[0],
    promptorProvider: h3Providers[1],
    outputLanguage: String(node?.data?.outputLanguage || 'English'),
    imageAnalysisMode: String(node?.data?.imageAnalysisMode || 'Comprehensive'),
    videoAnalysisMode: String(node?.data?.videoAnalysisMode || 'Comprehensive'),
    referenceFilenames,
    maskFilename,
    outputPrefix,
  }
}

async function runExecutablePromptAttempt(document, node, context, options = {}) {
  const workflowId = String(node?.data?.workflowId || '').trim()
  const workflowJson = await loadWorkflowDefinition(workflowId)
  const modifiedWorkflow = await configureWorkflow(workflowId, workflowJson, context)
  const totalRuns = Math.max(1, Math.round(Number(options.totalRuns) || 1))
  const runIndex = Math.max(0, Math.round(Number(options.runIndex) || 0))
  const isBundledRepeatRun = totalRuns > 1
  const runLabel = isBundledRepeatRun ? `variant ${runIndex + 1} of ${totalRuns}` : 'prompt'

  options.onNodePatch?.(node.id, {
    status: 'queuing',
    statusMessage: isBundledRepeatRun ? `Queueing ${runLabel} in ComfyUI…` : 'Queueing prompt in ComfyUI…',
    error: '',
  })

  const promptId = await comfyui.queuePrompt(modifiedWorkflow)
  if (!promptId) {
    throw new Error('Failed to queue CANVAS prompt.')
  }
  markPromptHandledByApp(promptId)

  options.onNodePatch?.(node.id, {
    status: 'running',
    statusMessage: isBundledRepeatRun ? `Generating ${runLabel}…` : 'Running workflow…',
    lastPromptId: promptId,
    error: '',
  })

  const result = await pollForResult(promptId, workflowId, context.outputPrefix, (status) => {
    const rawProgress = Math.max(0, Math.min(100, Number(status?.progress) || 0))
    const overallProgress = isBundledRepeatRun
      ? Math.min(99, (((runIndex) + (rawProgress / 100)) / totalRuns) * 100)
      : rawProgress
    options.onNodePatch?.(node.id, {
      status: 'running',
      statusMessage: isBundledRepeatRun ? `Generating ${runLabel}…` : (status?.statusMessage || 'Running workflow…'),
      progress: overallProgress,
    })
  })

  if (!result) {
    throw new Error('Generation finished but CANVAS could not detect the output.')
  }

  if (result.type === 'text') {
    return {
      promptId,
      importedAssets: [],
      workflowId,
      textOutput: result.text,
    }
  }

  const importedAssets = await importRunResult({
    result,
    node,
    workflowId,
    promptText: context.promptText,
    tagsText: context.tags,
    promptId,
    documentId: options.documentId,
    document,
    baseName: options.baseName,
    imageIndexOffset: options.imageIndexOffset,
    numberedRunFolderState: options.numberedRunFolderState,
  })

  if (importedAssets.length === 0) {
    throw new Error('CANVAS did not import any output assets from this run.')
  }

  return {
    promptId,
    importedAssets,
    workflowId,
    textOutput: '',
  }
}

async function runExecutableNode(document, node, options = {}) {
  const projectState = useProjectStore.getState()
  if (!projectState.currentProjectHandle) {
    throw new Error('Open a project before running CANVAS.')
  }

  const workflowId = String(node?.data?.workflowId || '').trim()
  const dependencyCheck = await checkWorkflowDependencies(workflowId)
  if (dependencyCheck?.hasBlockingIssues) {
    if (dependencyCheck.missingAuth) {
      throw new Error(`Workflow ${workflowId} needs a Comfy partner API key or other setup before it can run.`)
    }
    if ((dependencyCheck.missingNodes || []).length > 0 || (dependencyCheck.missingModels || []).length > 0) {
      throw new Error(`Workflow ${workflowId} is missing dependencies. Open Workflow Setup to install the required nodes/models.`)
    }
  }

  if (node.type === FLOW_AI_NODE_TYPES.videoUpscale) {
    assertNoBundledExecutableInput(document, node, 'in:video', 'video')
    const sourceAsset = resolveConnectedAsset(document, node, 'in:video', 'video')
    if (!sourceAsset) {
      throw new Error('This workflow needs an upstream video input.')
    }

    const outputTarget = resolveAssetOutputTarget(document, node, { type: 'video' })
    const flowMetadata = {
      documentId: options.documentId,
      nodeId: node.id,
      workflowId,
      promptId: null,
      runtime: getWorkflowHardwareInfo(workflowId)?.runtime || 'cloud',
      importedAt: new Date().toISOString(),
      assetOutputNodeId: outputTarget?.outputNode?.id || null,
      assetOutputFolder: outputTarget?.folderSegments || null,
    }

    const topazResult = await runTopazVideoUpscale({
      sourceAsset,
      folderId: outputTarget?.folderId || ensureAssetFolderPath(GENERATED_ASSET_FOLDERS.video),
      baseName: buildTopazVideoUpscaleBaseName(sourceAsset, node?.data?.targetResolution),
      model: node?.data?.upscaleModel,
      targetResolution: node?.data?.targetResolution,
      creativity: node?.data?.upscaleCreativity,
      skipDependencyCheck: true,
      flowMetadata,
      onStatus: (status) => {
        const normalizedStatus = (
          status?.status === 'checking'
            ? 'checking'
            : status?.status === 'queuing'
              ? 'queuing'
              : 'running'
        )
        const patch = {
          status: normalizedStatus,
          statusMessage: status?.statusMessage || 'Running workflow…',
          progress: Math.max(0, Math.min(100, Number(status?.progress) || 0)),
          error: '',
        }
        if (status?.promptId) {
          patch.lastPromptId = status.promptId
        }
        if (status?.estimatedCredits) {
          patch.estimatedCredits = status.estimatedCredits
          patch.estimatedCreditsSource = status?.estimatedCreditsSource || 'live-progress-text'
        }
        options.onNodePatch?.(node.id, patch)
      },
    })
    return {
      ...topazResult,
      textOutput: '',
    }
  }

  const context = await buildExecutionContext(document, node)
  const imageVariantBehavior = context.imageVariantBehavior || { mode: 'repeat' }
  const shouldRepeatImageRuns = (
    node.type === FLOW_AI_NODE_TYPES.imageGen
    && imageVariantBehavior.mode === 'repeat'
    && Number(context.variantCount) > 1
  )

  if (!shouldRepeatImageRuns) {
    return runExecutablePromptAttempt(document, node, context, options)
  }

  const totalRuns = Math.max(1, Math.round(Number(context.variantCount) || 1))
  const bundledBaseName = buildAssetBaseName(node, workflowId, context.promptText || context.tags)
  const importedAssets = []
  let lastPromptId = null

  for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
    const runContext = {
      ...context,
      variantCount: 1,
      seed: (Number.isFinite(context.seed) ? context.seed : Math.floor(Math.random() * 1000000)) + runIndex,
      outputPrefix: buildVariantOutputPrefix(context.outputPrefix, runIndex),
    }
    const runResult = await runExecutablePromptAttempt(document, node, runContext, {
      ...options,
      runIndex,
      totalRuns,
      baseName: bundledBaseName,
      imageIndexOffset: importedAssets.length,
    })
    importedAssets.push(...runResult.importedAssets)
    lastPromptId = runResult.promptId
    options.onNodePatch?.(node.id, {
      status: 'running',
      statusMessage: `Bundled ${importedAssets.length} of ${totalRuns} image variants…`,
      progress: Math.min(99, ((runIndex + 1) / totalRuns) * 100),
    })
  }

  return {
    promptId: lastPromptId,
    importedAssets,
    workflowId,
  }
}

export async function runFlowGraph(document, options = {}) {
  const targetNodeId = options.targetNodeId || null
  const forceRunAll = Boolean(options.forceRunAll)
  const workingDocument = {
    ...document,
    nodes: (document?.nodes || []).map((node) => ({
      ...node,
      data: { ...(node?.data || {}) },
    })),
    edges: (document?.edges || []).map((edge) => ({ ...edge })),
  }
  const orderedNodes = topologicalExecutionOrder(workingDocument, targetNodeId)

  if (orderedNodes.length === 0) {
    return { ranNodeIds: [], importedAssetIds: [], textOutputNodeIds: [] }
  }

  const ranNodeIds = []
  const importedAssetIds = []
  const textOutputNodeIds = []
  const numberedRunFolderState = documentUsesNumberedRunFolders(workingDocument)
    ? { target: null }
    : null
  const patchWorkingNode = (nodeId, patch) => {
    const nextPatch = typeof patch === 'function'
      ? patch(workingDocument.nodes.find((candidate) => candidate.id === nodeId) || null)
      : patch
    if (!nextPatch || typeof nextPatch !== 'object') return
    workingDocument.nodes = workingDocument.nodes.map((node) => (
      node.id === nodeId
        ? { ...node, data: { ...(node.data || {}), ...nextPatch } }
        : node
    ))
    options.onNodePatch?.(nodeId, nextPatch)
  }

  for (const node of orderedNodes) {
    const liveNode = workingDocument.nodes.find((candidate) => candidate.id === node.id) || node
    if (liveNode?.data?.optionalStage === 'inpaint' && liveNode?.data?.enabled !== true) {
      const passthroughAsset = resolveConnectedAsset(workingDocument, liveNode, 'in:image', 'image')
      if (!passthroughAsset) {
        const error = new Error('The optional Inpaint stage needs an upstream character image to pass through.')
        patchWorkingNode(node.id, {
          status: 'error',
          error: error.message,
          statusMessage: '',
          progress: 0,
        })
        throw error
      }
      patchWorkingNode(node.id, {
        status: 'done',
        statusMessage: 'Inpaint is off — using the original character image unchanged.',
        error: '',
        outputAssetIds: [passthroughAsset.id],
        progress: 100,
      })
      continue
    }
    const shouldRun = forceRunAll || !targetNodeId || node.id === targetNodeId || !hasReusableNodeOutput(liveNode)
    if (!shouldRun) {
      patchWorkingNode(node.id, {
        status: 'done',
        statusMessage: 'Using previous output for this branch.',
        error: '',
      })
      continue
    }

    patchWorkingNode(node.id, {
      status: 'checking',
      statusMessage: 'Checking workflow readiness…',
      error: '',
      progress: 0,
      ...(node.type === FLOW_AI_NODE_TYPES.videoUpscale
        ? {
          estimatedCredits: null,
          estimatedCreditsSource: null,
        }
        : {}),
    })

    let result = null
    try {
      result = await runExecutableNode(workingDocument, liveNode, {
        documentId: options.documentId,
        numberedRunFolderState,
        onNodePatch: patchWorkingNode,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'CANVAS run failed.')
      patchWorkingNode(node.id, {
        status: 'error',
        error: message,
        statusMessage: '',
        progress: 0,
      })
      throw error
    }

    const outputAssetIds = result.importedAssets.map((asset) => asset.id).filter(Boolean)
    const textOutput = String(result?.textOutput || '')
    ranNodeIds.push(node.id)
    importedAssetIds.push(...outputAssetIds)
    if (textOutput.trim()) {
      textOutputNodeIds.push(node.id)
    }
    const successMessage = (
      textOutput.trim()
        ? 'Updated prompt output.'
        : node.type === FLOW_AI_NODE_TYPES.imageGen && outputAssetIds.length > 1
        ? `Imported ${outputAssetIds.length} image variants.`
        : `Imported ${outputAssetIds.length} asset${outputAssetIds.length === 1 ? '' : 's'}.`
    )

    patchWorkingNode(node.id, {
      status: 'done',
      statusMessage: successMessage,
      error: '',
      outputAssetIds,
      outputText: textOutput,
      lastRunAt: new Date().toISOString(),
      lastPromptId: result.promptId,
      progress: 100,
    })
  }

  const saveProject = useProjectStore.getState().saveProject
  try {
    await saveProject()
  } catch (_) {
    // ignore
  }

  return {
    ranNodeIds,
    importedAssetIds,
    textOutputNodeIds,
  }
}
