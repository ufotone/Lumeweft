import { generationMemory } from './generationMemory'
import { modifyAinvfxFluidWorkflow, validateAinvfxFluidSettings } from './ainvfxFluidWorkflow.mjs'
import comfyui, {
  modifyVdnH3Workflow,
  modifyFastMinimaxH3Workflow,
  modifyGeminiPromptWorkflow,
  modifyMinimaxH3MediaPromptWorkflow,
  modifyMinimaxH3CharacterSheetWorkflow,
  modifyMinimaxH3GGUFI2VWorkflow,
  modifyMinimaxH3GGUFReferenceWorkflow,
  modifyMinimaxH3PinkReferenceWorkflow,
  modifyGrokTextToImageWorkflow,
  modifyGrokVideoI2VWorkflow,
  modifyKlingO3I2VWorkflow,
  modifyLTX23I2VWorkflow,
  modifyLTX23LatentSyncWorkflow,
  modifyIrodoriTextToSpeechWorkflow,
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
import { getProjectFileUrl, importAsset, isElectron } from './fileSystem'
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
import { IRODORI_ANIME_MODEL_FILENAME } from '../config/shortFilmConfig'
import { buildTopazVideoUpscaleBaseName, runTopazVideoUpscale } from './topazVideoUpscale'
import { modifyAnimaLoraUpscaleWorkflow } from './animaLoraUpscaleWorkflow'
import { ORTENZYA_WORKFLOW_ID, generateOrtenzyaText } from './ortenzyaCanvas.mjs'
import { saveCanvasTextAsset } from './canvasTextAssets.mjs'
import { optimizeH3Prompt } from './h3PromptOptimizer.mjs'
import { searchBundledJpTags } from './jpTagAssistant.mjs'
import { createNumberedReferenceSheet, planNumberedReferenceSheets } from './numberedReferenceSheets.mjs'
import { modifyDarkBeastKrea2I2IWorkflow } from './darkBeastKrea2I2IWorkflow.mjs'
import { modifyHarukiMixKrea2Workflow } from './harukiMixKrea2Workflow.mjs'
import { modifyNsfwWan13bWorkflow } from './nsfwWan13bWorkflow.mjs'
import { modifyQwenImage21CharacterSheetWorkflow, modifyQwenImage21HereticEditWorkflow, modifyQwenImage21HereticWorkflow } from './qwenImage21HereticWorkflow.mjs'
import { createGoogleVideo, downloadGoogleMedia, generateGoogleImage, getGoogleVideoOperation } from './cloudRuntimes'
import { buildCharacterPrompt, createCharacterFile, readCharacterFile, selectCharacterReferences } from './characterFile.mjs'
import { modifyMinimaxH3CharacterActorWorkflow } from './minimaxH3CharacterActorWorkflow.mjs'
import { modifyMinimaxH3360OrbitWorkflow } from './minimaxH3360OrbitWorkflow.mjs'
import { modifyMinimaxH3HandheldWorkflow } from './minimaxH3HandheldWorkflow.mjs'

const EXECUTABLE_NODE_TYPES = new Set([
  FLOW_AI_NODE_TYPES.h3Optimizer,
  FLOW_AI_NODE_TYPES.textOutput,
  FLOW_AI_NODE_TYPES.characterBuilder,
  FLOW_AI_NODE_TYPES.promptAssist,
  FLOW_AI_NODE_TYPES.imageGen,
  FLOW_AI_NODE_TYPES.videoGen,
  FLOW_AI_NODE_TYPES.videoUpscale,
  FLOW_AI_NODE_TYPES.musicGen,
])

const SINGLE_VIDEO_WORKFLOW_IDS = new Set([
  'ainvfx-fluid',
  'vdn-h3-t2va',
  'fast-minimax-h3-t2va',
  'minimax-h3-360-orbit',
  'minimax-h3-handheld',
  'minimax-h3-gguf-r2v',
  'minimax-h3-character-actor',
  'minimax-h3-character-swap',
  'minimax-h3-pink-reference',
  'minimax-h3-aftermidnight-r2v',
  'minimax-h3-aftermidnight-3ref',
  'minimax-h3-gguf-i2v',
  'minimax-h3-naughty-times',
  'minimax-h3-nsfw-pink-bunny',
  'minimax-h3-nsfw-motion-8step',
  'wan22-i2v',
  'nsfw-wan-1-3b-e10-t2v',
  'ltx23-i2v',
  'ltx23-latentsync',
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
const GOOGLE_DIRECT_WORKFLOW_IDS = new Set(['google-nano-banana-lite', 'google-veo-3-1-lite'])

const WORKFLOW_MODIFIERS = Object.freeze({
  'ainvfx-fluid': modifyAinvfxFluidWorkflow,
  'anima-lora-upscale': modifyAnimaLoraUpscaleWorkflow,
  'vdn-h3-t2va': modifyVdnH3Workflow,
  'fast-minimax-h3-t2va': modifyFastMinimaxH3Workflow,
  'minimax-h3-360-orbit': modifyMinimaxH3360OrbitWorkflow,
  'minimax-h3-handheld': modifyMinimaxH3HandheldWorkflow,
  'minimax-h3-gguf-r2v': modifyMinimaxH3GGUFReferenceWorkflow,
  'minimax-h3-character-actor': modifyMinimaxH3CharacterActorWorkflow,
  'minimax-h3-character-swap': modifyMinimaxH3PinkReferenceWorkflow,
  'minimax-h3-pink-reference': modifyMinimaxH3PinkReferenceWorkflow,
  'minimax-h3-aftermidnight-r2v': modifyMinimaxH3PinkReferenceWorkflow,
  'minimax-h3-aftermidnight-3ref': modifyMinimaxH3PinkReferenceWorkflow,
  'minimax-h3-character-sheet': modifyMinimaxH3CharacterSheetWorkflow,
  'minimax-h3-gguf-i2v': modifyMinimaxH3GGUFI2VWorkflow,
  'minimax-h3-naughty-times': modifyMinimaxH3GGUFI2VWorkflow,
  'minimax-h3-nsfw-pink-bunny': modifyMinimaxH3GGUFI2VWorkflow,
  'minimax-h3-nsfw-motion-8step': modifyMinimaxH3GGUFI2VWorkflow,
  'wan22-i2v': modifyWAN22Workflow,
  'nsfw-wan-1-3b-e10-t2v': modifyNsfwWan13bWorkflow,
  'ltx23-i2v': modifyLTX23I2VWorkflow,
  'ltx23-latentsync': modifyLTX23LatentSyncWorkflow,
  'kling-o3-i2v': modifyKlingO3I2VWorkflow,
  'grok-video-i2v': modifyGrokVideoI2VWorkflow,
  'vidu-q2-i2v': modifyViduQ2I2VWorkflow,
  'multi-angles': modifyMultipleAnglesWorkflow,
  'multi-angles-scene': modifyMultipleAnglesWorkflow,
  'image-edit': modifyQwenImageEdit2509Workflow,
  'image-edit-model-product': modifyQwenImageEdit2509Workflow,
  'dark-beast-krea2-i2i': modifyDarkBeastKrea2I2IWorkflow,
  'haruki-mix-krea2-t2i': modifyHarukiMixKrea2Workflow,
  'qwen-image-2-1-heretic': modifyQwenImage21HereticWorkflow,
  'qwen-image-2-1-nsfw-lora': modifyQwenImage21HereticWorkflow,
  'qwen-image-2-1-heretic-edit': modifyQwenImage21HereticEditWorkflow,
  'qwen-image-2-1-character-sheet': modifyQwenImage21CharacterSheetWorkflow,
  'z-image-turbo': modifyZImageTurboWorkflow,
  'nano-banana-2': modifyNanoBanana2Workflow,
  'nano-banana-pro': modifyNanoBanana2Workflow,
  'grok-text-to-image': modifyGrokTextToImageWorkflow,
  'seedream-5-lite-image-edit': modifySeedream5LiteImageEditWorkflow,
  'music-gen': modifyMusicWorkflow,
  'irodori-tts': modifyIrodoriTextToSpeechWorkflow,
  'irodori-v4-1-anime': modifyIrodoriTextToSpeechWorkflow,
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

  if (node?.data?.muted === true) {
    const parts = []
    for (const edge of collectIncomingEdges(document, node.id, 'in:text')) {
      const sourceNode = nodesById.get(edge.source)
      const text = resolveFlowNodeText(document, sourceNode, nextVisited)
      if (text) parts.push(text)
    }
    return parts.join('\n\n').trim()
  }

  if (node.type === FLOW_AI_NODE_TYPES.prompt) {
    return [node?.data?.basePrompt, node?.data?.promptText]
      .map(value => String(value || '').trim())
      .filter(Boolean)
      .join('\n\n')
  }
  if (node.type === FLOW_AI_NODE_TYPES.textInput) {
    const asset = assetMapFor().get(node.data?.assetId)
    return asset?.type === 'text' ? String(asset.textContent || '') : ''
  }
  if (node.type === FLOW_AI_NODE_TYPES.promptAssist || node.type === FLOW_AI_NODE_TYPES.h3Optimizer) {
    return String(node?.data?.outputText || '').trim()
  }
  if (node.type === FLOW_AI_NODE_TYPES.textViewer || node.type === FLOW_AI_NODE_TYPES.textOutput) {
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
  if (node.type === FLOW_AI_NODE_TYPES.promptAssist || node.type === FLOW_AI_NODE_TYPES.h3Optimizer) {
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
      if (outputNode && outputNode?.data?.muted !== true) {
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
  const visited = new Set()
  const queue = [sourceNode.id]
  let targetNode = null
  while (queue.length > 0 && !targetNode) {
    const currentId = queue.shift()
    if (!currentId || visited.has(currentId)) continue
    visited.add(currentId)
    for (const edge of document?.edges || []) {
      if (edge.source !== currentId) continue
      if (sourceHandle && edge.sourceHandle !== sourceHandle) continue
      if (targetHandle && edge.targetHandle !== targetHandle) continue
      const candidate = nodesById.get(edge.target)
      if (candidate?.type === FLOW_AI_NODE_TYPES.output && candidate?.data?.muted !== true) {
        targetNode = candidate
        break
      }
      if (candidate?.data?.muted === true) queue.push(candidate.id)
    }
  }

  if (targetNode) {

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

  for (const targetId of relevant) {
    const parents = new Set()
    const visited = new Set()
    const visit = id => {
      if (visited.has(id)) return
      visited.add(id)
      for (const edge of collectIncomingEdges(document, id)) {
        if (relevant.has(edge.source)) parents.add(edge.source)
        else visit(edge.source)
      }
    }
    visit(targetId)
    for (const parentId of parents) {
      outgoing.get(parentId)?.push(targetId)
      indegree.set(targetId, (indegree.get(targetId) || 0) + 1)
    }
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
    if (sourceNode?.data?.muted === true && !getFlowNodeSupportsExecution(sourceNode.type)) continue
    if ([FLOW_AI_NODE_TYPES.imageInput, FLOW_AI_NODE_TYPES.styleReference, FLOW_AI_NODE_TYPES.characterInput].includes(sourceNode.type)) {
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
    if (sourceNode?.data?.muted === true && !getFlowNodeSupportsExecution(sourceNode.type)) continue
    if ([FLOW_AI_NODE_TYPES.imageInput, FLOW_AI_NODE_TYPES.styleReference, FLOW_AI_NODE_TYPES.characterInput].includes(sourceNode.type)) {
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

function resolvePromptTextForHandle(document, node, targetHandle) {
  const nodesById = nodeMapFor(document)
  const parts = []
  for (const edge of collectIncomingEdges(document, node.id, targetHandle)) {
    const sourceNode = nodesById.get(edge.source)
    const text = resolveFlowNodeText(document, sourceNode)
    if (text) parts.push(text)
  }
  return parts.join('\n\n')
}

function resolveWorkflowControlData(document, node) {
  const nodesById = nodeMapFor(document)
  const resolved = {}
  const pendingNodeIds = [node.id]
  const visitedNodeIds = new Set()
  while (pendingNodeIds.length > 0) {
    const targetNodeId = pendingNodeIds.shift()
    if (!targetNodeId || visitedNodeIds.has(targetNodeId)) continue
    visitedNodeIds.add(targetNodeId)

    for (const edge of collectIncomingEdges(document, targetNodeId)) {
      const sourceNode = nodesById.get(edge.source)
      if (edge.targetHandle === 'in:text' && sourceNode) {
        pendingNodeIds.push(sourceNode.id)
        continue
      }
      if (edge.targetHandle !== 'in:control'
        || sourceNode?.type !== FLOW_AI_NODE_TYPES.workflowControl
        || sourceNode?.data?.muted === true) continue
      const data = sourceNode.data || {}
      switch (data.controlKind) {
        case 'checkpoint':
          resolved.checkpointName = data.checkpointName
          break
        case 'lora-stack':
          resolved.loras = data.loras
          break
        case 'image-size':
          resolved.width = data.width
          resolved.height = data.height
          break
        case 'upscale':
          resolved.upscaleEnabled = data.upscaleEnabled
          resolved.upscaleModel = data.upscaleModel
          break
        case 'transparent-png':
          resolved.transparentPng = data.transparentPng === true
          break
        default:
          break
      }
    }
  }
  return resolved
}

function collectOutputAssetIds(document, nodeId) {
  const nodesById = nodeMapFor(document)
  if (nodesById.get(nodeId)?.data?.muted === true) return []
  const results = []
  for (const edge of collectIncomingEdges(document, nodeId)) {
    const sourceNode = nodesById.get(edge.source)
    if (!sourceNode) continue
    if (sourceNode?.data?.muted === true && !getFlowNodeSupportsExecution(sourceNode.type)) continue
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
    let waitingForSeek = false

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
      const safeTime = Math.max(0, Math.min(Number(frameTime) || 0, Math.max(0, (video.duration || 0) - 0.001)))
      if (Number.isFinite(safeTime) && safeTime > 0.001) {
        waitingForSeek = true
        video.currentTime = safeTime
      } else {
        if (video.readyState >= 2) {
          captureCurrentFrame()
        } else {
          video.currentTime = 0
        }
      }
    }

    // loadeddata may fire for the decoder's initial frame after currentTime was
    // already moved. For non-zero targets, wait for seeked so the extracted
    // endpoint cannot accidentally be the first frame again.
    video.onloadeddata = () => {
      if (!waitingForSeek) captureCurrentFrame()
    }
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
      : asset.type === 'audio' ? (sourceExtension || '.wav') : '.bin'
  const baseName = sourceExtension ? sourceName.slice(0, -sourceExtension.length) : sourceName
  return new File([blob], `${sanitizeNameToken(baseName || 'asset', 'asset')}${extension}`, { type: blob.type || 'application/octet-stream' })
}

function decodeBase64File(data, filename, mimeType) {
  const binary = atob(String(data || ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new File([bytes], filename, { type: mimeType })
}

function googleAspectRatio(width, height) {
  const ratio = Math.max(1, Number(width) || 1) / Math.max(1, Number(height) || 1)
  const options = [
    ['1:1', 1], ['3:4', 3 / 4], ['4:3', 4 / 3], ['9:16', 9 / 16], ['16:9', 16 / 9],
  ]
  return options.sort((a, b) => Math.abs(a[1] - ratio) - Math.abs(b[1] - ratio))[0][0]
}

async function waitForGoogleVideo(operationName, node, options = {}) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < 30 * 60 * 1000) {
    throwIfFlowInterrupted(options.signal)
    const operation = await getGoogleVideoOperation(operationName)
    if (operation?.done) {
      if (operation?.error) throw new Error(operation.error.message || 'Google Veo video generation failed.')
      const response = operation?.response?.generateVideoResponse || operation?.response || {}
      const sample = response?.generatedSamples?.[0] || response?.generatedVideos?.[0] || {}
      const uri = sample?.video?.uri || sample?.video?.url || sample?.uri || ''
      if (!uri) throw new Error('Google Veo completed without a downloadable video.')
      return uri
    }
    const elapsedRatio = Math.min(1, (Date.now() - startedAt) / (5 * 60 * 1000))
    options.onNodePatch?.(node.id, {
      status: 'running',
      statusMessage: 'Generating with Google Veo 3.1 Lite…',
      progress: Math.min(90, 15 + (elapsedRatio * 75)),
    })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 10000)
      options.signal?.addEventListener('abort', () => {
        clearTimeout(timer)
        reject(createFlowInterruptedError())
      }, { once: true })
    })
  }
  throw new Error('Google Veo video generation timed out after 30 minutes.')
}

async function runGoogleDirectNode(document, node, options = {}) {
  const workflowId = String(node?.data?.workflowId || '').trim()
  const promptText = resolvePromptText(document, node)
  if (!promptText) throw new Error('Enter or connect a prompt before running Google generation.')
  const sourceAsset = resolveConnectedAsset(document, node, 'in:image', 'image')
  let image = null
  if (sourceAsset) {
    const file = await assetToUploadFile(sourceAsset)
    image = { bytes: new Uint8Array(await file.arrayBuffer()), mimeType: file.type || 'image/png' }
  }
  const width = Number(node?.data?.width) || (workflowId === 'google-veo-3-1-lite' ? 1280 : 1024)
  const height = Number(node?.data?.height) || (workflowId === 'google-veo-3-1-lite' ? 720 : 1024)
  const aspectRatio = googleAspectRatio(width, height)
  const outputKind = workflowId === 'google-veo-3-1-lite' ? 'video' : 'image'
  const outputTarget = resolveAssetOutputTarget(document, node, { type: outputKind })
  const projectHandle = useProjectStore.getState().currentProjectHandle
  const baseName = buildAssetBaseName(node, workflowId, promptText)
  const duration = [4, 6, 8].reduce((best, value) => Math.abs(value - (Number(node?.data?.duration) || 4)) < Math.abs(best - (Number(node?.data?.duration) || 4)) ? value : best, 4)
  const estimatedCostUsd = outputKind === 'image' ? 0.0336 : duration * 0.05

  options.onNodePatch?.(node.id, {
    status: 'queuing',
    statusMessage: `Google Gemini APIへ送信中（概算 $${estimatedCostUsd.toFixed(outputKind === 'image' ? 4 : 2)}）…`,
    progress: 5,
    error: '',
    estimatedCostUsd,
  })

  let file
  let promptId = null
  if (outputKind === 'image') {
    const media = await generateGoogleImage({ prompt: promptText, image, aspectRatio, imageSize: '1K' })
    const mimeType = media.mimeType || 'image/jpeg'
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg'
    file = decodeBase64File(media.data, `${baseName}.${extension}`, mimeType)
  } else {
    const operation = await createGoogleVideo({ prompt: promptText, image, aspectRatio, durationSeconds: duration, resolution: '720p' })
    promptId = String(operation?.name || '')
    if (!promptId) throw new Error('Google Veo did not return an operation ID.')
    options.onNodePatch?.(node.id, { status: 'running', statusMessage: 'Generating with Google Veo 3.1 Lite…', progress: 15, lastPromptId: promptId })
    const uri = await waitForGoogleVideo(promptId, node, options)
    const media = await downloadGoogleMedia(uri)
    file = decodeBase64File(media.data, `${baseName}.mp4`, media.mimeType || 'video/mp4')
  }

  throwIfFlowInterrupted(options.signal)
  const assetInfo = await importAsset(projectHandle, file, outputKind === 'image' ? 'images' : 'video', {
    subfolderSegments: outputTarget?.folderSegments || [],
  })
  const asset = useAssetsStore.getState().addAsset({
    ...assetInfo,
    name: baseName,
    type: outputKind,
    url: assetInfo?.url || URL.createObjectURL(file),
    prompt: promptText,
    isImported: true,
    folderId: outputTarget?.folderId || ensureAssetFolderPath(outputKind === 'image' ? GENERATED_ASSET_FOLDERS.image : GENERATED_ASSET_FOLDERS.video),
    settings: outputKind === 'video' ? { ...(assetInfo?.settings || {}), duration, fps: 24 } : assetInfo?.settings,
    flowAi: {
      documentId: options.documentId,
      nodeId: node.id,
      workflowId,
      promptId,
      runtime: 'google-gemini-api',
      estimatedCostUsd,
      importedAt: new Date().toISOString(),
      assetOutputNodeId: outputTarget?.outputNode?.id || null,
      assetOutputFolder: outputTarget?.folderSegments || null,
    },
  })
  if (!asset) throw new Error('Google output was generated but could not be added to Assets.')
  if (outputKind === 'video' && isElectron() && projectHandle && asset?.absolutePath) {
    enqueuePlaybackTranscode(projectHandle, asset.id, asset.absolutePath).catch(() => {})
    if (isProxyPlaybackEnabled()) enqueueProxyTranscode(projectHandle, asset.id, asset.absolutePath).catch(() => {})
  }
  return { promptId, workflowId, importedAssets: [asset], textOutput: '' }
}

function buildUniqueComfyInputFilename(prefix, asset, file) {
  const sourceName = String(file?.name || asset?.name || 'input.bin').trim()
  const extension = sourceName.match(/\.[a-z0-9]{2,8}$/i)?.[0] || ''
  const baseName = extension ? sourceName.slice(0, -extension.length) : sourceName
  const assetToken = sanitizeNameToken(asset?.id || 'asset', 'asset').slice(0, 32)
  const nonce = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return `${sanitizeNameToken(prefix, 'canvas_input')}_${assetToken}_${nonce}_${sanitizeNameToken(baseName, 'input')}${extension}`
}

function resolveMutedNodePassthrough(document, node) {
  if (!node || node?.data?.muted !== true) return { outputAssetIds: [], outputText: '' }

  if ([FLOW_AI_NODE_TYPES.promptAssist, FLOW_AI_NODE_TYPES.h3Optimizer, FLOW_AI_NODE_TYPES.textOutput].includes(node.type)) {
    return {
      outputAssetIds: [],
      outputText: resolvePromptTextForHandle(document, node, 'in:text'),
    }
  }

  const candidates = node.type === FLOW_AI_NODE_TYPES.imageGen
    ? [['in:image', 'image']]
    : node.type === FLOW_AI_NODE_TYPES.videoGen || node.type === FLOW_AI_NODE_TYPES.videoUpscale
      ? [['in:video', 'video']]
      : node.type === FLOW_AI_NODE_TYPES.musicGen
        ? [['in:audio', 'audio'], ['in:voice', 'audio']]
        : []

  for (const [handle, kind] of candidates) {
    const assets = resolveConnectedAssets(document, node, handle, kind)
    if (assets.length > 0) {
      return {
        outputAssetIds: Array.from(new Set(assets.map(asset => asset.id).filter(Boolean))),
        outputText: '',
      }
    }
  }
  return { outputAssetIds: [], outputText: '' }
}

function resolveVideoFrameTime(node, asset) {
  const mode = String(node?.data?.frameTimeMode || '').trim()
  if (mode === 'first') return 0
  if (mode === 'last') {
    const duration = Number(asset?.duration || asset?.settings?.duration)
    const fps = Math.max(1, Number(asset?.fps || asset?.settings?.fps) || 24)
    return duration > 0 ? Math.max(0, duration - (1 / fps)) : Number.MAX_SAFE_INTEGER
  }
  return Math.max(0, Number(node?.data?.frameTime) || 0)
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
  if (workflowId === 'irodori-tts' || workflowId === 'irodori-v4-1-anime') return `audio/${token}`
  if (SINGLE_VIDEO_WORKFLOW_IDS.has(workflowId)) return `video/${token}`
  return `image/${token}`
}

function createFlowInterruptedError() {
  const error = new Error('CANVAS interrupted.')
  error.name = 'AbortError'
  return error
}

async function resolveMinimaxH3NodeConfiguration() {
  const visionResponse = await comfyui.getObjectInfo('H3_Vision')
  const visionInfo = visionResponse?.H3_Vision || visionResponse

  const promptorResponse = await comfyui.getObjectInfo('H3_Promptor')
  const promptorInfo = promptorResponse?.H3_Promptor || promptorResponse

  const providerFor = (info) => {
    const providerSpec = info?.input?.optional?.provider || info?.input?.required?.provider
    const choices = Array.isArray(providerSpec?.[0]) ? providerSpec[0] : []
    const defaultChoice = String(providerSpec?.[1]?.default || '').trim()
    if (defaultChoice && !/no provider configured|error loading providers/i.test(defaultChoice)) return defaultChoice
    return String(choices.find((choice) => {
      const value = String(choice || '').trim()
      return value && !/no provider configured|error loading providers/i.test(value)
    }) || '').trim()
  }

  const visionProvider = providerFor(visionInfo)
  const promptorProvider = providerFor(promptorInfo)
  if (!visionProvider || !promptorProvider) {
    throw new Error('MiniMax H3 Promptor has no LLM provider configured. Open ComfyUI Settings, configure vision and prompt providers for H3 Promptor, then run this node again.')
  }

  return {
    visionProvider,
    promptorProvider,
  }
}

function throwIfFlowInterrupted(signal) {
  if (signal?.aborted) throw createFlowInterruptedError()
}

function waitForFlowPoll(milliseconds, signal) {
  throwIfFlowInterrupted(signal)
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener?.('abort', handleAbort)
      resolve()
    }, milliseconds)
    const handleAbort = () => {
      clearTimeout(timeout)
      reject(createFlowInterruptedError())
    }
    signal?.addEventListener?.('abort', handleAbort, { once: true })
  })
}

async function pollForResult(promptId, workflowId, expectedOutputPrefix = '', onStatus = () => {}, signal = null) {
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
      throwIfFlowInterrupted(signal)
      const now = Date.now()
      const elapsed = now - startedAt
      const idleFor = now - lastActivityAt

      if (elapsed > MAX_TOTAL_MS) break
      if (wsReportedSuccess && postSuccessTries >= MAX_POST_SUCCESS_TRIES) break

      await waitForFlowPoll(POLL_INTERVAL_MS, signal)
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
    ...(workflowId === 'ainvfx-fluid' ? {
      frames: 121, fps: Number(node.data.fps) || 25, steps: 8, cfg: 1, sampler: 'euler_ancestral',
      fluidStrength: node.data.fluidStrength ?? 1,
      firstFrameAssetId: resolveConnectedAsset(document, node, 'in:image', 'image')?.id || null,
      lastFrameAssetId: resolveConnectedAsset(document, node, 'in:last-image', 'image')?.id || null,
      sourceUrl: 'https://huggingface.co/AInVFX/ainvfx-fluid',
    } : {}),
    ...(workflowId === 'vdn-h3-t2va' ? {
      vdnCheckpoint: 'stage-dmd-step-250', steps: 8, sampler: 'er_sde', scheduler: 'beta',
      vdnBranchWeights: 'stream', vdnLoraMode: 'merge', vdnAttentionBackend: 'grouped',
    } : {}),
    ...(workflowId === 'fast-minimax-h3-t2va' ? {
      referenceImageAssetIds: resolveConnectedAssets(document, node, 'in:style', 'image').map(asset => asset.id),
      referenceAudioAssetIds: resolveConnectedAssets(document, node, 'in:voice', 'audio').map(asset => asset.id),
      fastH3Steps: [4, 6, 8].includes(Number(node?.data?.fastH3Steps)) ? Number(node.data.fastH3Steps) : 4,
      useSageAttention: true,
    } : {}),
    ...(['minimax-h3-gguf-r2v', 'minimax-h3-character-swap', 'minimax-h3-pink-reference', 'minimax-h3-aftermidnight-r2v', 'minimax-h3-aftermidnight-3ref'].includes(workflowId) ? {
      referenceVideoAssetId: resolveConnectedAsset(document, node, 'in:video', 'video')?.id || null,
      referenceImageAssetIds: resolveConnectedAssets(document, node, 'in:style', 'image').map(asset => asset.id),
      referenceStart: Number(node?.data?.referenceStart) || 0,
      referenceDuration: Number(node?.data?.referenceDuration) || 5,
      useReferenceAudio: workflowId === 'minimax-h3-character-swap' ? false : Boolean(node?.data?.useReferenceAudio),
      useSageAttention: workflowId === 'minimax-h3-character-swap' ? false : node?.data?.useSageAttention !== false,
    } : {}),
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
    case 'qwen-image-2-1-heretic':
    case 'qwen-image-2-1-nsfw-lora':
      return modifier(workflowJson, {
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        transparentPng: context.transparentPng,
        width: context.width,
        height: context.height,
        seed: context.seed,
        steps: context.steps,
        cfg: context.cfg,
        samplerName: context.samplerName,
        scheduler: context.scheduler,
        variantCount: context.variantCount,
        filenamePrefix: context.outputPrefix,
      })
    case 'qwen-image-2-1-heretic-edit':
      return modifier(workflowJson, {
        inputImage: context.uploadedFilename,
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        transparentPng: context.transparentPng,
        resolution: context.resolution,
        seed: context.seed,
        steps: context.steps,
        cfg: context.cfg,
        samplerName: context.samplerName,
        scheduler: context.scheduler,
        filenamePrefix: context.outputPrefix,
      })
    case 'qwen-image-2-1-character-sheet':
      return modifier(workflowJson, {
        inputImage: context.uploadedFilename,
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        resolution: context.resolution,
        width: context.width,
        height: context.height,
        seed: context.seed,
        steps: context.steps,
        cfg: context.cfg,
        samplerName: context.samplerName,
        scheduler: context.scheduler,
        filenamePrefix: context.outputPrefix || 'image/CANVAS_qwen_character_sheet',
      })
    case 'vdn-h3-t2va':
      return modifier(workflowJson, {
        prompt: context.promptText, width: context.width, height: context.height,
        duration: context.duration, seed: context.seed, filenamePrefix: context.outputPrefix,
      })
    case 'fast-minimax-h3-t2va':
      return modifier(workflowJson, {
        prompt: context.promptText, referenceImages: context.referenceFilenames,
        referenceAudio: context.referenceAudioFilenames, width: context.width, height: context.height,
        duration: context.duration, steps: context.fastH3Steps, seed: context.seed,
        filenamePrefix: context.outputPrefix,
      })
    case 'ainvfx-fluid':
      return modifier(workflowJson, {
        firstFrame: context.uploadedFilename, lastFrame: context.lastFrameFilename,
        prompt: context.promptText, negativePrompt: context.negativePrompt, width: context.width, height: context.height, fps: context.fps,
        seed: context.seed, strength: context.fluidStrength, filenamePrefix: context.outputPrefix,
      })
    case 'minimax-h3-gguf-r2v':
    case 'minimax-h3-character-swap':
    case 'minimax-h3-pink-reference':
    case 'minimax-h3-aftermidnight-r2v':
    case 'minimax-h3-aftermidnight-3ref':
      return modifier(workflowJson, {
        prompt: context.promptText,
        referenceVideo: context.referenceVideoFilename,
        referenceImages: context.referenceFilenames,
        referenceStart: context.referenceStart,
        referenceDuration: context.referenceDuration,
        useReferenceAudio: context.useReferenceAudio,
        useSageAttention: context.useSageAttention,
        allowImageOnly: workflowId === 'minimax-h3-aftermidnight-3ref',
        minimumReferenceImages: workflowId === 'minimax-h3-character-swap' ? 1 : 0,
        maximumReferenceImages: workflowId === 'minimax-h3-character-swap' ? 1 : 8,
        minimumDuration: workflowId === 'minimax-h3-character-swap' ? 4 : 5,
        maximumDuration: workflowId === 'minimax-h3-character-swap' ? 5 : 15,
        width: context.width,
        height: context.height,
        duration: context.duration,
        seed: context.seed,
        filenamePrefix: context.outputPrefix,
      })
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
    case 'minimax-h3-naughty-times':
    case 'minimax-h3-nsfw-pink-bunny':
    case 'minimax-h3-nsfw-motion-8step':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        lastImage: context.lastFrameFilename,
        width: context.width,
        height: context.height,
        duration: context.duration,
        seed: context.seed,
        loraName: workflowId === 'minimax-h3-naughty-times' ? 'SexGod_NaughtyTimes_v3_rank64_pruned_NOADALN.safetensors' : workflowId === 'minimax-h3-nsfw-pink-bunny'
          ? 'PinkFluffyBunny-unpruned-v2-rank128.safetensors'
          : workflowId === 'minimax-h3-nsfw-motion-8step'
            ? 'minimax-h3_fl2v_8Step_motion_enhancer.safetensors'
            : '',
        steps: ['minimax-h3-naughty-times', 'minimax-h3-nsfw-pink-bunny'].includes(workflowId) ? 20 : 8,
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
    case 'ltx23-latentsync':
      return modifier(workflowJson, {
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        inputImage: context.uploadedFilename,
        inputAudio: context.referenceAudioFilenames[0],
        width: context.width,
        height: context.height,
        frames: Math.round((context.duration || 5) * (context.fps || 24)) + 1,
        fps: context.fps,
        seed: context.seed,
        lipsExpression: context.lipsExpression,
        inferenceSteps: context.lipSyncSteps,
        filenamePrefix: context.outputPrefix || 'video/CANVAS_exact_audio_lipsync',
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
    case 'anima-lora-upscale':
      return modifier(workflowJson, {
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        width: context.width,
        height: context.height,
        seed: context.seed,
        steps: context.steps,
        cfg: context.cfg,
        eta: context.eta,
        denoise: context.denoise,
        samplerName: context.samplerName,
        scheduler: context.scheduler,
        samplerMode: context.samplerMode,
        bongmath: context.bongmath,
        checkpointName: context.checkpointName,
        loras: context.loras,
        upscaleEnabled: context.upscaleEnabled,
        upscaleModel: context.upscaleModel,
        filenamePrefix: context.outputPrefix || 'image/CANVAS_anima_lora',
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
    case 'irodori-tts':
      return modifier(workflowJson, {
        text: context.promptText,
        seed: context.seed,
        seconds: 0,
        filenamePrefix: context.outputPrefix || 'audio/CANVAS_irodori',
      })
    case 'irodori-v4-1-anime':
      return modifier(workflowJson, {
        text: context.promptText,
        model: IRODORI_ANIME_MODEL_FILENAME,
        seed: context.seed,
        seconds: 0,
        filenamePrefix: context.outputPrefix || 'audio/CANVAS_irodori_anime',
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
    case 'minimax-h3-360-orbit':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/CANVAS_minimax_h3_360_orbit',
      })
    case 'minimax-h3-handheld':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        duration: context.duration,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/CANVAS_minimax_h3_handheld',
      })
    case 'minimax-h3-character-actor':
      return modifier(workflowJson, {
        prompt: context.promptText,
        referenceImages: context.referenceFilenames,
        useSageAttention: context.useSageAttention,
        width: context.width,
        height: context.height,
        duration: context.duration,
        seed: context.seed,
        filenamePrefix: context.outputPrefix || 'video/CANVAS_h3_character_actor',
      })
    case 'nsfw-wan-1-3b-e10-t2v':
      return modifier(workflowJson, {
        prompt: context.promptText,
        negativePrompt: context.negativePrompt,
        width: context.width,
        height: context.height,
        frames: Math.round((context.duration || 5) * (context.fps || 16)) + 1,
        fps: context.fps,
        seed: context.seed,
        steps: context.steps,
        cfg: context.cfg,
        samplerName: context.samplerName,
        scheduler: context.scheduler,
        filenamePrefix: context.outputPrefix || 'video/CANVAS_nsfw_wan_1_3b_e10',
      })
    case 'dark-beast-krea2-i2i':
      return modifier(workflowJson, {
        prompt: context.promptText,
        inputImage: context.uploadedFilename,
        width: context.width,
        height: context.height,
        seed: context.seed,
        steps: context.steps,
        cfg: context.cfg,
        denoise: context.denoise,
        samplerName: context.samplerName,
        scheduler: context.scheduler,
        filenamePrefix: context.outputPrefix || 'image/CANVAS_dark_beast_krea2',
      })
    case 'haruki-mix-krea2-t2i':
      return modifier(workflowJson, {
        prompt: context.promptText,
        width: context.width,
        height: context.height,
        seed: context.seed,
        steps: context.steps,
        cfg: context.cfg,
        samplerName: context.samplerName,
        scheduler: context.scheduler,
        variantCount: context.variantCount,
        filenamePrefix: context.outputPrefix || 'image/CANVAS_haruki_mix_krea2',
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

  let promptText = resolvePromptText(document, node)
  const workflowControls = resolveWorkflowControlData(document, node)
  const connectedNegativePrompt = resolvePromptTextForHandle(document, node, 'in:negative-text')
  const effectiveData = { ...(node?.data || {}), ...workflowControls }
  const primaryAsset = resolveConnectedAsset(document, node, 'in:image', 'image')
  const maskAsset = resolveConnectedAsset(document, node, 'in:mask', '')
  const lastFrameAsset = resolveConnectedAsset(document, node, 'in:last-image', 'image')
  const videoAsset = resolveConnectedAsset(document, node, 'in:video', 'video')
  const characterAsset = resolveConnectedAsset(document, node, 'in:character', 'character')
  let styleAssets = resolveConnectedAssets(document, node, 'in:style', 'image')
  let numberedCharacterReferences = []
  const isNumberedCharacterEdit = workflowId === 'image-edit' && node?.data?.referencePacking === 'numbered-six'
  const isFastH3 = workflowId === 'fast-minimax-h3-t2va'
  const isExactAudioLipSync = workflowId === 'ltx23-latentsync'
  const audioAssets = (isFastH3 || isExactAudioLipSync) ? resolveConnectedAssets(document, node, 'in:voice', 'audio') : []
  if (isFastH3) {
    assertNoBundledExecutableInput(document, node, 'in:voice', 'audio')
    if (styleAssets.length > 2 || audioAssets.length > 2) throw new Error('Fast H3: 参照画像・音声はそれぞれ2つまでです。 / Up to two images and two audio references.')
  }
  if (isExactAudioLipSync) {
    assertNoBundledExecutableInput(document, node, 'in:voice', 'audio')
    if (audioAssets.length !== 1) throw new Error('完成した音声を1つ接続してください。 / Connect one completed audio clip for Exact Audio lip-sync.')
  }
  const isMinimaxH3Reference = ['minimax-h3-gguf-r2v', 'minimax-h3-character-swap', 'minimax-h3-pink-reference', 'minimax-h3-aftermidnight-r2v', 'minimax-h3-aftermidnight-3ref'].includes(workflowId)
  const isMinimaxH3CharacterActor = workflowId === 'minimax-h3-character-actor'
  const isMinimaxH3CharacterSwap = workflowId === 'minimax-h3-character-swap'
  const isMinimaxH3ImageOnlyReference = workflowId === 'minimax-h3-aftermidnight-3ref'
  const isMinimaxH3Promptor = workflowId === 'minimax-h3-media-promptor'
  const mediaAsset = isMinimaxH3Promptor ? (videoAsset || primaryAsset) : primaryAsset
  let characterReferenceFiles = []
  if (isMinimaxH3CharacterActor) {
    if (!characterAsset) throw new Error('.char キャラクターを接続してください。 / Connect a Character File.')
    const characterUrl = characterAsset.url || await getProjectFileUrl(useProjectStore.getState().currentProjectHandle, characterAsset.path)
    const response = await fetch(characterUrl)
    if (!response.ok) throw new Error(`.char を開けませんでした (${response.status})。`)
    const character = await readCharacterFile(await response.arrayBuffer())
    const selectedReferences = selectCharacterReferences(character.references, 9)
    characterReferenceFiles = selectedReferences.map((ref, index) => new File(
      [ref.bytes],
      `canvas_character_${String(index + 1).padStart(2, '0')}.png`,
      { type: 'image/png' }
    ))
    promptText = buildCharacterPrompt({
      name: character.name,
      description: character.description,
      prompt: promptText,
      references: selectedReferences,
    })
  }

  if (isNumberedCharacterEdit) {
    const nodesById = nodeMapFor(document)
    const assetsById = assetMapFor()
    numberedCharacterReferences = collectIncomingEdges(document, node.id, 'in:style')
      .map(edge => {
        const sourceNode = nodesById.get(edge.source)
        const match = String(sourceNode?.data?.assetRole || '').match(/^character-reference-([2-6])$/)
        const asset = sourceNode?.data?.muted === true
          ? null
          : assetsById.get(String(sourceNode?.data?.assetId || '').trim())
        return match && asset?.type === 'image'
          ? { asset, referenceNumber: Number(match[1]) }
          : null
      })
      .filter(Boolean)
      .sort((left, right) => left.referenceNumber - right.referenceNumber)
    styleAssets = numberedCharacterReferences.map(entry => entry.asset)
    if (styleAssets.length > 5) {
      throw new Error('I2Iキャラクタ編集の追加参照画像は5枚までです。 / I2I Character Edit accepts five additional references.')
    }
  }

  if (isMinimaxH3ImageOnlyReference) {
    const nodesById = nodeMapFor(document)
    const assetsById = assetMapFor()
    const roleAssets = new Map()
    for (const edge of collectIncomingEdges(document, node.id, 'in:style')) {
      const sourceNode = nodesById.get(edge.source)
      if (!sourceNode || sourceNode?.data?.muted === true) continue
      const role = String(sourceNode?.data?.assetRole || '').trim()
      const asset = assetsById.get(String(sourceNode?.data?.assetId || '').trim())
      if (role && asset?.type === 'image') roleAssets.set(role, asset)
    }
    const sceneAsset = roleAssets.get('scene-reference')
    const characterAsset = roleAssets.get('character-sheet-reference')
    if (!sceneAsset || !characterAsset) {
      throw new Error('シーン画像とキャラクターシートの2枚を接続してください。 / Connect both the scene image and character sheet.')
    }
    styleAssets = [sceneAsset, characterAsset, roleAssets.get('props-stage-reference')].filter(Boolean)
  }

  if (isMinimaxH3Reference && !isMinimaxH3ImageOnlyReference && !videoAsset) {
    throw new Error('参照動画を接続してください。 / Connect a reference video before running MiniMax H3.')
  }
  if (isMinimaxH3CharacterSwap && styleAssets.length !== 1) {
    throw new Error('差し替えるキャラクター画像を1枚接続してください。 / Connect exactly one replacement-character image.')
  }
  if (isMinimaxH3ImageOnlyReference && styleAssets.length > 3) {
    throw new Error('このフローの参照画像は3枚までです。 / This flow accepts at most three reference images.')
  }
  if (isMinimaxH3Reference && styleAssets.length > 8) {
    throw new Error('参照画像は8枚まで接続できます。 / MiniMax H3 accepts up to eight reference images in this flow.')
  }
  const referenceStart = Math.max(0, Number(node?.data?.referenceStart) || 0)
  const referenceDuration = isMinimaxH3CharacterSwap
    ? Math.max(4, Math.min(5, Math.round(Number(node?.data?.referenceDuration) || 5)))
    : Math.max(2, Math.min(15, Number(node?.data?.referenceDuration) || 5))
  const sourceDuration = Number(videoAsset?.duration || videoAsset?.settings?.duration)
  const minimumRemainingDuration = isMinimaxH3CharacterSwap ? 4 : 2
  if (isMinimaxH3Reference && sourceDuration > 0 && sourceDuration - referenceStart < minimumRemainingDuration) {
    throw new Error(isMinimaxH3CharacterSwap
      ? '参照開始位置から4秒以上残る動画を選んでください。 / The source video must have at least four seconds after the selected start.'
      : '参照開始位置から2秒以上残る動画を選んでください。 / The reference video must have at least two seconds after the selected start.')
  }

  if (workflowId === 'ainvfx-fluid') {
    validateAinvfxFluidSettings(effectiveData)
    if (!primaryAsset || !lastFrameAsset) throw new Error('VFX: 最初と最後の描画画像を接続してください。 / Connect both painted keyframes.')
  }

  const needsImage = Boolean(workflowOption.needsImage)
  if (needsImage && !primaryAsset) {
    throw new Error('This workflow needs an upstream image input or image generation result.')
  }
  if (node?.data?.optionalStage === 'inpaint' && !maskAsset) {
    throw new Error('Turn Inpaint off, or connect an Inpaint Mask before running this optional edit.')
  }
  if (!isMinimaxH3Reference && !isFastH3 && workflowId !== 'vdn-h3-t2va' && node?.data?.requiresLastFrame && !lastFrameAsset) {
    throw new Error('This flow needs both a Start Frame and a Last Frame image.')
  }
  if (isMinimaxH3Promptor && !mediaAsset) {
    throw new Error('MiniMax H3 Media Promptor needs an upstream image or video asset.')
  }

  const width = Number(effectiveData.width) || 1280
  const height = Number(effectiveData.height) || 720
  const seed = Number(node?.data?.seed)
  const connectedAudioDuration = Number(audioAssets[0]?.duration || audioAssets[0]?.settings?.duration)
  const duration = isMinimaxH3CharacterSwap
    ? Math.max(4, Math.min(5, Math.round(Number(node?.data?.duration) || 5)))
    : isExactAudioLipSync && connectedAudioDuration > 0
      ? Math.max(2, Math.min(30, connectedAudioDuration))
      : (Number(node?.data?.duration) || 5)
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
    let fileToUpload = await assetToUploadFile(mediaAsset, resolveVideoFrameTime(node, mediaAsset), {
      preserveVideo: isMinimaxH3Promptor && mediaAsset.type === 'video',
    })
    if (['multi-angles', 'multi-angles-scene'].includes(workflowId)) {
      fileToUpload = await fitImageFileToSquare(fileToUpload, 1024)
    }
    const uploadResult = await comfyui.uploadFile(fileToUpload)
    uploadedFilename = uploadResult?.name || fileToUpload.name
  }

  let referenceVideoFilename = null
  if (isMinimaxH3Reference && videoAsset) {
    const videoFile = await assetToUploadFile(videoAsset, 0, { preserveVideo: true })
    // ComfyUI video loaders may retain decoded data when the same input path is
    // overwritten. A unique name makes every CANVAS run select the fresh clip,
    // including replacements that share the same original filename.
    const uploadName = buildUniqueComfyInputFilename('canvas_ref_video', videoAsset, videoFile)
    const upload = await comfyui.uploadFile(videoFile, uploadName)
    referenceVideoFilename = upload?.name || uploadName
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

  const h3Configuration = isMinimaxH3Promptor
    ? await resolveMinimaxH3NodeConfiguration()
    : {
        visionProvider: '',
        promptorProvider: '',
      }

  const referenceAudioFilenames = []
  for (const asset of audioAssets) {
    const file = await assetToUploadFile(asset)
    const upload = await comfyui.uploadFile(file)
    referenceAudioFilenames.push(upload?.name || file.name)
  }
  const referenceFilenames = []
  if (isMinimaxH3CharacterActor) {
    for (const file of characterReferenceFiles) {
      const uploadName = `canvas_character_${Date.now()}_${file.name}`
      const uploadResult = await comfyui.uploadFile(file, uploadName)
      referenceFilenames.push(uploadResult?.name || uploadName)
    }
  } else if (isNumberedCharacterEdit && numberedCharacterReferences.length > 0) {
    const numberedFiles = []
    for (const entry of numberedCharacterReferences) {
      numberedFiles.push({
        referenceNumber: entry.referenceNumber,
        file: await assetToUploadFile(entry.asset, 0),
      })
    }
    for (const group of planNumberedReferenceSheets(numberedFiles)) {
      const sheet = await createNumberedReferenceSheet(group)
      const uploadResult = await comfyui.uploadFile(sheet)
      referenceFilenames.push(uploadResult?.name || sheet.name)
    }
  } else if (styleAssets.length > 0) {
    for (const asset of styleAssets.slice(0, isMinimaxH3Reference ? 8 : 2)) {
      const fileToUpload = await assetToUploadFile(asset, 0)
      const uploadName = isMinimaxH3Reference
        ? buildUniqueComfyInputFilename('canvas_ref_image', asset, fileToUpload)
        : null
      const uploadResult = await comfyui.uploadFile(fileToUpload, uploadName)
      referenceFilenames.push(uploadResult?.name || uploadName || fileToUpload.name)
    }
  }

  return {
    workflowId,
    workflowOption,
    promptText,
    negativePrompt: connectedNegativePrompt || String(effectiveData.negativePrompt || '').trim(),
    systemPrompt: String(node?.data?.systemPrompt || '').trim(),
    tags: String(node?.data?.tags || '').trim(),
    lyrics: promptText || String(node?.data?.lyrics || '').trim(),
    width,
    height,
    resolution: Number.isFinite(Number(effectiveData.resolution))
      ? Math.max(0, Math.min(2048, Math.round(Number(effectiveData.resolution))))
      : 1024,
    duration,
    fps,
    bpm: Number(node?.data?.bpm) || 120,
    keyscale: String(node?.data?.keyscale || 'C Major').trim(),
    seed: Number.isFinite(seed) ? seed : Math.floor(Math.random() * 1000000),
    steps: Math.max(1, Math.min(100, Math.round(Number(node?.data?.steps) || 15))),
    cfg: Math.max(0, Math.min(100, Number.isFinite(Number(node?.data?.cfg)) ? Number(node.data.cfg) : 5)),
    eta: Math.max(-100, Math.min(100, Number.isFinite(Number(node?.data?.eta)) ? Number(node.data.eta) : 0.5)),
    denoise: Math.max(0, Math.min(1, Number.isFinite(Number(node?.data?.denoise)) ? Number(node.data.denoise) : 1)),
    samplerName: String(node?.data?.samplerName || 'exponential/res_2s'),
    scheduler: String(node?.data?.scheduler || 'karras'),
    samplerMode: String(node?.data?.samplerMode || 'standard'),
    bongmath: node?.data?.bongmath !== false,
    checkpointName: String(effectiveData.checkpointName || '').trim(),
    loras: Array.isArray(effectiveData.loras) ? effectiveData.loras : [],
    upscaleEnabled: Boolean(effectiveData.upscaleEnabled),
    upscaleModel: String(effectiveData.upscaleModel || '').trim(),
    transparentPng: effectiveData.transparentPng === true,
    wanQualityPreset: String(node?.data?.wanQualityPreset || 'balanced').trim(),
    variantCount,
    imageVariantBehavior,
    preserveInputResolution: Boolean(node?.data?.preserveInputResolution),
    uploadedFilename,
    referenceVideoFilename,
    referenceStart,
    referenceDuration,
    useReferenceAudio: isMinimaxH3CharacterSwap ? false : Boolean(node?.data?.useReferenceAudio),
    useSageAttention: isMinimaxH3CharacterSwap ? false : node?.data?.useSageAttention !== false,
    lastFrameFilename,
    fluidStrength: node?.data?.fluidStrength ?? 1,
    uploadedMediaKind: mediaAsset?.type === 'video' ? 'video' : 'image',
    visionProvider: h3Configuration.visionProvider,
    promptorProvider: h3Configuration.promptorProvider,
    outputLanguage: String(node?.data?.outputLanguage || 'English'),
    imageAnalysisMode: String(node?.data?.imageAnalysisMode || 'Comprehensive'),
    videoAnalysisMode: String(node?.data?.videoAnalysisMode || 'Comprehensive'),
    referenceFilenames,
    referenceAudioFilenames,
    fastH3Steps: [4, 6, 8].includes(Number(node?.data?.fastH3Steps)) ? Number(node.data.fastH3Steps) : 4,
    lipsExpression: Math.max(1, Math.min(3, Number(node?.data?.lipsExpression) || 1.5)),
    lipSyncSteps: Math.max(1, Math.min(50, Math.round(Number(node?.data?.lipSyncSteps) || 20))),
    maskFilename,
    outputPrefix,
  }
}

async function runExecutablePromptAttempt(document, node, context, options = {}) {
  throwIfFlowInterrupted(options.signal)
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

  const outputFolders = {}
  for (const kind of ['video', 'audio', 'image']) {
    const edge = document.edges?.find(edge => edge.source === node.id
      && edge.sourceHandle === getOutputHandleForAssetKind(kind)
      && edge.targetHandle === getInputHandleForAssetKind(kind)
      && document.nodes?.some(target => target.id === edge.target && target.type === FLOW_AI_NODE_TYPES.output))
    const outputNode = document.nodes?.find(target => target.id === edge?.target)
    if (outputNode && !outputNode.data?.numberedRunFolders && !NUMBERED_RUN_FOLDER_TEMPLATE_IDS.has(document.templateId)) {
      outputFolders[kind] = getFlowOutputFolderSegments(outputNode.data?.folderName, kind)
    }
  }
  throwIfFlowInterrupted(options.signal)
  const promptId = await comfyui.queuePrompt(modifiedWorkflow, {
    canvasOutput: {
      projectDir: useProjectStore.getState().currentProjectHandle,
      documentId: document.id,
      nodeId: node.id,
      outputFolders,
    },
  })
  if (!promptId) {
    throw new Error('Failed to queue CANVAS prompt.')
  }
  markPromptHandledByApp(promptId)
  throwIfFlowInterrupted(options.signal)

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
  }, options.signal)

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
  throwIfFlowInterrupted(options.signal)
  const projectState = useProjectStore.getState()
  if (!projectState.currentProjectHandle) {
    throw new Error('Open a project before running CANVAS.')
  }
  if (node.type === FLOW_AI_NODE_TYPES.textOutput) {
    const text = resolveFlowNodeText(document, node)
    const asset = await saveCanvasTextAsset({ text, name: node.data.filename, folderName: node.data.folderName,
      projectHandle: projectState.currentProjectHandle, documentId: options.documentId, nodeId: node.id,
      importAsset, addAsset: useAssetsStore.getState().addAsset, ensureFolder: ensureAssetFolderPath })
    return { promptId: null, workflowId: '', importedAssets: [asset], textOutput: text }
  }
  if (node.type === FLOW_AI_NODE_TYPES.characterBuilder) {
    const roleAssets = {
      face: resolveConnectedAssets(document, node, 'in:face', 'image'),
      body: resolveConnectedAssets(document, node, 'in:body', 'image'),
      cloth: resolveConnectedAssets(document, node, 'in:cloth', 'image'),
    }
    if (roleAssets.face.length < 1) throw new Error('顔リファレンスを1枚以上接続してください。 / Connect at least one face reference.')
    const total = roleAssets.face.length + roleAssets.body.length + roleAssets.cloth.length
    if (total > 9) throw new Error('顔・全身・衣装の参照は合計9枚までです。 / Use at most nine references in total.')
    options.onNodePatch?.(node.id, { status: 'running', statusMessage: '.char を作成中… / Creating character file…', progress: 20, error: '' })
    const references = []
    for (const role of ['face', 'body', 'cloth']) {
      for (const asset of roleAssets[role]) {
        const source = await assetToUploadFile(asset, 0)
        const bitmap = await createImageBitmap(source)
        const canvas = document.createElement?.('canvas') || globalThis.document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        canvas.getContext('2d').drawImage(bitmap, 0, 0)
        bitmap.close?.()
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG conversion failed.')), 'image/png'))
        references.push({ role, bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height, name: source.name })
      }
    }
    const characterFile = await createCharacterFile({
      name: node?.data?.characterName || node?.data?.label || 'Character',
      description: resolvePromptText(document, node) || node?.data?.inlinePrompt || '',
      references,
      appVersion: '1',
    })
    const imported = await importAsset(projectState.currentProjectHandle, characterFile, 'characters')
    const url = await getProjectFileUrl(projectState.currentProjectHandle, imported.path)
    const folderId = ensureAssetFolderPath(['CANVAS', 'Characters'])
    const asset = useAssetsStore.getState().addAsset({
      ...imported,
      type: 'character',
      name: characterFile.name,
      url,
      folderId,
      mimeType: 'application/x-inline-character',
      settings: { characterFile: true, format: 'INLINECHAR', formatVersion: 1, referenceCount: total, representativeAssetId: roleAssets.face[0]?.id || null },
      flowAi: { documentId: options.documentId, nodeId: node.id, kind: 'character-file' },
    })
    return { promptId: null, workflowId: '', importedAssets: [asset], textOutput: '' }
  }

  const workflowId = String(node?.data?.workflowId || '').trim()
  if (node.type === FLOW_AI_NODE_TYPES.promptAssist && workflowId === 'jp-tag-assistant') {
    const query = resolvePromptText(document, node)
    if (!query) throw new Error('検索語を入力してください。 / Enter one or more search terms.')
    options.onNodePatch?.(node.id, { status: 'running', statusMessage: '日本語タグ辞書を検索中… / Searching bundled tags…', progress: 10, error: '' })
    const result = await searchBundledJpTags(query, {
      limit: node?.data?.jpTagLimit,
      useMachineLabels: node?.data?.jpTagUseMachineLabels,
      excludeLicensed: node?.data?.jpTagExcludeLicensed,
      insertSpaces: node?.data?.jpTagInsertSpaces,
    })
    if (!result.tags) throw new Error('一致するタグが見つかりませんでした。 / No matching tags were found.')
    return { promptId: null, workflowId, importedAssets: [], textOutput: result.tags }
  }
  if (node.type === FLOW_AI_NODE_TYPES.h3Optimizer) {
    options.onNodePatch?.(node.id, { status: 'running', statusMessage: 'H3構文へ整形中…', progress: 10, error: '' })
    const result = await optimizeH3Prompt(resolvePromptText(document, node), node.data)
    options.onNodePatch?.(node.id, { resolvedLlmModel: result.modelId })
    return { promptId: null, workflowId: '', importedAssets: [], textOutput: result.text }
  }
  if (node.type === FLOW_AI_NODE_TYPES.promptAssist && workflowId === ORTENZYA_WORKFLOW_ID) {
    if (collectIncomingEdges(document, node.id, 'in:image').length || collectIncomingEdges(document, node.id, 'in:video').length) {
      throw new Error('このフローはテキスト入力用です。設定・指示文またはシナリオを接続してください。')
    }
    options.onNodePatch?.(node.id, { status: 'running', statusMessage: 'Ortenzyaで文章を生成中…', progress: 10, error: '' })
    const generated = await generateOrtenzyaText({
      prompt: resolvePromptText(document, node), systemPrompt: node.data.systemPrompt,
      endpoint: node.data.localLlmEndpoint || 'http://localhost:1234', modelId: node.data.localLlmModel,
      maxTokens: node.data.maxTokens, seed: node.data.seed,
    })
    options.onNodePatch?.(node.id, { resolvedLlmModel: generated.modelId, outputTruncated: generated.truncated })
    return { promptId: null, workflowId, importedAssets: [], textOutput: generated.text }
  }
  if (GOOGLE_DIRECT_WORKFLOW_IDS.has(workflowId)) {
    return runGoogleDirectNode(document, node, options)
  }
  const dependencyCheck = await checkWorkflowDependencies(workflowId)
  if (dependencyCheck?.hasBlockingIssues) {
    if (dependencyCheck.unresolvedModels?.some(model => model.exactPath)) {
      throw new Error('VDNモデル一式を確認できません。Workflow SetupでComfyUIフォルダーを確認してください。 / Verify the VDN bundle in Workflow Setup before running.')
    }
    if (dependencyCheck.missingAuth) {
      throw new Error(`Workflow ${workflowId} needs a Comfy partner API key or other setup before it can run.`)
    }
    if ((dependencyCheck.missingNodes || []).length > 0 || (dependencyCheck.missingModels || []).length > 0) {
      throw new Error(`Workflow ${workflowId} is missing dependencies. Open Workflow Setup to install the required nodes/models.`)
    }
    if ((dependencyCheck.missingNodePacks || []).length > 0 || (dependencyCheck.unresolvedNodePacks || []).length > 0) {
      throw new Error(`Workflow ${workflowId} is missing a required custom-node add-on. Open Workflow Setup to install it, then restart ComfyUI.`)
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
    throwIfFlowInterrupted(options.signal)
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
  return generationMemory.withActivity(() => runFlowGraphImpl(document, options))
}

async function runFlowGraphImpl(document, options = {}) {
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
    throwIfFlowInterrupted(options.signal)
    const liveNode = workingDocument.nodes.find((candidate) => candidate.id === node.id) || node
    if (liveNode?.data?.muted === true) {
      const passthrough = resolveMutedNodePassthrough(workingDocument, liveNode)
      const passedCount = passthrough.outputAssetIds.length + (passthrough.outputText ? 1 : 0)
      patchWorkingNode(node.id, {
        status: 'idle',
        statusMessage: passedCount > 0
          ? 'Muted — passing the connected input through.'
          : 'Muted — this node and its branch are ignored.',
        error: '',
        outputAssetIds: passthrough.outputAssetIds,
        outputText: passthrough.outputText,
        progress: 0,
      })
      continue
    }
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
        signal: options.signal,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || 'CANVAS run failed.')
      const interrupted = error?.name === 'AbortError' || /interrupt/i.test(message)
      patchWorkingNode(node.id, {
        status: interrupted ? 'idle' : 'error',
        error: interrupted ? '' : message,
        statusMessage: interrupted ? 'Interrupted.' : '',
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
