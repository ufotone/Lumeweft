import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Clipboard, Download, ExternalLink, History, Library, Loader2, Trash2, Wrench } from 'lucide-react'
import PromptLibrary from './PromptLibrary'
import useGenerationHistoryStore from '../../stores/generationHistoryStore'
import useAssetsStore from '../../stores/assetsStore'
import useProjectStore from '../../stores/projectStore'
import { openApiWorkflowInComfyUi, openUiWorkflowInComfyUi } from '../../services/workflowSetupManager'
import { comfyui } from '../../services/comfyui'
import { diagnoseAndRepairApiWorkflow } from '../../services/workflowAutoRepair'
import { exportGenerationArtifact } from '../../services/generationArtifactExport'
import { COLLAPSED_HISTORY_IDS_KEY, readCollapsedIds, writeCollapsedIds } from '../../services/generationLibraryPreferences'
import { useI18n } from '../../i18n/I18nContext'
import { deleteProjectFile, isElectron } from '../../services/fileSystem'
import { planGenerationHistoryDeletion } from '../../services/generationResultDeletion'
import useNsfwWorkflowVisibility from '../../hooks/useNsfwWorkflowVisibility'
import { isNsfwWorkflow } from '../../services/nsfwWorkflowVisibility.mjs'

const AUDIO_HISTORY_THUMBNAIL_URL = '/generated-thumbnails/audio-eighth-note.webp'

function formatDate(value, language) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(language)
}

export default function GenerationLibrary({ onUseInQueue, onDeletedAssets }) {
  const { t, language } = useI18n()
  const showNsfwWorkflows = useNsfwWorkflowVisibility()
  const [tab, setTab] = useState('history')
  const [message, setMessage] = useState('')
  const [openingVersionId, setOpeningVersionId] = useState('')
  const [repairingVersionId, setRepairingVersionId] = useState('')
  const [deletingHistory, setDeletingHistory] = useState(false)
  const [selectedRecordIds, setSelectedRecordIds] = useState(() => new Set())
  const [collapsedRecordIds, setCollapsedRecordIds] = useState(() => readCollapsedIds(globalThis.localStorage, COLLAPSED_HISTORY_IDS_KEY))
  const records = useGenerationHistoryStore((state) => state.records)
  const visibleRecords = useMemo(() => (
    records.filter((record) => showNsfwWorkflows || !isNsfwWorkflow(record))
  ), [records, showNsfwWorkflows])
  const setActiveVersion = useGenerationHistoryStore((state) => state.setActiveVersion)
  const removeVersion = useGenerationHistoryStore((state) => state.removeVersion)
  const removeRecord = useGenerationHistoryStore((state) => state.removeRecord)
  const removeAsset = useAssetsStore((state) => state.removeAsset)
  const assets = useAssetsStore((state) => state.assets)
  const currentProjectHandle = useProjectStore((state) => state.currentProjectHandle)
  const assetsById = useMemo(() => new Map((assets || []).map((asset) => [asset.id, asset])), [assets])
  const selectedCount = selectedRecordIds.size
  const allRecordsSelected = visibleRecords.length > 0 && selectedCount === visibleRecords.length

  useEffect(() => {
    const currentIds = new Set(visibleRecords.map((record) => record.id))
    setSelectedRecordIds((selected) => {
      const next = new Set([...selected].filter((id) => currentIds.has(id)))
      if (next.size === selected.size && [...next].every((id) => selected.has(id))) return selected
      return next
    })
  }, [visibleRecords])

  const copyPrompt = async (text) => {
    try {
      await navigator.clipboard.writeText(String(text || ''))
      setMessage(t('generate.history.messages.copied'))
    } catch {
      setMessage(t('generate.history.messages.copyFailed'))
    }
  }

  const openVersion = async (record, version) => {
    if (!version?.apiWorkflow || openingVersionId) return
    setOpeningVersionId(version.id)
    setMessage(t('generate.history.messages.opening'))
    try {
      const label = `${record.title} · v${version.number}`
      let exactUiWorkflow = version.uiWorkflow || null
      let exactApiWorkflow = version.apiWorkflow
      const outputAsset = (version.outputAssetIds || []).map((id) => assetsById.get(id)).find(Boolean)
      const promptId = String(version.promptId || outputAsset?.promptId || '').trim()

      // Resolve by the immutable prompt ID, never by history position or the
      // latest entry. Those positions drift as parallel ComfyUI jobs finish.
      if (promptId) {
        try {
          const history = await comfyui.getHistory(promptId)
          const promptData = history?.[promptId]?.prompt
          if (Array.isArray(promptData)) {
            if (promptData?.[2] && typeof promptData[2] === 'object') exactApiWorkflow = promptData[2]
            const historyUiWorkflow = promptData?.[3]?.extra_pnginfo?.workflow
            if (historyUiWorkflow && typeof historyUiWorkflow === 'object') exactUiWorkflow = historyUiWorkflow
          }
        } catch (_) {
          // Older entries can be evicted from ComfyUI's history ring. Their
          // saved API snapshot remains available as a fallback.
        }
      }

      const result = exactUiWorkflow
        ? await openUiWorkflowInComfyUi(exactUiWorkflow, { label })
        : await openApiWorkflowInComfyUi(exactApiWorkflow, {
            label,
            reloadComfyUi: false,
          })
      if (!result?.success) throw new Error(result?.error || t('generate.history.messages.openFailed'))
      setMessage(t('generate.history.messages.opened'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.history.messages.openFailed'))
    } finally {
      setOpeningVersionId('')
    }
  }

  const repairVersion = async (record, version) => {
    if (!version?.apiWorkflow || repairingVersionId) return
    setRepairingVersionId(version.id)
    setMessage(t('generate.history.messages.repairing'))
    try {
      const repair = await diagnoseAndRepairApiWorkflow(version.apiWorkflow)
      if (!repair.changed) {
        setMessage(repair.unresolved.length > 0 || repair.missingNodes.length > 0
          ? t('generate.history.messages.repairAmbiguous', { count: repair.unresolved.length + repair.missingNodes.length })
          : t('generate.history.messages.repairNotNeeded'))
        return
      }
      const fixedLabel = `${record.title} fixed · v${version.number}`
      const result = await openApiWorkflowInComfyUi(repair.repairedWorkflow, { label: fixedLabel, reloadComfyUi: false })
      if (!result?.success) throw new Error(result?.error || t('generate.history.messages.repairFailed'))
      setMessage(t('generate.history.messages.repaired', { count: repair.replacements.length, title: fixedLabel }))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.history.messages.repairFailed'))
    } finally {
      setRepairingVersionId('')
    }
  }

  const executeHistoryDeletion = async (plan) => {
    if (deletingHistory) return false
    setDeletingHistory(true)
    let failedFileCount = 0
    try {
      if (currentProjectHandle) {
        for (const relativePath of plan.relativePaths) {
          try {
            await deleteProjectFile(currentProjectHandle, relativePath)
          } catch (_) {
            failedFileCount += 1
          }
        }
      } else {
        failedFileCount += plan.relativePaths.length
      }

      if (isElectron() && window.electronAPI?.deleteFile) {
        for (const absolutePath of plan.absolutePaths) {
          try {
            const result = await window.electronAPI.deleteFile(absolutePath)
            if (result?.success === false) failedFileCount += 1
          } catch (_) {
            failedFileCount += 1
          }
        }
      }
      if (failedFileCount > 0) {
        throw new Error(t('generate.history.messages.deleteFilesFailed', { count: failedFileCount }))
      }

      plan.blobUrls.forEach((url) => {
        try { URL.revokeObjectURL(url) } catch (_) {}
      })
      plan.assetIds.forEach((assetId) => removeAsset(assetId))
      plan.historyVersions.forEach(({ recordId, versionId }) => removeVersion(recordId, versionId))
      plan.emptyRecordIds.forEach((recordId) => removeRecord(recordId))
      await useProjectStore.getState().saveProject?.()
      onDeletedAssets?.(plan.assetIds)
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.history.messages.deleteFailed'))
      return false
    } finally {
      setDeletingHistory(false)
    }
  }

  const makeDeletionPlan = ({ recordIds = [], versionRefs = [] } = {}) => planGenerationHistoryDeletion({
    recordIds,
    versionRefs,
    assets: useAssetsStore.getState().assets,
    historyRecords: useGenerationHistoryStore.getState().records,
  })

  const deleteVersion = async (record, version) => {
    const plan = makeDeletionPlan({ versionRefs: [{ recordId: record.id, versionId: version.id }] })
    if (!window.confirm(t('generate.history.confirmDeleteVersion', { number: version.number, count: plan.assetIds.length }))) return
    if (!await executeHistoryDeletion(plan)) return
    setMessage(t('generate.history.messages.versionDeleted'))
  }

  const deleteRecord = async (record) => {
    const plan = makeDeletionPlan({ recordIds: [record.id] })
    if (!window.confirm(t('generate.history.confirmDeleteRecord', { title: record.title, count: plan.assetIds.length }))) return
    if (!await executeHistoryDeletion(plan)) return
    setMessage(t('generate.history.messages.recordDeleted'))
  }

  const toggleRecordSelected = (recordId) => {
    setSelectedRecordIds((current) => {
      const next = new Set(current)
      if (next.has(recordId)) next.delete(recordId)
      else next.add(recordId)
      return next
    })
  }

  const toggleSelectAllRecords = () => {
    setSelectedRecordIds(allRecordsSelected ? new Set() : new Set(visibleRecords.map((record) => record.id)))
  }

  const deleteSelectedRecords = async () => {
    if (selectedCount === 0) return
    const recordIds = [...selectedRecordIds]
    const plan = makeDeletionPlan({ recordIds })
    if (!window.confirm(t('generate.history.confirmDeleteSelected', { count: selectedCount, assetCount: plan.assetIds.length }))) return
    if (!await executeHistoryDeletion(plan)) return
    setSelectedRecordIds(new Set())
    setMessage(t('generate.history.messages.selectedDeleted', { count: recordIds.length }))
  }

  const toggleRecordCollapsed = (recordId) => {
    setCollapsedRecordIds((current) => {
      const next = new Set(current)
      if (next.has(recordId)) next.delete(recordId)
      else next.add(recordId)
      writeCollapsedIds(globalThis.localStorage, COLLAPSED_HISTORY_IDS_KEY, next)
      return next
    })
  }

  const exportRecord = async (record) => {
    try {
      const result = await exportGenerationArtifact({ kind: 'history', title: record.title, data: record })
      if (!result.cancelled) setMessage(t('generate.history.messages.exported'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.history.messages.exportFailed'))
    }
  }

  const exportVersion = async (record, version) => {
    try {
      const result = await exportGenerationArtifact({
        kind: version.canvasWorkflow ? 'canvas' : 'version',
        title: `${record.title} v${version.number}`,
        data: version.canvasWorkflow || { recordId: record.id, recordTitle: record.title, version },
      })
      if (!result.cancelled) setMessage(t('generate.history.messages.versionExported'))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.history.messages.exportFailed'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-sf-dark-700 bg-sf-dark-900 p-1">
        <button type="button" onClick={() => setTab('history')} className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs ${tab === 'history' ? 'bg-sf-accent text-white' : 'text-sf-text-muted hover:text-sf-text-primary'}`}>
          <History className="h-3.5 w-3.5" /> {t('generate.history.tabs.history')}
        </button>
        <button type="button" onClick={() => setTab('recipes')} className={`inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs ${tab === 'recipes' ? 'bg-sf-accent text-white' : 'text-sf-text-muted hover:text-sf-text-primary'}`}>
          <Library className="h-3.5 w-3.5" /> {t('generate.history.tabs.recipes')}
        </button>
      </div>

      {tab === 'recipes' ? <PromptLibrary onUseInQueue={onUseInQueue} /> : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-sf-text-primary">{t('generate.history.title')}</h2>
              <p className="mt-1 text-[11px] text-sf-text-muted">{t('generate.history.description')}</p>
            </div>
            {visibleRecords.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-sf-dark-600 bg-sf-dark-800 px-2.5 py-1.5 text-[10px] text-sf-text-secondary hover:border-sf-dark-500 hover:text-sf-text-primary">
                  <input type="checkbox" checked={allRecordsSelected} onChange={toggleSelectAllRecords} className="h-3.5 w-3.5 accent-sf-accent" />
                  selectAll
                </label>
                <button type="button" disabled={selectedCount === 0 || deletingHistory} onClick={() => { void deleteSelectedRecords() }} className="inline-flex items-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40">
                  {deletingHistory ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} {t('generate.history.deleteSelected')}
                </button>
              </div>
            )}
          </div>
          {message && <div className="text-[11px] text-emerald-300">{message}</div>}
          {[...visibleRecords].reverse().map((record) => {
            const collapsed = collapsedRecordIds.has(record.id)
            return (
            <section key={record.id} className="rounded-xl border border-sf-dark-700 bg-sf-dark-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <input
                  type="checkbox"
                  checked={selectedRecordIds.has(record.id)}
                  onChange={() => toggleRecordSelected(record.id)}
                  aria-label={t('generate.history.selectRecord', { title: record.title })}
                  className="mt-1 h-4 w-4 shrink-0 accent-sf-accent"
                />
                <button type="button" onClick={() => toggleRecordCollapsed(record.id)} title={t(collapsed ? 'generate.history.expand' : 'generate.history.collapse')} className="rounded p-1 text-sf-text-muted hover:bg-sf-dark-800 hover:text-sf-text-primary">
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-sf-text-primary">{record.title}</h3>
                  <div className="mt-0.5 text-[10px] text-sf-text-muted">{formatDate(record.updatedAt, language)} · {t('generate.history.versionCount', { count: record.versions.length })}</div>
                </div>
                <button type="button" onClick={() => { void exportRecord(record) }} title={t('generate.history.exportRecord')} className="rounded p-1.5 text-sf-text-muted hover:bg-sky-500/10 hover:text-sky-300"><Download className="h-3.5 w-3.5" /></button>
                <button type="button" disabled={deletingHistory} onClick={() => { void deleteRecord(record) }} title={t('generate.history.deleteRecord')} className="rounded p-1.5 text-sf-text-muted hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {!collapsed && <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[...record.versions].reverse().map((version) => {
                  const active = record.activeVersionId === version.id
                  const outputAssets = (version.outputAssetIds || []).map((id) => assetsById.get(id)).filter(Boolean)
                  const preview = outputAssets.find((asset) => asset.url) || outputAssets[0]
                  const previewIsVisual = preview?.type === 'image' || preview?.type === 'video'
                  return (
                    <article key={version.id} className={`overflow-hidden rounded-lg border ${active ? 'border-sf-accent bg-sf-accent/5' : 'border-sf-dark-700 bg-sf-dark-800/60'}`}>
                      {preview && (preview.url || !previewIsVisual) && (
                        <div className="h-32 bg-black/30">
                          {preview.type === 'video' && preview.url
                            ? <video src={preview.url} className="h-full w-full object-contain" muted />
                            : preview.type === 'image' && preview.url
                              ? <img src={preview.url} alt="" className="h-full w-full object-contain" />
                              : <img src={AUDIO_HISTORY_THUMBNAIL_URL} alt={t('generate.history.audioThumbnailAlt')} className="h-full w-full object-contain" />}
                        </div>
                      )}
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium text-sf-text-primary">v{version.number}</span>
                          {active && <span className="rounded bg-sf-accent/20 px-1.5 py-0.5 text-[9px] text-sf-accent">{t('generate.history.active')}</span>}
                        </div>
                        <div className="mt-1 text-[9px] text-sf-text-muted">{version.workflowLabel || version.workflowId || 'ComfyUI'} · {formatDate(version.createdAt, language)}</div>
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-[11px] leading-relaxed text-sf-text-secondary">{version.prompt || '—'}</p>
                        <div className="mt-2 text-[9px] text-sf-text-muted">
                          {[version.seed != null && `Seed ${version.seed}`, version.settings?.resolution?.width && `${version.settings.resolution.width}×${version.settings.resolution.height}`, version.settings?.duration && `${version.settings.duration}s`].filter(Boolean).join(' · ')}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {version.canvasWorkflow && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('lumeweft-restore-canvas', { detail: version.canvasWorkflow }))} className="rounded bg-emerald-500/15 px-2 py-1 text-[10px] text-emerald-300">CANVASでフローを復元</button>}
                          <button type="button" onClick={() => { void copyPrompt(version.prompt) }} className="inline-flex items-center gap-1 rounded bg-sf-dark-700 px-2 py-1 text-[10px] text-sf-text-secondary hover:text-sf-text-primary"><Clipboard className="h-3 w-3" /> {t('generate.history.copy')}</button>
                          <button type="button" onClick={() => onUseInQueue?.({ positive: version.prompt || '', negative: version.settings?.negativePrompt || '' })} className="rounded bg-sf-accent/15 px-2 py-1 text-[10px] text-sf-accent hover:bg-sf-accent/25">{t('generate.prompter.useInQueue')}</button>
                          {version.apiWorkflow && <button type="button" disabled={Boolean(openingVersionId)} onClick={() => { void openVersion(record, version) }} className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"><ExternalLink className="h-3 w-3" /> {openingVersionId === version.id ? t('generate.history.opening') : t('generate.history.openComfy')}</button>}
                          {version.apiWorkflow && <button type="button" disabled={Boolean(repairingVersionId)} onClick={() => { void repairVersion(record, version) }} className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"><Wrench className="h-3 w-3" /> {repairingVersionId === version.id ? t('generate.history.repairing') : t('generate.history.repair')}</button>}
                          {!active && <button type="button" onClick={() => setActiveVersion(record.id, version.id)} className="rounded bg-sf-dark-700 px-2 py-1 text-[10px] text-sf-text-secondary hover:text-sf-text-primary">{t('generate.history.setActive')}</button>}
                          <button type="button" onClick={() => { void exportVersion(record, version) }} className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/20"><Download className="h-3 w-3" /> {t('generate.history.export')}</button>
                          <button type="button" disabled={deletingHistory} onClick={() => { void deleteVersion(record, version) }} title={t('generate.history.deleteVersion')} className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/20 disabled:opacity-40"><Trash2 className="h-3 w-3" /> {t('generate.history.delete')}</button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>}
            </section>
            )
          })}
          {visibleRecords.length === 0 && <div className="rounded-xl border border-dashed border-sf-dark-700 py-16 text-center text-xs text-sf-text-muted">{t('generate.history.empty')}</div>}
        </div>
      )}
    </div>
  )
}
