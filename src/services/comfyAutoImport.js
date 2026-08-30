/**
 * ComfyUI-tab auto-import bridge.
 *
 * Listens for ComfyUI websocket activity and, for eligible prompts that
 * weren't queued by Velorn's own managed workflow pipeline, pulls the
 * resulting output files into the current project's `Imported from ComfyUI/`
 * folder. By default, newly completed unmanaged prompts on the connected
 * ComfyUI instance are eligible; the startup baseline excludes old outputs.
 *
 * Design (user-confirmed):
 *   - Trigger:    status/executing websocket events for eligible prompts
 *   - Scope:      only `type: "output"` files
 *   - Who:        newly completed unmanaged prompts on the connected ComfyUI,
 *                 with filename+subfolder+mtime dedupe AND a prompt-ID guard
 *                 that skips anything GenerateWorkspace queued.
 *   - Destination: `Imported from ComfyUI/{Images,Videos,Audio}`
 *                 (virtual asset folders — same mechanism GenerateWorkspace
 *                 uses for `Generated/...`).
 *   - Sidecar:    `<asset>.workflow.json` per file.
 *   - Batch UX:   auto-detect contiguous-numeric frame sequences that
 *                 came out of a single animation-oriented node and stitch
 *                 them into an MP4 at the project's timeline fps; otherwise
 *                 flatten to individual image assets. Stitched videos get
 *                 a `sequenceSource` metadata blob so an "Unstitch" action
 *                 can undo the stitching later.
 *   - Toggle:     `comfystudio-auto-import-comfy-outputs` (localStorage,
 *                 default true).
 */

import { comfyui } from './comfyui'
import { importAsset } from './fileSystem'
import useAssetsStore from '../stores/assetsStore'
import useProjectStore from '../stores/projectStore'
import useGenerationHistoryStore from '../stores/generationHistoryStore'
import { isPromptHandledByApp } from './comfyPromptGuard'
import { classifyBatchOutputs } from './comfyWorkflowGraph'
import { IMPORTED_COMFY_ASSET_FOLDERS } from '../config/generateWorkspaceConfig'

export const AUTO_IMPORT_SETTING_KEY = 'comfystudio-auto-import-comfy-outputs'
const SEQUENCE_MIN_FRAMES = 8

const VIDEO_EXT_RE = /\.(mp4|webm|mov|mkv|avi|gif)$/i
const AUDIO_EXT_RE = /\.(mp3|wav|ogg|flac|aac|m4a)$/i
const IMAGE_EXT_RE = /\.(png|jpe?g|webp|bmp|tiff?)$/i

function isAutoImportEnabled() {
  try {
    const raw = localStorage.getItem(AUTO_IMPORT_SETTING_KEY)
    if (raw === null) return true // default on
    return raw === 'true'
  } catch (_) {
    return true
  }
}

function isElectron() {
  return typeof window !== 'undefined' && !!window.electronAPI
}

function appendLauncherLog(stream, text) {
  if (!text) return
  try {
    window.electronAPI?.comfyLauncher?.appendLog?.({ stream, text })
  } catch (_) { /* ignore */ }
}

function summarizeApiWorkflow(apiWorkflow = {}) {
  const nodes = Object.values(apiWorkflow || {})
  const textNodes = nodes.filter((node) => node?.class_type === 'CLIPTextEncode' && typeof node?.inputs?.text === 'string')
  const negativeNode = textNodes.find((node) => /negative/i.test(String(node?._meta?.title || '')))
  const positiveNode = textNodes.find((node) => node !== negativeNode && node.inputs.text.trim()) || textNodes[0]
  const sampler = nodes.find((node) => /sampler/i.test(String(node?.class_type || '')) && (node?.inputs?.noise_seed != null || node?.inputs?.seed != null))
  const modelInputNames = new Set(['ckpt_name', 'unet_name', 'lora_name', 'vae_name', 'clip_name', 'control_net_name', 'controlnet_name'])
  const modelRefs = []
  for (const node of nodes) {
    for (const [inputName, value] of Object.entries(node?.inputs || {})) {
      if (!modelInputNames.has(inputName) || typeof value !== 'string' || !value.trim()) continue
      modelRefs.push({ classType: node.class_type, inputName, filename: value.trim() })
    }
  }
  return {
    prompt: String(positiveNode?.inputs?.text || ''),
    negativePrompt: String(negativeNode?.inputs?.text || ''),
    seed: sampler?.inputs?.noise_seed ?? sampler?.inputs?.seed ?? null,
    modelRefs,
  }
}

async function saveAutoImportedGenerationHistory({ promptId, apiWorkflow, uiWorkflow, importedAssets = [] }) {
  const outputAssetIds = importedAssets.map((asset) => asset?.id).filter(Boolean)
  if (!apiWorkflow || outputAssetIds.length === 0) return
  const summary = summarizeApiWorkflow(apiWorkflow)
  const history = useGenerationHistoryStore.getState()
  const record = history.createRecord({
    title: `ComfyUI generation ${String(promptId || '').slice(0, 8)}`,
  })
  const version = history.appendVersion(record.id, {
    workflowId: 'comfyui-auto-import',
    workflowLabel: 'ComfyUI',
    promptId,
    prompt: summary.prompt,
    seed: summary.seed,
    settings: { negativePrompt: summary.negativePrompt },
    modelRefs: summary.modelRefs,
    outputAssetIds,
    apiWorkflow,
    uiWorkflow,
  })
  if (!version) return

  const assetsState = useAssetsStore.getState()
  outputAssetIds.forEach((assetId) => assetsState.updateAsset(assetId, {
    generationRecordId: record.id,
    generationVersionId: version.id,
  }))

  // History is project data. Save immediately after a completed external
  // ComfyUI run so closing the app before the next autosave cannot lose it.
  try {
    await useProjectStore.getState().saveProject?.()
  } catch (error) {
    console.warn('[comfyAutoImport] generation history save failed:', error)
  }
}

// Dedupe registry. Key = `${filename}|${subfolder}|${type}`. Trimmed to
// avoid unbounded growth in long sessions.
const MAX_SIGNATURES = 2000
const importedSignatures = new Set()
const VELORN_MANAGED_OUTPUT_RE = /^(director_job_|velorn_|velorn_job_|comfystudio_|comfystudio_job_|flow_ai_|topaz_video_upscale_|comfystudiomask_|VelornMask_)/i
const MAX_ELIGIBLE_PROMPT_IDS = 300
const eligibleUnmanagedPromptIds = new Set()
let runtimeOptions = {}

function markSignature(sig) {
  if (!sig) return false
  if (importedSignatures.has(sig)) return true
  importedSignatures.add(sig)
  if (importedSignatures.size > MAX_SIGNATURES) {
    const first = importedSignatures.values().next().value
    if (first) importedSignatures.delete(first)
  }
  return false
}

function canObserveUnmanagedPrompts(meta = {}) {
  const shouldImportUnmanagedPrompt = runtimeOptions?.shouldImportUnmanagedPrompt
  if (typeof shouldImportUnmanagedPrompt !== 'function') return true
  try {
    return shouldImportUnmanagedPrompt(meta) === true
  } catch (_) {
    return false
  }
}

function rememberEligibleUnmanagedPrompt(promptId) {
  if (!promptId) return false
  if (isPromptHandledByApp(promptId)) return false
  const pidKey = String(promptId)
  eligibleUnmanagedPromptIds.add(pidKey)
  while (eligibleUnmanagedPromptIds.size > MAX_ELIGIBLE_PROMPT_IDS) {
    const first = eligibleUnmanagedPromptIds.values().next().value
    if (first) eligibleUnmanagedPromptIds.delete(first)
    else break
  }
  return true
}

function isEligibleUnmanagedPrompt(promptId) {
  if (!promptId) return false
  if (isPromptHandledByApp(promptId)) return false
  if (eligibleUnmanagedPromptIds.has(String(promptId))) return true

  // Preserve the old always-on behavior if startComfyAutoImport is used
  // without a scope provider. The app passes one so browser/other-project
  // runs are no longer pulled in from the global history ring.
  return typeof runtimeOptions?.shouldImportUnmanagedPrompt !== 'function'
}
function sigFor(fileDesc) {
  if (!fileDesc?.filename) return null
  return `${fileDesc.filename}|${fileDesc.subfolder || ''}|${fileDesc.type || 'output'}`
}

function normalizeSourceText(value) {
  return String(value || '').trim()
}

function sameSourceText(left, right) {
  return normalizeSourceText(left).toLowerCase() === normalizeSourceText(right).toLowerCase()
}

function isVelornManagedOutput(fileDesc) {
  const filename = normalizeSourceText(fileDesc?.filename)
  return VELORN_MANAGED_OUTPUT_RE.test(filename)
}

function getAutoImportSourceFields(fileDesc, promptId) {
  return {
    source: 'comfyui-auto-import',
    promptId,
    sourceNodeId: fileDesc?.nodeId,
    sourceFilename: fileDesc?.filename || '',
    sourceSubfolder: fileDesc?.subfolder || '',
    sourceOutputType: fileDesc?.type || 'output',
  }
}

function sequenceSourceIncludesFile(sequenceSource, fileDesc) {
  const originalFiles = Array.isArray(sequenceSource?.originalFiles) ? sequenceSource.originalFiles : []
  return originalFiles.some((entry) => (
    sameSourceText(entry?.filename, fileDesc?.filename)
    && sameSourceText(entry?.subfolder || '', fileDesc?.subfolder || '')
    && sameSourceText(entry?.type || 'output', fileDesc?.type || 'output')
  ))
}

function hasExistingAutoImportedFile(promptId, fileDesc) {
  if (!promptId || !fileDesc?.filename) return false
  const { assets = [] } = useAssetsStore.getState()
  const promptKey = normalizeSourceText(promptId)
  const nodeKey = normalizeSourceText(fileDesc.nodeId)
  const filename = normalizeSourceText(fileDesc.filename)
  const subfolder = normalizeSourceText(fileDesc.subfolder || '')
  const outputType = normalizeSourceText(fileDesc.type || 'output')

  return assets.some((asset) => {
    if (!asset || asset.source !== 'comfyui-auto-import') return false
    if (normalizeSourceText(asset.promptId) !== promptKey) return false
    if (nodeKey && asset.sourceNodeId && normalizeSourceText(asset.sourceNodeId) !== nodeKey) return false
    if (sequenceSourceIncludesFile(asset.sequenceSource, fileDesc)) return true

    if (asset.sourceFilename) {
      return sameSourceText(asset.sourceFilename, filename)
        && sameSourceText(asset.sourceSubfolder || '', subfolder)
        && sameSourceText(asset.sourceOutputType || 'output', outputType)
    }

    // Backward-compatible dedupe for projects saved before sourceFilename existed.
    return sameSourceText(asset.name, filename)
  })
}

// Same ensureAssetFolderPath logic used in GenerateWorkspace — inlined
// here so we don't have to export it. Creates a chain of virtual folders
// in the assets store and returns the leaf folder id.
function ensureAssetFolderPath(pathSegments = []) {
  const segments = (Array.isArray(pathSegments) ? pathSegments : [])
    .map((s) => String(s || '').trim())
    .filter(Boolean)
  if (segments.length === 0) return null
  let parentId = null
  for (const segment of segments) {
    const { folders = [], addFolder } = useAssetsStore.getState()
    if (typeof addFolder !== 'function') return parentId
    const key = segment.toLowerCase()
    let folder = folders.find((entry) => {
      const entryParentId = entry?.parentId || null
      const entryName = String(entry?.name || '').trim().toLowerCase()
      return entryParentId === parentId && entryName === key
    })
    if (!folder) folder = addFolder({ name: segment, parentId })
    parentId = folder?.id || parentId
  }
  return parentId
}

function projectFps() {
  try {
    const state = useProjectStore.getState?.() || {}
    return state.currentProject?.settings?.fps || state.defaultFps || 24
  } catch (_) {
    return 24
  }
}

function currentProjectHandle() {
  try {
    return useProjectStore.getState?.()?.currentProjectHandle || null
  } catch (_) {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────
// Output extraction
// ─────────────────────────────────────────────────────────────────────

// Walk history.outputs and collect all `type: "output"` file descriptors,
// annotated with which node produced them and their inferred media kind.
// We intentionally skip `type: "temp"` and `type: "input"`.
function collectOutputFiles(historyEntry) {
  const outputs = historyEntry?.outputs || {}
  const results = []
  for (const nodeId of Object.keys(outputs)) {
    const nodeOut = outputs[nodeId]
    if (!nodeOut || typeof nodeOut !== 'object') continue
    for (const key of Object.keys(nodeOut)) {
      const val = nodeOut[key]
      if (!Array.isArray(val) || val.length === 0) continue
      for (const item of val) {
        if (!item || typeof item !== 'object') continue
        const filename = item.filename || item.file || item.name
        if (!filename) continue
        const subfolder = item.subfolder || item.sub_folder || ''
        const type = item.type || item.folder_type || 'output'
        if (String(type).toLowerCase() !== 'output') continue
        let kind = null
        if (VIDEO_EXT_RE.test(filename)) kind = 'video'
        else if (AUDIO_EXT_RE.test(filename)) kind = 'audio'
        else if (IMAGE_EXT_RE.test(filename)) kind = 'image'
        else continue
        // Some nodes tag their image key as 'animated' when the underlying
        // file is actually an animated webp/mp4. Respect the filename ext.
        results.push({
          nodeId: String(nodeId),
          key,
          filename,
          subfolder,
          type,
          kind,
          animated: item.animated === true || (Array.isArray(item.animated) && item.animated[0] === true),
        })
      }
    }
  }
  return results
}

// Fetch a URL and return a File object with a safe filename.
async function fetchAsFile(url, filename, mimeHint) {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Fetch failed: ${resp.status} ${resp.statusText}`)
  const blob = await resp.blob()
  const type = blob.type || mimeHint || 'application/octet-stream'
  return new File([blob], filename, { type })
}

// Extract the unwrapped API-format prompt dict from a history entry.
// ComfyUI stores it as `history[id].prompt` — an array whose index 2 is
// the API dict: [prompt_number, prompt_id, api_dict, extra_data, outputs_to_execute].
function extractApiWorkflow(historyEntry) {
  const p = historyEntry?.prompt
  if (!p) return null
  if (Array.isArray(p)) {
    return (p.length >= 3 && p[2] && typeof p[2] === 'object') ? p[2] : null
  }
  if (typeof p === 'object') return p
  return null
}

// ComfyUI stores the exact canvas graph beside the API prompt. Keeping this
// preserves layout, groups, bypass modes and widget state when a generation is
// reopened later.
function extractUiWorkflow(historyEntry) {
  const p = historyEntry?.prompt
  if (!Array.isArray(p)) return null
  const workflow = p?.[3]?.extra_pnginfo?.workflow
  return workflow && typeof workflow === 'object' ? workflow : null
}

// ─────────────────────────────────────────────────────────────────────
// Sequence stitching
// ─────────────────────────────────────────────────────────────────────

// Download the frames into a temp project folder and run ffmpeg to
// produce a single MP4. Returns:
//   { success, absolutePath, relativePath, frameDir, frameCount, fps }
// or { success: false, error }.
async function stitchSequenceToVideo({
  files,
  fps,
  projectDir,
  promptId,
  nodeId,
}) {
  if (!isElectron()) {
    return { success: false, error: 'Stitching is only supported in the desktop app.' }
  }
  const sanePromptId = String(promptId || `prompt_${Date.now()}`).replace(/[^A-Za-z0-9_-]/g, '_')
  const saneNodeId = String(nodeId || 'node').replace(/[^A-Za-z0-9_-]/g, '_')
  const frameDirName = `${sanePromptId}_${saneNodeId}`

  try {
    const framesRoot = await window.electronAPI.pathJoin(projectDir, 'assets', '.comfy-import-frames')
    await window.electronAPI.createDirectory(framesRoot)
    const frameDir = await window.electronAPI.pathJoin(framesRoot, frameDirName)
    await window.electronAPI.createDirectory(frameDir)

    // Normalize to frame_00000.png, frame_00001.png, ... so the ffmpeg
    // -framerate pattern is trivial. We always re-encode to PNG for
    // predictability; ComfyUI almost always emits PNG here anyway.
    const pad = Math.max(5, String(files.length).length)
    for (let i = 0; i < files.length; i += 1) {
      const src = files[i]
      const indexStr = String(i).padStart(pad, '0')
      const outName = `frame_${indexStr}.png`
      const destPath = await window.electronAPI.pathJoin(frameDir, outName)
      const url = comfyui.getMediaUrl(src.filename, src.subfolder || '', src.type || 'output')
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`Failed to fetch frame ${src.filename}: ${resp.status}`)
      const ab = await resp.arrayBuffer()
      const res = await window.electronAPI.writeFileFromArrayBuffer(destPath, ab)
      if (!res?.success) throw new Error(`Failed to write frame ${outName}: ${res?.error}`)
    }

    const framePattern = await window.electronAPI.pathJoin(frameDir, `frame_%0${pad}d.png`)
    const videosDir = await window.electronAPI.pathJoin(projectDir, 'assets', 'video')
    await window.electronAPI.createDirectory(videosDir)

    const outputBase = `comfy_import_${sanePromptId}_${saneNodeId}.mp4`
    // Unique-ify if needed.
    let finalName = outputBase
    let counter = 1
    let outputPath = await window.electronAPI.pathJoin(videosDir, finalName)
    while (await window.electronAPI.exists(outputPath)) {
      const ext = '.mp4'
      const base = outputBase.replace(/\.mp4$/i, '')
      finalName = `${base}_${counter}${ext}`
      outputPath = await window.electronAPI.pathJoin(videosDir, finalName)
      counter += 1
    }

    const encodeResult = await window.electronAPI.encodeVideo({
      framePattern,
      fps,
      outputPath,
      format: 'mp4',
      videoCodec: 'h264',
      qualityMode: 'crf',
      crf: 18,
      preset: 'medium',
    })
    if (!encodeResult?.success) {
      throw new Error(encodeResult?.error || 'ffmpeg encoding failed')
    }

    return {
      success: true,
      absolutePath: outputPath,
      relativePath: `assets/video/${finalName}`,
      frameDir,
      frameCount: files.length,
      fps,
      filename: finalName,
    }
  } catch (err) {
    return { success: false, error: err?.message || String(err) }
  }
}

// Save the workflow JSON next to an imported asset so the user can
// "Open in ComfyUI tab" later. Best-effort: failure is non-fatal.
async function writeWorkflowSidecar({ assetAbsolutePath, apiWorkflow, extraMeta }) {
  if (!isElectron() || !assetAbsolutePath || !apiWorkflow) return null
  try {
    const dir = await window.electronAPI.pathDirname(assetAbsolutePath)
    const base = await window.electronAPI.pathBasename(assetAbsolutePath)
    const sidecarName = `${base}.workflow.json`
    const sidecarPath = await window.electronAPI.pathJoin(dir, sidecarName)
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      source: 'comfyui-auto-import',
      ...(extraMeta || {}),
      apiWorkflow,
    }
    const res = await window.electronAPI.writeFile(sidecarPath, JSON.stringify(payload, null, 2), { encoding: 'utf-8' })
    if (res?.success) return sidecarPath
  } catch (err) {
    console.warn('[comfyAutoImport] sidecar write failed:', err)
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────
// Core import handler (per prompt)
// ─────────────────────────────────────────────────────────────────────

// Promise registry so we never run more than one concurrent import pass
// per prompt id (status broadcasts can fire rapidly around task completion).
const inFlightByPromptId = new Map()
// Set of prompt IDs whose history we have already walked to completion.
// Bounded so very long-running sessions don't leak memory.
const MAX_SEEN_PROMPT_IDS = 1000
const seenPromptIds = new Set()
let historyBaselineInitialized = false

function rememberSeenPrompt(promptId) {
  if (!promptId) return
  const pidKey = String(promptId)
  seenPromptIds.add(pidKey)
  eligibleUnmanagedPromptIds.delete(pidKey)
  if (seenPromptIds.size > MAX_SEEN_PROMPT_IDS) {
    const first = seenPromptIds.values().next().value
    if (first) seenPromptIds.delete(first)
  }
}

async function initializeHistoryBaseline() {
  if (historyBaselineInitialized) return
  try {
    const historyMap = await comfyui.getHistory()
    if (historyMap && typeof historyMap === 'object') {
      Object.keys(historyMap).forEach((promptId) => {
        if (!eligibleUnmanagedPromptIds.has(String(promptId))) rememberSeenPrompt(promptId)
      })
    }
    historyBaselineInitialized = true
  } catch (_) {
    // ComfyUI may still be booting. The first successful active-tab scan will
    // establish a baseline before importing unclaimed history entries.
  }
}

async function handlePromptSuccess(promptId, preFetchedEntry = null, options = {}) {
  if (!promptId) return
  if (!isAutoImportEnabled()) return
  if (isPromptHandledByApp(promptId)) {
    rememberSeenPrompt(promptId)
    return
  }
  const allowUnclaimed = Boolean(options?.allowUnclaimed)
  if (!isEligibleUnmanagedPrompt(promptId) && !allowUnclaimed) {
    rememberSeenPrompt(promptId)
    return
  }
  const pidKey = String(promptId)
  if (seenPromptIds.has(pidKey)) return
  if (inFlightByPromptId.has(pidKey)) return inFlightByPromptId.get(pidKey)

  const projectDir = currentProjectHandle()
  if (!projectDir) {
    // No open project — nowhere to import to. Not an error.
    return
  }

  const task = runImportPipeline(promptId, preFetchedEntry, projectDir)
    .catch((err) => {
      console.warn('[comfyAutoImport] import pipeline threw:', err)
    })
    .finally(() => {
      inFlightByPromptId.delete(pidKey)
    })
  inFlightByPromptId.set(pidKey, task)
  return task
}

async function runImportPipeline(promptId, preFetchedEntry, projectDir) {
  let historyEntry = preFetchedEntry
  if (!historyEntry) {
    try {
      const historyResp = await comfyui.getHistory(promptId)
      historyEntry = historyResp?.[promptId] || historyResp
    } catch (err) {
      console.warn('[comfyAutoImport] getHistory failed:', err)
      return
    }
  }
  if (!historyEntry || typeof historyEntry !== 'object') return
  const status = historyEntry.status
  if (!status || status.status_str !== 'success') {
    // Only mark seen on terminal status. In-progress prompts (no
    // status yet, or status_str==='running') may legitimately hit
    // this path early when an executing event fires; we want the
    // next status broadcast to retry.
    if (status && status.status_str === 'error') rememberSeenPrompt(promptId)
    return
  }
  rememberSeenPrompt(promptId)

  const apiWorkflow = extractApiWorkflow(historyEntry)
  const uiWorkflow = extractUiWorkflow(historyEntry)
  const allOutputFiles = collectOutputFiles(historyEntry)
  if (allOutputFiles.length === 0) return

  // Dedupe first. If every single file in this prompt has already been
  // imported (e.g. event fired twice for the same prompt), silently bail.
  const fresh = allOutputFiles.filter((f) => {
    const sig = sigFor(f)
    if (!sig) return false
    if (isVelornManagedOutput(f)) {
      importedSignatures.add(sig)
      return false
    }
    if (importedSignatures.has(sig)) return false
    if (hasExistingAutoImportedFile(promptId, f)) {
      importedSignatures.add(sig)
      return false
    }
    return true
  })
  if (fresh.length === 0) return

  // Log once per prompt so power users can see what the bridge did.
  appendLauncherLog('event', `↓ Auto-import: prompt ${String(promptId).slice(0, 8)} produced ${fresh.length} output file(s).`)

  // Split by kind. Videos and audio always import as-is (no stitching).
  const videoFiles = fresh.filter((f) => f.kind === 'video' || f.animated)
  const audioFiles = fresh.filter((f) => f.kind === 'audio')
  const imageFiles = fresh.filter((f) => f.kind === 'image' && !f.animated)
  const importedAssets = []

  // Videos: one asset per file.
  for (const f of videoFiles) {
    try {
      const asset = await importSingleFile({ file: f, kind: 'video', apiWorkflow, promptId, projectDir })
      if (asset) importedAssets.push(asset)
    } catch (err) {
      console.warn('[comfyAutoImport] failed to import video:', err)
    }
  }
  for (const f of audioFiles) {
    try {
      const asset = await importSingleFile({ file: f, kind: 'audio', apiWorkflow, promptId, projectDir })
      if (asset) importedAssets.push(asset)
    } catch (err) {
      console.warn('[comfyAutoImport] failed to import audio:', err)
    }
  }

  if (imageFiles.length > 0) {
    // Group image files by node for classification.
    const filesByNode = new Map()
    for (const f of imageFiles) {
      if (!filesByNode.has(f.nodeId)) filesByNode.set(f.nodeId, [])
      filesByNode.get(f.nodeId).push(f)
    }

    const classification = classifyBatchOutputs(apiWorkflow, filesByNode, {
      minFramesForSequence: SEQUENCE_MIN_FRAMES,
      requireAnimationHint: true,
    })

    if (classification.kind === 'sequence') {
    // Stitch to video. On stitch failure, fall back to per-image import so
    // the user still sees the frames and can act manually.
      try {
        const asset = await importStitchedSequence({
          classification,
          apiWorkflow,
          promptId,
          projectDir,
        })
        if (asset) importedAssets.push(asset)
      } catch (err) {
        console.warn('[comfyAutoImport] sequence stitching failed, falling back to per-image import:', err)
        appendLauncherLog('event', `! Auto-import: stitching failed for prompt ${String(promptId).slice(0, 8)} (${err?.message || err}); imported as individual images.`)
        for (const f of classification.files) {
          try {
            const asset = await importSingleFile({ file: f, kind: 'image', apiWorkflow, promptId, projectDir })
            if (asset) importedAssets.push(asset)
          } catch (err2) {
            console.warn('[comfyAutoImport] per-image fallback failed:', err2)
          }
        }
      }
    } else {
      // Plain batch or single — one asset per image.
      for (const f of imageFiles) {
        try {
          const asset = await importSingleFile({ file: f, kind: 'image', apiWorkflow, promptId, projectDir })
          if (asset) importedAssets.push(asset)
        } catch (err) {
          console.warn('[comfyAutoImport] failed to import image:', err)
        }
      }
    }
  }

  await saveAutoImportedGenerationHistory({ promptId, apiWorkflow, uiWorkflow, importedAssets })
}

async function importSingleFile({ file, kind, apiWorkflow, promptId, projectDir }) {
  const sig = sigFor(file)
  if (isVelornManagedOutput(file)) {
    if (sig) importedSignatures.add(sig)
    return
  }
  if (hasExistingAutoImportedFile(promptId, file)) {
    if (sig) importedSignatures.add(sig)
    return
  }
  if (markSignature(sig)) return

  const category = kind === 'image' ? 'images' : kind
  const folderId = ensureAssetFolderPath(IMPORTED_COMFY_ASSET_FOLDERS[kind])
  if (!folderId) return

  const url = comfyui.getMediaUrl(file.filename, file.subfolder || '', file.type || 'output')

  const mimeHint = kind === 'video'
    ? 'video/mp4'
    : kind === 'audio'
      ? 'audio/mpeg'
      : 'image/png'

  // Electron path: download, importAsset copies to project, addAsset registers.
  // Browser fallback: just register with the direct /view URL.
  const { addAsset } = useAssetsStore.getState()
  const sourceFields = getAutoImportSourceFields(file, promptId)
  if (!isElectron() || !projectDir) {
    return addAsset({
      name: file.filename,
      type: kind === 'images' ? 'image' : kind,
      url,
      folderId,
      isImported: true,
      ...sourceFields,
    })
    return
  }

  let blobFile
  try {
    blobFile = await fetchAsFile(url, file.filename, mimeHint)
  } catch (err) {
    // Last-ditch: register the /view URL directly so the user sees something.
    return addAsset({
      name: file.filename,
      type: kind === 'images' ? 'image' : kind,
      url,
      folderId,
      isImported: true,
      ...sourceFields,
    })
    return
  }

  let assetInfo
  try {
    assetInfo = await importAsset(projectDir, blobFile, category)
  } catch (err) {
    console.warn('[comfyAutoImport] importAsset failed:', err)
    const blobUrl = URL.createObjectURL(blobFile)
    addAsset({
      name: file.filename,
      type: kind === 'images' ? 'image' : kind,
      url: blobUrl,
      folderId,
      isImported: true,
      ...sourceFields,
    })
    return
  }

  const blobUrl = URL.createObjectURL(blobFile)
  const assetType = kind === 'images' || kind === 'image' ? 'image' : kind
  const newAsset = addAsset({
    ...assetInfo,
    name: file.filename,
    type: assetType,
    url: blobUrl,
    folderId,
    isImported: true,
    ...sourceFields,
  })

  // Sidecar (best effort)
  if (assetInfo?.absolutePath && apiWorkflow) {
    await writeWorkflowSidecar({
      assetAbsolutePath: assetInfo.absolutePath,
      apiWorkflow,
      extraMeta: { promptId, sourceNodeId: file.nodeId, originalFilename: file.filename },
    })
  }
  return newAsset
}

async function importStitchedSequence({ classification, apiWorkflow, promptId, projectDir }) {
  const hasExistingSequence = classification.files.some((file) => hasExistingAutoImportedFile(promptId, file))
  if (hasExistingSequence) {
    for (const file of classification.files) {
      const sig = sigFor(file)
      if (sig) importedSignatures.add(sig)
    }
    return null
  }

  const fps = projectFps()
  const stitchResult = await stitchSequenceToVideo({
    files: classification.files,
    fps,
    projectDir,
    promptId,
    nodeId: classification.nodeId,
  })
  if (!stitchResult?.success) {
    throw new Error(stitchResult?.error || 'Unknown stitching error')
  }

  // Mark all source frames as "consumed" in the dedupe set so a later
  // re-fire of execution_success doesn't re-import them as individual
  // images next to the stitched video.
  for (const f of classification.files) {
    const sig = sigFor(f)
    if (sig) importedSignatures.add(sig)
  }

  const folderId = ensureAssetFolderPath(IMPORTED_COMFY_ASSET_FOLDERS.video)

  // Use importAsset to get proper media info (duration, dims) for a file
  // already written to the project directory. importAsset handles a string
  // srcPath by copying, so we pass the absolute path and it will dedupe
  // against itself. Simpler: fabricate an assetInfo-shaped object directly
  // from the paths and skip the copy.
  let assetInfo = null
  try {
    // We can reuse importAsset by passing the absolute path as the source;
    // it will copy to assets/video/<name>.mp4 (renaming if needed). But we
    // already wrote it there — pass the path so it copies in-place to a
    // unique name. To avoid a needless copy, just fabricate the asset
    // record manually.
    const electron = window.electronAPI
    const info = await electron.getFileInfo(stitchResult.absolutePath)
    assetInfo = {
      id: `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: stitchResult.filename,
      type: 'video',
      path: stitchResult.relativePath,
      absolutePath: stitchResult.absolutePath,
      imported: new Date().toISOString(),
      size: info?.info?.size || 0,
    }
    // Try to enrich with media info (duration/dims/fps) via the existing
    // getVideoFps IPC, which also returns basic codec info.
    try {
      const fpsInfo = await electron.getVideoFps(stitchResult.absolutePath)
      if (fpsInfo?.success && fpsInfo.fps) assetInfo.fps = fpsInfo.fps
    } catch (_) { /* ignore */ }
  } catch (err) {
    console.warn('[comfyAutoImport] could not stat stitched video:', err)
  }

  const { addAsset } = useAssetsStore.getState()
  const newAsset = addAsset({
    ...(assetInfo || {
      name: stitchResult.filename,
      type: 'video',
      path: stitchResult.relativePath,
      absolutePath: stitchResult.absolutePath,
    }),
    folderId,
    isImported: true,
    source: 'comfyui-auto-import',
    promptId,
    sourceNodeId: classification.nodeId,
    sourceFilename: stitchResult.filename,
    sourceSubfolder: '',
    sourceOutputType: 'output',
    sequenceSource: {
      kind: 'comfy-stitched',
      frameDir: stitchResult.frameDir,
      frameCount: stitchResult.frameCount,
      fps: stitchResult.fps,
      nodeId: classification.nodeId,
      nodeClassType: classification.nodeClassType || null,
      originalFiles: classification.files.map((f) => ({
        filename: f.filename,
        subfolder: f.subfolder || '',
        type: f.type || 'output',
      })),
    },
  })

  appendLauncherLog('event', `✓ Auto-import: stitched ${stitchResult.frameCount} frames → ${stitchResult.filename} at ${stitchResult.fps} fps.`)

  if (assetInfo?.absolutePath && apiWorkflow) {
    await writeWorkflowSidecar({
      assetAbsolutePath: assetInfo.absolutePath,
      apiWorkflow,
      extraMeta: {
        promptId,
        sourceNodeId: classification.nodeId,
        sequence: {
          frameCount: stitchResult.frameCount,
          fps: stitchResult.fps,
          originalFilenames: classification.files.map((f) => f.filename),
        },
      },
    })
  }

  return newAsset
}

// ─────────────────────────────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────────────────────────────

// Why two trigger paths?
//
// ComfyUI sends `execution_success` (and `execution_start`, `executing:
// {node:null}`, `execution_error`) with `broadcast=False` — only to the
// websocket client that originally queued the prompt. When the user
// queues from the embedded ComfyUI tab (its own client_id), an external
// browser, or CLI, Velorn's websocket never sees these events.
//
// What *is* broadcast to every connected client:
//   - `executing` for each node (broadcast=True)
//   - `progress` during sampling (broadcast=True)
//   - `status`   whenever the queue changes (queue_updated)
//
// We use broadcast `executing` / `execution_start` events to claim prompt IDs
// while scoped importing is enabled, then use status and periodic history
// scans as completion triggers. The history fallback is
// intentionally baseline-gated so old ComfyUI history is not imported just
// because the user opens the tab.

let started = false
const detachers = []

// Debounce status-triggered history scans so rapid-fire queue updates
// coalesce into a single fetch.
let scanTimer = null
const SCAN_DEBOUNCE_MS = 300
let lastScanAt = 0
const MIN_SCAN_INTERVAL_MS = 400
const ACTIVE_TAB_POLL_MS = 2500

// How many history entries to examine per scan. ComfyUI's `/history`
// with no promptId returns the in-memory ring buffer (default 200
// entries). We only need the tail; seenPromptIds dedupes the rest.
async function scanRecentHistoryForCompletions() {
  if (!isAutoImportEnabled()) return
  if (!currentProjectHandle()) return
  const scopedToActiveTab = typeof runtimeOptions?.shouldImportUnmanagedPrompt === 'function'
  const allowActiveTabFallback = scopedToActiveTab && canObserveUnmanagedPrompts({ event: 'history_scan' })
  if (scopedToActiveTab && eligibleUnmanagedPromptIds.size === 0 && !allowActiveTabFallback) return
  const now = Date.now()
  if (now - lastScanAt < MIN_SCAN_INTERVAL_MS) return
  lastScanAt = now

  let historyMap
  try {
    historyMap = await comfyui.getHistory()
  } catch (err) {
    // Not connected yet, or transient network error. Try again next tick.
    return
  }
  if (!historyMap || typeof historyMap !== 'object') return
  const hadHistoryBaseline = historyBaselineInitialized
  if (!historyBaselineInitialized) {
    historyBaselineInitialized = true
    Object.keys(historyMap).forEach((promptId) => {
      if (!eligibleUnmanagedPromptIds.has(String(promptId))) rememberSeenPrompt(promptId)
    })
  }
  const allowUnclaimedHistoryImport = allowActiveTabFallback && hadHistoryBaseline

  for (const promptId of Object.keys(historyMap)) {
    const pidKey = String(promptId)
    if (seenPromptIds.has(pidKey)) continue
    if (isPromptHandledByApp(pidKey)) {
      rememberSeenPrompt(pidKey)
      continue
    }
    const entry = historyMap[promptId]
    const status = entry?.status
    // Only import on terminal success. Skip errors & still-running.
    if (!status) continue
    if (status.status_str === 'error') {
      rememberSeenPrompt(pidKey)
      continue
    }
    if (status.status_str !== 'success') continue
    if (!isEligibleUnmanagedPrompt(pidKey) && !allowUnclaimedHistoryImport) {
      rememberSeenPrompt(pidKey)
      continue
    }

    // Fire and forget per prompt; handlePromptSuccess serializes
    // on inFlightByPromptId so concurrent scans are safe.
    handlePromptSuccess(pidKey, entry, { allowUnclaimed: allowUnclaimedHistoryImport }).catch((err) => {
      console.warn('[comfyAutoImport] handlePromptSuccess threw:', err)
    })
  }
}

function scheduleScan() {
  if (scanTimer) return
  scanTimer = setTimeout(() => {
    scanTimer = null
    scanRecentHistoryForCompletions().catch(() => { /* swallow */ })
  }, SCAN_DEBOUNCE_MS)
}

export function startComfyAutoImport(options = {}) {
  if (started) return stopComfyAutoImport
  started = true
  runtimeOptions = options && typeof options === 'object' ? options : {}
  void initializeHistoryBaseline()
  try {
    comfyui.checkConnection?.().then((connected) => {
      if (connected && !comfyui.isWebSocketConnected?.()) {
        return comfyui.connect?.()
      }
      return null
    }).catch(() => {})
  } catch (_) { /* ignore */ }

  // Primary trigger: broadcast `status` event fires on every queue
  // change (enqueue + task_done). We only scan after seeing an eligible
  // unmanaged prompt ID, otherwise ComfyUI's global history can include
  // unrelated browser/other-project runs.
  const onStatus = () => scheduleScan()

  // Secondary trigger: same-client execution_success.
  const onSuccess = (evt) => {
    const promptId = evt?.promptId
    if (!promptId) return
    if (canObserveUnmanagedPrompts({ promptId, event: 'execution_success' })) {
      rememberEligibleUnmanagedPrompt(promptId)
    }
    handlePromptSuccess(promptId).catch((err) => {
      console.warn('[comfyAutoImport] handlePromptSuccess threw:', err)
    })
    // Also do a scan shortly after, in case the history entry's status
    // wasn't written yet when the event fired.
    scheduleScan()
  }

  const onExecutionStart = (evt) => {
    const promptId = evt?.promptId
    if (promptId && canObserveUnmanagedPrompts({ promptId, event: 'execution_start' })) {
      rememberEligibleUnmanagedPrompt(promptId)
    }
    scheduleScan()
  }

  // Tertiary: `executing` is broadcast and carries the prompt id, so this
  // is where we claim custom ComfyUI-tab runs without claiming every prompt
  // in the shared ComfyUI history.
  const onExecuting = (evt) => {
    const promptId = evt?.promptId
    if (promptId && canObserveUnmanagedPrompts({ promptId, event: 'executing' })) {
      rememberEligibleUnmanagedPrompt(promptId)
    }
    scheduleScan()
  }

  try { comfyui.on('status', onStatus) } catch (_) { /* ignore */ }
  try { comfyui.on('execution_start', onExecutionStart) } catch (_) { /* ignore */ }
  try { comfyui.on('execution_success', onSuccess) } catch (_) { /* ignore */ }
  try { comfyui.on('executing', onExecuting) } catch (_) { /* ignore */ }
  try { comfyui.on('complete', onExecuting) } catch (_) { /* ignore */ }

  const activeTabPoll = setInterval(() => {
    if (!historyBaselineInitialized) void initializeHistoryBaseline()
    if (canObserveUnmanagedPrompts({ event: 'active_tab_poll' })) scheduleScan()
  }, ACTIVE_TAB_POLL_MS)

  detachers.push(
    () => { try { comfyui.off('status', onStatus) } catch (_) { /* ignore */ } },
    () => { try { comfyui.off('execution_start', onExecutionStart) } catch (_) { /* ignore */ } },
    () => { try { comfyui.off('execution_success', onSuccess) } catch (_) { /* ignore */ } },
    () => { try { comfyui.off('executing', onExecuting) } catch (_) { /* ignore */ } },
    () => { try { comfyui.off('complete', onExecuting) } catch (_) { /* ignore */ } },
    () => { try { clearInterval(activeTabPoll) } catch (_) { /* ignore */ } },
  )

  return stopComfyAutoImport
}

export function stopComfyAutoImport() {
  if (!started) return
  started = false
  if (scanTimer) {
    clearTimeout(scanTimer)
    scanTimer = null
  }
  runtimeOptions = {}
  eligibleUnmanagedPromptIds.clear()
  historyBaselineInitialized = false
  while (detachers.length) {
    const fn = detachers.pop()
    try { fn?.() } catch (_) { /* ignore */ }
  }
}

// ─────────────────────────────────────────────────────────────────────
// Unstitch support (called from AssetsPanel context menu)
// ─────────────────────────────────────────────────────────────────────

/**
 * Undo a stitched sequence import: re-imports the original frames as
 * individual image assets in the `Imported from ComfyUI/Images` folder
 * and removes the stitched video asset + its frame cache directory.
 *
 * Pass the asset record (must have `sequenceSource` metadata written by
 * `importStitchedSequence`).
 */
export async function unstitchSequenceAsset(asset) {
  if (!asset || !asset.sequenceSource) return { success: false, error: 'Asset is not a stitched sequence.' }
  const projectDir = currentProjectHandle()
  if (!projectDir) return { success: false, error: 'No active project.' }
  const { sequenceSource } = asset
  const frames = Array.isArray(sequenceSource.originalFiles) ? sequenceSource.originalFiles : []
  if (frames.length === 0) return { success: false, error: 'No original frames recorded on asset.' }

  const apiWorkflow = null // we don't stash the workflow per-asset yet
  const imported = []
  for (const f of frames) {
    // Clear any prior dedupe entries so re-import actually happens.
    const sig = `${f.filename}|${f.subfolder || ''}|${f.type || 'output'}`
    importedSignatures.delete(sig)
    try {
      const assetRecord = await importSingleFile({
        file: { ...f, kind: 'image', nodeId: sequenceSource.nodeId },
        kind: 'image',
        apiWorkflow,
        promptId: asset.promptId || null,
        projectDir,
      })
      if (assetRecord) imported.push(assetRecord)
    } catch (err) {
      console.warn('[comfyAutoImport] unstitch re-import failed for', f.filename, err)
    }
  }

  // Remove the stitched video asset from the store.
  try {
    const { removeAsset } = useAssetsStore.getState()
    if (typeof removeAsset === 'function') removeAsset(asset.id)
  } catch (err) {
    console.warn('[comfyAutoImport] could not remove stitched asset from store:', err)
  }

  // Best-effort file cleanup: delete the MP4 and the frame cache dir.
  if (isElectron()) {
    try {
      if (asset.absolutePath) await window.electronAPI.deleteFile?.(asset.absolutePath)
    } catch (err) { console.warn('[comfyAutoImport] could not delete stitched MP4:', err) }
    try {
      if (sequenceSource.frameDir) await window.electronAPI.deleteDirectory?.(sequenceSource.frameDir)
    } catch (err) { console.warn('[comfyAutoImport] could not delete frame cache dir:', err) }
  }

  appendLauncherLog('event', `↺ Unstitched ${imported.length} frame(s) back into the asset panel.`)
  return { success: true, importedCount: imported.length }
}
