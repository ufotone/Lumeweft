import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Clipboard, ClipboardPaste, Download, ImagePlus, Search, Sparkles, Trash2, Wrench, X } from 'lucide-react'
import {
  captureCurrentComfyGraph,
  convertCustomLibraryWorkflowToApi,
  openCustomLibraryWorkflow,
  saveCapturedGraphToLibrary,
} from '../../services/customWorkflowLibrary'
import { comfyui } from '../../services/comfyui'
import { loadGenerationRecipeDatabase, saveGenerationRecipeDatabase } from '../../services/generationRecipeDatabase'
import { openApiWorkflowInComfyUi, openUiWorkflowInComfyUi } from '../../services/workflowSetupManager'
import { diagnoseAndRepairApiWorkflow } from '../../services/workflowAutoRepair'
import { exportGenerationArtifact } from '../../services/generationArtifactExport'
import { COLLAPSED_RECIPE_IDS_KEY, readCollapsedIds, writeCollapsedIds } from '../../services/generationLibraryPreferences'
import { useI18n } from '../../i18n/I18nContext'
import useNsfwWorkflowVisibility from '../../hooks/useNsfwWorkflowVisibility'
import { ensureNsfwPrefix, isNsfwWorkflow } from '../../services/nsfwWorkflowVisibility.mjs'

const STORAGE_KEY = 'lumeweft-prompt-library-v1'
const AUDIO_RECIPE_THUMBNAIL_URL = '/generated-thumbnails/audio-eighth-note.webp'

function readEntries() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((entry) => entry?.id && entry?.text) : []
  } catch {
    return []
  }
}

function writeEntries(entries) {
  // Keep the legacy mirror for browser development and one-version rollback;
  // desktop builds use the versioned file database as the durable source.
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  void saveGenerationRecipeDatabase(entries).catch((error) => {
    console.error('[generation recipes] database write failed:', error)
  })
}

function defaultTitle(text) {
  const firstLine = String(text || '').split(/\r?\n/).find((line) => line.trim()) || 'Untitled prompt'
  return firstLine.trim().slice(0, 72)
}

function uniqueRecipeTitle(requestedTitle, entries = []) {
  const base = String(requestedTitle || '').trim() || 'Untitled prompt'
  const used = new Set(entries.map((entry) => String(entry?.title || '').trim().toLocaleLowerCase()))
  if (!used.has(base.toLocaleLowerCase())) return base
  let suffix = 2
  while (used.has(`${base} (${suffix})`.toLocaleLowerCase())) suffix += 1
  return `${base} (${suffix})`
}

const THUMBNAIL_SIZE = 50

function drawSquareThumbnail(source, sourceWidth, sourceHeight) {
  const canvas = document.createElement('canvas')
  canvas.width = THUMBNAIL_SIZE
  canvas.height = THUMBNAIL_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not prepare the thumbnail canvas.')
  const scale = Math.max(THUMBNAIL_SIZE / sourceWidth, THUMBNAIL_SIZE / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  context.drawImage(source, (THUMBNAIL_SIZE - width) / 2, (THUMBNAIL_SIZE - height) / 2, width, height)
  return canvas.toDataURL('image/webp', 0.82)
}

async function mediaBlobToThumbnail(blob) {
  const url = URL.createObjectURL(blob)
  try {
    if (String(blob.type || '').startsWith('video/')) {
      const video = document.createElement('video')
      video.muted = true
      video.preload = 'auto'
      video.src = url
      await new Promise((resolve, reject) => {
        video.onloadeddata = resolve
        video.onerror = () => reject(new Error('Could not read the video result.'))
      })
      return drawSquareThumbnail(video, video.videoWidth, video.videoHeight)
    }

    const image = new Image()
    image.src = url
    await image.decode()
    return drawSquareThumbnail(image, image.naturalWidth, image.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function fileToThumbnail(file) {
  if (!file?.type?.startsWith('image/') && !file?.type?.startsWith('video/')) {
    throw new Error('Choose an image or video file.')
  }
  return mediaBlobToThumbnail(file)
}

function findLatestComfyOutput(history = {}) {
  const records = Object.entries(history || {}).reverse()
  for (const [, record] of records) {
    const outputs = Object.values(record?.outputs || {}).reverse()
    for (const output of outputs) {
      for (const key of ['images', 'gifs', 'videos']) {
        const files = Array.isArray(output?.[key]) ? output[key] : []
        const file = files[files.length - 1]
        if (file?.filename) return file
      }
    }
  }
  return null
}

function findOutputFile(record = {}) {
  const outputs = Object.values(record?.outputs || {}).reverse()
  for (const output of outputs) {
    for (const key of ['images', 'gifs', 'videos']) {
      const files = Array.isArray(output?.[key]) ? output[key] : []
      const file = files[files.length - 1]
      if (file?.filename) return file
    }
  }
  return null
}

function findMatchingWorkflowExecution(history = {}, entry = {}) {
  const expected = String(entry?.text || '').trim()
  const expectedResources = new Set((entry?.recipe?.resources || []).map((item) => String(item?.name || '').trim()).filter(Boolean))
  const expectedSettings = entry?.recipe?.settings || {}
  const expectedPromptId = String(entry?.recipe?.promptId || '').trim()
  const expectedUiId = String(entry?.recipe?.uiWorkflow?.id || '').trim()
  const targetTime = Date.parse(entry?.createdAt || '')
  let best = null
  let bestScore = -1
  let bestTimeDistance = Number.POSITIVE_INFINITY
  for (const [promptId, record] of Object.entries(history || {})) {
    const promptData = record?.prompt
    const workflow = Array.isArray(promptData) ? promptData[2] : promptData
    if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow)) continue
    const hasPrompt = Object.values(workflow).some((node) => String(node?.inputs?.text || '').trim() === expected)
    if (!hasPrompt) continue

    const uiWorkflow = Array.isArray(promptData) ? promptData?.[3]?.extra_pnginfo?.workflow : null
    let score = 100
    if (expectedPromptId && String(promptId) === expectedPromptId) score += 10000
    if (expectedUiId && String(uiWorkflow?.id || '') === expectedUiId) score += 1000
    for (const node of Object.values(workflow)) {
      const inputs = node?.inputs || {}
      for (const value of Object.values(inputs)) {
        if (typeof value === 'string' && expectedResources.has(value.trim())) score += 10
      }
      if (expectedSettings.steps != null && Number(inputs.steps) === Number(expectedSettings.steps)) score += 2
      if (expectedSettings.cfg != null && Number(inputs.cfg) === Number(expectedSettings.cfg)) score += 2
      if (expectedSettings.sampler && inputs.sampler_name === expectedSettings.sampler) score += 2
      if (expectedSettings.scheduler && inputs.scheduler === expectedSettings.scheduler) score += 2
      if (expectedSettings.width != null && Number(inputs.width) === Number(expectedSettings.width)) score += 1
      if (expectedSettings.height != null && Number(inputs.height) === Number(expectedSettings.height)) score += 1
    }
    const executionTime = Number(promptData?.[3]?.create_time)
    const timeDistance = Number.isFinite(targetTime) && Number.isFinite(executionTime)
      ? Math.abs(targetTime - executionTime)
      : Number.POSITIVE_INFINITY
    if (score > bestScore || (score === bestScore && timeDistance < bestTimeDistance)) {
      best = {
        promptId,
        apiWorkflow: workflow,
        uiWorkflow: uiWorkflow && typeof uiWorkflow === 'object' ? uiWorkflow : null,
        record,
        outputFile: findOutputFile(record),
      }
      bestScore = score
      bestTimeDistance = timeDistance
    }
  }
  return best
}

async function historyOutputThumbnail(record) {
  const file = findOutputFile(record)
  if (!file) throw new Error('No generated image or video was found for this workflow execution.')
  const response = await fetch(comfyui.getMediaUrl(file.filename, file.subfolder || '', file.type || 'output'))
  if (!response.ok) throw new Error(`Could not read the ComfyUI result (${response.status}).`)
  return mediaBlobToThumbnail(await response.blob())
}

function extractRecipe(apiWorkflow, workflowName = '') {
  const nodes = Object.values(apiWorkflow || {}).filter((node) => node && typeof node === 'object')
  const promptNodes = nodes.filter((node) => /textencode/i.test(String(node.class_type || '')) && typeof node.inputs?.text === 'string')
  const negativeNode = promptNodes.find((node) => /negative/i.test(String(node._meta?.title || '')))
  const positiveNode = promptNodes.find((node) => node !== negativeNode)
  const resourceKeys = ['ckpt_name', 'unet_name', 'lora_name', 'vae_name', 'clip_name']
  const resources = []
  for (const node of nodes) {
    for (const key of resourceKeys) {
      const value = node.inputs?.[key]
      if (typeof value === 'string' && value.trim()) resources.push({ kind: key, name: value.trim() })
    }
  }
  const uniqueResources = [...new Map(resources.map((item) => [`${item.kind}:${item.name}`, item])).values()]
  const sampler = nodes.find((node) => /sampler/i.test(String(node.class_type || '')) && node.inputs)
  const dimensions = nodes.find((node) => Number.isFinite(Number(node.inputs?.width)) && Number.isFinite(Number(node.inputs?.height)))
  const isVideo = nodes.some((node) => /video|wanimagetovideo/i.test(`${node.class_type || ''} ${node._meta?.title || ''}`))
  const isAudio = !isVideo && nodes.some((node) => /audio|music|sound|voice|tts|irodori/i.test(`${node.class_type || ''} ${node._meta?.title || ''}`))
  return {
    workflowName: String(workflowName || '').trim(),
    positive: String(positiveNode?.inputs?.text || '').trim(),
    negative: String(negativeNode?.inputs?.text || '').trim(),
    resources: uniqueResources,
    settings: {
      steps: sampler?.inputs?.steps,
      cfg: sampler?.inputs?.cfg,
      sampler: sampler?.inputs?.sampler_name,
      scheduler: sampler?.inputs?.scheduler,
      seed: sampler?.inputs?.seed ?? sampler?.inputs?.noise_seed,
      width: dimensions?.inputs?.width,
      height: dimensions?.inputs?.height,
    },
    isVideo,
    isAudio,
  }
}

export default function PromptLibrary({ onUseInQueue }) {
  const { t } = useI18n()
  const showNsfwWorkflows = useNsfwWorkflowVisibility()
  const [entries, setEntries] = useState(readEntries)
  const [draft, setDraft] = useState('')
  const [negativeDraft, setNegativeDraft] = useState('')
  const [title, setTitle] = useState('')
  const [forImage, setForImage] = useState(true)
  const [forVideo, setForVideo] = useState(false)
  const [forAudio, setForAudio] = useState(false)
  const [draftIsNsfw, setDraftIsNsfw] = useState(false)
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [capturing, setCapturing] = useState(false)
  const [restoringId, setRestoringId] = useState('')
  const [repairingId, setRepairingId] = useState('')
  const [draftRecipe, setDraftRecipe] = useState(null)
  const [draftThumbnail, setDraftThumbnail] = useState('')
  const [thumbnailBusy, setThumbnailBusy] = useState(false)
  const [collapsedEntryIds, setCollapsedEntryIds] = useState(() => readCollapsedIds(globalThis.localStorage, COLLAPSED_RECIPE_IDS_KEY))
  const thumbnailInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    loadGenerationRecipeDatabase(readEntries())
      .then((storedEntries) => {
        if (!cancelled) setEntries(storedEntries)
      })
      .catch((error) => {
        console.error('[generation recipes] database load failed:', error)
      })
    return () => { cancelled = true }
  }, [])

  const updateEntries = (updater) => {
    setEntries((current) => {
      const next = updater(current)
      writeEntries(next)
      return next
    })
  }

  const visibleEntries = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => {
      if (!showNsfwWorkflows && isNsfwWorkflow(entry)) return false
      if (filter === 'image' && !entry.forImage) return false
      if (filter === 'video' && !entry.forVideo) return false
      if (filter === 'audio' && !entry.forAudio) return false
      return !needle || `${entry.title} ${entry.text} ${entry.negativeText || ''}`.toLowerCase().includes(needle)
    })
  }, [entries, filter, query, showNsfwWorkflows])

  const pasteDraft = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setDraft(text)
      setMessage(t(text ? 'generate.prompter.messages.clipboardLoaded' : 'generate.prompter.messages.clipboardEmpty'))
    } catch {
      setMessage(t('generate.prompter.messages.clipboardReadFailed'))
    }
  }

  const saveDraft = () => {
    const text = draft.trim()
    if (!text) {
      setMessage(t('generate.prompter.messages.promptRequired'))
      return
    }
    const requestedTitle = title.trim() || defaultTitle(text)
    const isNsfw = draftIsNsfw || isNsfwWorkflow({ title: requestedTitle, recipe: draftRecipe })
    const storedTitle = isNsfw ? ensureNsfwPrefix(requestedTitle, 'Untitled prompt') : requestedTitle
    const entry = {
      id: globalThis.crypto?.randomUUID?.() || `prompt-${Date.now()}`,
      title: uniqueRecipeTitle(storedTitle, entries),
      nsfw: isNsfw,
      text,
      negativeText: negativeDraft.trim(),
      recipe: draftRecipe,
      thumbnail: draftThumbnail,
      forImage,
      forVideo,
      forAudio,
      createdAt: new Date().toISOString(),
    }
    updateEntries((current) => [entry, ...current])
    setDraft('')
    setNegativeDraft('')
    setTitle('')
    setDraftRecipe(null)
    setDraftIsNsfw(false)
    setDraftThumbnail('')
    setMessage(t('generate.prompter.messages.saved'))
  }

  const setManualThumbnail = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setThumbnailBusy(true)
    try {
      setDraftThumbnail(await fileToThumbnail(file))
      setMessage(t('generate.prompter.messages.thumbnailSet'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.prompter.messages.thumbnailFailed'))
    } finally {
      setThumbnailBusy(false)
    }
  }

  const captureOutputThumbnail = async () => {
    if (thumbnailBusy) return
    setThumbnailBusy(true)
    setMessage(t('generate.prompter.messages.thumbnailCapturing'))
    try {
      const history = await comfyui.getHistory()
      const matchingExecution = draftRecipe && draft.trim()
        ? findMatchingWorkflowExecution(history, {
            text: draft.trim(),
            createdAt: new Date().toISOString(),
            recipe: draftRecipe,
          })
        : null
      if (matchingExecution?.record) {
        setDraftThumbnail(await historyOutputThumbnail(matchingExecution.record))
        setDraftRecipe((current) => current ? {
          ...current,
          promptId: matchingExecution.promptId,
          apiWorkflow: matchingExecution.apiWorkflow,
          uiWorkflow: matchingExecution.uiWorkflow || current.uiWorkflow,
        } : current)
      } else {
        const file = findLatestComfyOutput(history)
        if (!file) throw new Error('No generated image or video was found in ComfyUI Job History.')
        const response = await fetch(comfyui.getMediaUrl(file.filename, file.subfolder || '', file.type || 'output'))
        if (!response.ok) throw new Error(`Could not read the ComfyUI result (${response.status}).`)
        setDraftThumbnail(await mediaBlobToThumbnail(await response.blob()))
      }
      setMessage(t('generate.prompter.messages.thumbnailCaptured'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.prompter.messages.thumbnailFailed'))
    } finally {
      setThumbnailBusy(false)
    }
  }

  const captureFromComfy = async () => {
    if (capturing) return
    setCapturing(true)
    setMessage(t('generate.prompter.messages.capturing'))
    try {
      const captured = await captureCurrentComfyGraph()
      const saved = await saveCapturedGraphToLibrary(captured, captured.workflowName || `Recipe ${new Date().toLocaleString()}`)
      const converted = await convertCustomLibraryWorkflowToApi(saved.entry.id)
      if (!converted.success) throw new Error(converted.error || t('generate.prompter.messages.parseFailed'))
      const initialRecipe = extractRecipe(converted.apiWorkflow, captured.workflowName || saved.entry.title)
      let exactExecution = null
      try {
        const history = await comfyui.getHistory()
        exactExecution = findMatchingWorkflowExecution(history, {
          text: initialRecipe.positive,
          createdAt: new Date().toISOString(),
          recipe: { ...initialRecipe, uiWorkflow: captured.workflow },
        })
      } catch (_) {
        // Capturing the current graph still works while Job History is offline.
      }
      const exactApiWorkflow = exactExecution?.apiWorkflow || converted.apiWorkflow
      const exactUiWorkflow = exactExecution?.uiWorkflow || captured.workflow
      const recipe = extractRecipe(exactApiWorkflow, captured.workflowName || saved.entry.title)
      const recipeIsNsfw = isNsfwWorkflow(recipe)

      // If the sampler uses randomize/increment, the canvas already contains
      // the seed for the *next* run. Replace it with the graph recorded for the
      // matching output so the recipe and its thumbnail describe one execution.
      if (exactExecution?.uiWorkflow) {
        await saveCapturedGraphToLibrary({ ...captured, workflow: exactUiWorkflow }, captured.workflowName || saved.entry.title)
      }
      setDraft(recipe.positive)
      setNegativeDraft(recipe.negative)
      setTitle(recipeIsNsfw
        ? ensureNsfwPrefix(recipe.workflowName || saved.entry.title, 'Untitled prompt')
        : (recipe.workflowName || saved.entry.title))
      setDraftIsNsfw(recipeIsNsfw)
      setForImage(!recipe.isVideo && !recipe.isAudio)
      setForVideo(recipe.isVideo)
      setForAudio(recipe.isAudio)
      // Keep the graph itself in the recipe database. The library ID remains
      // useful for older versions, but must not be the only copy: users can
      // rename or delete My Workflows independently of their saved recipes.
      setDraftRecipe({
        ...recipe,
        workflowLibraryId: saved.entry.id,
        promptId: exactExecution?.promptId || null,
        apiWorkflow: exactApiWorkflow,
        uiWorkflow: exactUiWorkflow,
      })
      if (exactExecution?.record && exactExecution.outputFile) {
        try {
          setDraftThumbnail(await historyOutputThumbnail(exactExecution.record))
        } catch (_) {
          // A missing output preview must not prevent saving the exact graph.
        }
      }
      setMessage(t('generate.prompter.messages.captureParsed'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.prompter.messages.captureFailed'))
    } finally {
      setCapturing(false)
    }
  }

  const restoreWorkflow = async (entry) => {
    const libraryId = entry?.recipe?.workflowLibraryId
    if (!entry?.recipe || restoringId) return
    setRestoringId(entry.id)
    setMessage(t('generate.prompter.messages.restoring'))
    try {
      let result = null
      let recoveredExecution = null
      try {
        const history = await comfyui.getHistory()
        recoveredExecution = findMatchingWorkflowExecution(history, entry)
      } catch (_) {
        // Fall through to the recipe's durable workflow snapshot.
      }
      // Do not recreate the iframe here. ComfyUI's Vite module singleton can
      // be left half-initialized by repeated iframe remounts, which also breaks
      // the independent Civitai community reconstruction path afterwards.
      if (recoveredExecution?.uiWorkflow) {
        result = await openUiWorkflowInComfyUi(recoveredExecution.uiWorkflow, {
          label: entry.title,
        })
        if (result?.success) {
          updateEntries((current) => current.map((item) => item.id === entry.id
            ? {
                ...item,
                recipe: {
                  ...item.recipe,
                  promptId: recoveredExecution.promptId,
                  apiWorkflow: recoveredExecution.apiWorkflow,
                  uiWorkflow: recoveredExecution.uiWorkflow,
                },
              }
            : item))
        }
      } else if (entry.recipe.uiWorkflow) {
        result = await openUiWorkflowInComfyUi(entry.recipe.uiWorkflow, {
          label: entry.title,
        })
      } else if (entry.recipe.apiWorkflow) {
        result = await openApiWorkflowInComfyUi(entry.recipe.apiWorkflow, {
          label: entry.title,
          reloadComfyUi: false,
        })
      } else {
        // Last-resort compatibility when ComfyUI history has been cleared.
        if (!result?.success && libraryId) {
          result = await openCustomLibraryWorkflow(libraryId, { label: entry.title })
        }
      }
      if (!result?.success) throw new Error(result?.error || t('generate.prompter.messages.restoreFailed'))
      setMessage(t('generate.prompter.messages.restored', { title: entry.title }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.prompter.messages.restoreFailed'))
    } finally {
      setRestoringId('')
    }
  }

  const repairWorkflow = async (entry) => {
    if (!entry?.recipe?.apiWorkflow || repairingId) return
    setRepairingId(entry.id)
    setMessage(t('generate.history.messages.repairing'))
    try {
      const repair = await diagnoseAndRepairApiWorkflow(entry.recipe.apiWorkflow)
      if (!repair.changed) {
        setMessage(repair.unresolved.length > 0 || repair.missingNodes.length > 0
          ? t('generate.history.messages.repairAmbiguous', { count: repair.unresolved.length + repair.missingNodes.length })
          : t('generate.history.messages.repairNotNeeded'))
        return
      }
      const fixedTitle = `${entry.title} fixed`
      const result = await openApiWorkflowInComfyUi(repair.repairedWorkflow, { label: fixedTitle, reloadComfyUi: false })
      if (!result?.success) throw new Error(result?.error || t('generate.history.messages.repairFailed'))
      setMessage(t('generate.history.messages.repaired', { count: repair.replacements.length, title: fixedTitle }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.history.messages.repairFailed'))
    } finally {
      setRepairingId('')
    }
  }

  const loadToClipboard = async (entry, kind = 'positive') => {
    try {
      const value = kind === 'negative' ? String(entry.negativeText || '') : entry.text
      await navigator.clipboard.writeText(value)
      setMessage(t('generate.prompter.messages.copied', { title: entry.title, kind: t(`generate.prompter.${kind}`) }))
    } catch {
      setMessage(t('generate.prompter.messages.clipboardWriteFailed'))
    }
  }

  const toggleEntryCollapsed = (entryId) => {
    setCollapsedEntryIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      writeCollapsedIds(globalThis.localStorage, COLLAPSED_RECIPE_IDS_KEY, next)
      return next
    })
  }

  const exportEntry = async (entry) => {
    try {
      const result = await exportGenerationArtifact({ kind: 'recipe', title: entry.title, data: entry })
      if (!result.cancelled) setMessage(t('generate.prompter.messages.exported', { title: entry.title }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.prompter.messages.exportFailed'))
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-sf-dark-700 bg-sf-dark-900 p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-sf-text-primary">{t('generate.prompter.saveTitle')}</h2>
          <p className="mt-1 text-[11px] text-sf-text-muted">{t('generate.prompter.saveDescription')}</p>
        </div>
        <button type="button" onClick={() => { void captureFromComfy() }} disabled={capturing} className="mb-3 inline-flex items-center gap-2 rounded-lg border border-sf-accent/50 bg-sf-accent/10 px-3 py-2 text-xs font-medium text-sf-accent hover:bg-sf-accent/20 disabled:opacity-50">
          <ClipboardPaste className="h-3.5 w-3.5" /> {t(capturing ? 'generate.prompter.capturing' : 'generate.prompter.capture')}
        </button>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('generate.prompter.namePlaceholder')}
          className="mb-2 w-full rounded-lg border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary outline-none placeholder:text-sf-text-muted focus:border-sf-accent"
        />
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={7}
          placeholder={t('generate.prompter.positivePlaceholder')}
          className="w-full resize-y rounded-lg border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs leading-relaxed text-sf-text-primary outline-none placeholder:text-sf-text-muted focus:border-sf-accent"
        />
        <textarea
          value={negativeDraft}
          onChange={(event) => setNegativeDraft(event.target.value)}
          rows={3}
          placeholder={t('generate.prompter.negativePlaceholder')}
          className="mt-2 w-full resize-y rounded-lg border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs leading-relaxed text-sf-text-primary outline-none placeholder:text-sf-text-muted focus:border-sf-accent"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-md border border-sf-dark-600 bg-sf-dark-800">
            {draftThumbnail
              ? <img src={draftThumbnail} alt="" width="50" height="50" className="h-[50px] w-[50px] object-cover" />
              : forAudio
                ? <img src={AUDIO_RECIPE_THUMBNAIL_URL} alt={t('generate.prompter.audioThumbnailAlt')} width="50" height="50" className="h-[50px] w-[50px] object-contain" />
                : <ImagePlus className="h-5 w-5 text-sf-text-muted" />}
            {draftThumbnail && (
              <button type="button" onClick={() => setDraftThumbnail('')} title={t('generate.prompter.removeThumbnail')} className="absolute right-0 top-0 rounded-bl bg-black/70 p-0.5 text-white hover:bg-red-500">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <input ref={thumbnailInputRef} type="file" accept="image/*,video/*" onChange={(event) => { void setManualThumbnail(event) }} className="hidden" />
          <button type="button" disabled={thumbnailBusy} onClick={() => thumbnailInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-sf-dark-600 px-3 py-2 text-xs text-sf-text-secondary hover:border-sf-accent hover:text-sf-text-primary disabled:opacity-50">
            <ImagePlus className="h-3.5 w-3.5" /> {t('generate.prompter.chooseThumbnail')}
          </button>
          <button type="button" disabled={thumbnailBusy} onClick={() => { void captureOutputThumbnail() }} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-300 hover:bg-violet-500/20 disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> {t(thumbnailBusy ? 'generate.prompter.thumbnailCapturing' : 'generate.prompter.captureThumbnail')}
          </button>
          <span className="text-[10px] text-sf-text-muted">50×50</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-sf-text-secondary">
            <input type="checkbox" checked={forImage} onChange={(event) => setForImage(event.target.checked)} /> {t('generate.prompter.image')}
          </label>
          <label className="flex items-center gap-2 text-xs text-sf-text-secondary">
            <input type="checkbox" checked={forVideo} onChange={(event) => setForVideo(event.target.checked)} /> {t('generate.prompter.video')}
          </label>
          <label className="flex items-center gap-2 text-xs text-sf-text-secondary">
            <input type="checkbox" checked={forAudio} onChange={(event) => setForAudio(event.target.checked)} /> {t('generate.prompter.audio')}
          </label>
          <label className="flex items-center gap-2 text-xs text-rose-300">
            <input type="checkbox" checked={draftIsNsfw} onChange={(event) => setDraftIsNsfw(event.target.checked)} /> {t('generate.prompter.nsfw')}
          </label>
          <div className="flex-1" />
          <button type="button" onClick={() => { void pasteDraft() }} className="inline-flex items-center gap-1.5 rounded-lg border border-sf-dark-600 px-3 py-2 text-xs text-sf-text-secondary hover:border-sf-accent hover:text-sf-text-primary">
            <ClipboardPaste className="h-3.5 w-3.5" /> {t('generate.prompter.pasteClipboard')}
          </button>
          <button type="button" onClick={saveDraft} className="rounded-lg bg-sf-accent px-4 py-2 text-xs font-medium text-white hover:bg-sf-accent-hover">{t('generate.prompter.save')}</button>
        </div>
        {message && <div className="mt-2 text-[11px] text-emerald-300">{message}</div>}
      </section>

      <section className="rounded-xl border border-sf-dark-700 bg-sf-dark-900 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-semibold text-sf-text-primary">{t('generate.prompter.savedTitle')}</h2>
          {['all', 'image', 'video', 'audio'].map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-2.5 py-1 text-[10px] ${filter === value ? 'bg-sf-accent text-white' : 'bg-sf-dark-800 text-sf-text-muted hover:text-sf-text-primary'}`}>
              {t(`generate.prompter.${value}`)}
            </button>
          ))}
          <div className="flex items-center gap-1.5 rounded-lg border border-sf-dark-600 bg-sf-dark-800 px-2">
            <Search className="h-3.5 w-3.5 text-sf-text-muted" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('generate.prompter.search')} className="w-40 bg-transparent py-1.5 text-xs text-sf-text-primary outline-none placeholder:text-sf-text-muted" />
          </div>
        </div>
        <div className="space-y-2">
          {visibleEntries.map((entry) => {
            const collapsed = collapsedEntryIds.has(entry.id)
            return (
            <article key={entry.id} className="rounded-lg border border-sf-dark-700 bg-sf-dark-800/70 p-3">
              <div className="flex items-start gap-3">
                <button type="button" onClick={() => toggleEntryCollapsed(entry.id)} title={t(collapsed ? 'generate.prompter.expand' : 'generate.prompter.collapse')} className="rounded p-1 text-sf-text-muted hover:bg-sf-dark-700 hover:text-sf-text-primary">
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {(entry.thumbnail || entry.forAudio) && (
                  <img
                    src={entry.thumbnail || AUDIO_RECIPE_THUMBNAIL_URL}
                    alt={entry.thumbnail ? '' : t('generate.prompter.audioThumbnailAlt')}
                    width="50"
                    height="50"
                    className={`h-[50px] w-[50px] shrink-0 rounded-md border border-sf-dark-600 ${entry.thumbnail ? 'object-cover' : 'object-contain'}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium text-sf-text-primary">{entry.title}</span>
                    {entry.forImage && <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[9px] text-sky-300">{t('generate.prompter.image')}</span>}
                    {entry.forVideo && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] text-violet-300">{t('generate.prompter.video')}</span>}
                    {entry.forAudio && <span className="rounded bg-fuchsia-500/15 px-1.5 py-0.5 text-[9px] text-fuchsia-300">{t('generate.prompter.audio')}</span>}
                  </div>
                  {!collapsed && <>
                  <div className="mb-1 mt-2 text-[9px] font-medium uppercase tracking-wider text-sf-text-muted">{t('generate.prompter.positive')}</div>
                  <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-sf-text-secondary">{entry.text}</p>
                  {entry.negativeText && (
                    <div className="mt-2 border-t border-sf-dark-700 pt-2">
                      <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-sf-text-muted">{t('generate.prompter.negative')}</div>
                      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-red-200/75">{entry.negativeText}</p>
                    </div>
                  )}
                  {entry.recipe && (
                    <div className="mt-2 rounded border border-sf-dark-700 bg-sf-dark-900/70 p-2">
                      <div className="text-[9px] font-medium uppercase tracking-wider text-sf-text-muted">{t('generate.prompter.recipe')}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(entry.recipe.resources || []).map((resource) => <span key={`${resource.kind}:${resource.name}`} className="max-w-full truncate rounded bg-sf-dark-700 px-1.5 py-0.5 text-[9px] text-sf-text-secondary" title={resource.name}>{resource.name}</span>)}
                      </div>
                      <div className="mt-1 text-[9px] text-sf-text-muted">
                        {[entry.recipe.settings?.steps && `${entry.recipe.settings.steps} steps`, entry.recipe.settings?.cfg != null && `CFG ${entry.recipe.settings.cfg}`, entry.recipe.settings?.sampler, entry.recipe.settings?.scheduler, entry.recipe.settings?.width && entry.recipe.settings?.height && `${entry.recipe.settings.width}×${entry.recipe.settings.height}`].filter(Boolean).join(' · ') || t('generate.prompter.recipeSaved')}
                      </div>
                    </div>
                  )}
                  </>}
                </div>
                <button type="button" onClick={() => { void exportEntry(entry) }} title={t('generate.prompter.export')} className="rounded p-1.5 text-sf-text-muted hover:bg-sky-500/10 hover:text-sky-300"><Download className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => updateEntries((current) => current.filter((item) => item.id !== entry.id))} title={t('generate.prompter.delete')} className="rounded p-1.5 text-sf-text-muted hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {!collapsed && <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => { void loadToClipboard(entry, 'positive') }} className="inline-flex items-center gap-1.5 rounded bg-sf-dark-700 px-3 py-1.5 text-[11px] text-sf-text-secondary hover:text-sf-text-primary"><Clipboard className="h-3.5 w-3.5" /> {t('generate.prompter.loadPositive')}</button>
                {entry.negativeText && <button type="button" onClick={() => { void loadToClipboard(entry, 'negative') }} className="inline-flex items-center gap-1.5 rounded bg-sf-dark-700 px-3 py-1.5 text-[11px] text-sf-text-secondary hover:text-sf-text-primary"><Clipboard className="h-3.5 w-3.5" /> {t('generate.prompter.loadNegative')}</button>}
                <button type="button" onClick={() => onUseInQueue?.({ positive: entry.text, negative: String(entry.negativeText || '') })} className="rounded bg-sf-accent/15 px-3 py-1.5 text-[11px] text-sf-accent hover:bg-sf-accent/25">{t('generate.prompter.useInQueue')}</button>
                {entry.recipe && <button type="button" onClick={() => { void restoreWorkflow(entry) }} disabled={Boolean(restoringId)} className="rounded bg-violet-500/15 px-3 py-1.5 text-[11px] text-violet-300 hover:bg-violet-500/25 disabled:opacity-50">{t(restoringId === entry.id ? 'generate.prompter.restoring' : 'generate.prompter.restore')}</button>}
                {entry.recipe?.apiWorkflow && <button type="button" onClick={() => { void repairWorkflow(entry) }} disabled={Boolean(repairingId)} className="inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-3 py-1.5 text-[11px] text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"><Wrench className="h-3.5 w-3.5" /> {t(repairingId === entry.id ? 'generate.history.repairing' : 'generate.history.repair')}</button>}
              </div>}
            </article>
            )
          })}
          {visibleEntries.length === 0 && <div className="py-10 text-center text-xs text-sf-text-muted">{t('generate.prompter.empty')}</div>}
        </div>
      </section>
    </div>
  )
}

