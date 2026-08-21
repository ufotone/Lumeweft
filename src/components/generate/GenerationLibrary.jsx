import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Clipboard, Download, ExternalLink, History, Library, Trash2, Wrench } from 'lucide-react'
import PromptLibrary from './PromptLibrary'
import useGenerationHistoryStore from '../../stores/generationHistoryStore'
import useAssetsStore from '../../stores/assetsStore'
import useProjectStore from '../../stores/projectStore'
import { openApiWorkflowInComfyUi } from '../../services/workflowSetupManager'
import { diagnoseAndRepairApiWorkflow } from '../../services/workflowAutoRepair'
import { exportGenerationArtifact } from '../../services/generationArtifactExport'
import { COLLAPSED_HISTORY_IDS_KEY, readCollapsedIds, writeCollapsedIds } from '../../services/generationLibraryPreferences'
import { useI18n } from '../../i18n/I18nContext'

function formatDate(value, language) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString(language)
}

export default function GenerationLibrary({ onUseInQueue }) {
  const { t, language } = useI18n()
  const [tab, setTab] = useState('history')
  const [message, setMessage] = useState('')
  const [openingVersionId, setOpeningVersionId] = useState('')
  const [repairingVersionId, setRepairingVersionId] = useState('')
  const [collapsedRecordIds, setCollapsedRecordIds] = useState(() => readCollapsedIds(globalThis.localStorage, COLLAPSED_HISTORY_IDS_KEY))
  const records = useGenerationHistoryStore((state) => state.records)
  const setActiveVersion = useGenerationHistoryStore((state) => state.setActiveVersion)
  const removeVersion = useGenerationHistoryStore((state) => state.removeVersion)
  const removeRecord = useGenerationHistoryStore((state) => state.removeRecord)
  const assets = useAssetsStore((state) => state.assets)
  const assetsById = useMemo(() => new Map((assets || []).map((asset) => [asset.id, asset])), [assets])

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
      const result = await openApiWorkflowInComfyUi(version.apiWorkflow, {
        label: `${record.title} · v${version.number}`,
        reloadComfyUi: true,
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

  const persistHistoryDeletion = async () => {
    try {
      await useProjectStore.getState().saveProject?.()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('generate.history.messages.deleteFailed'))
    }
  }

  const deleteVersion = async (record, version) => {
    if (!window.confirm(t('generate.history.confirmDeleteVersion', { number: version.number }))) return
    if (!removeVersion(record.id, version.id)) return
    setMessage(t('generate.history.messages.versionDeleted'))
    await persistHistoryDeletion()
  }

  const deleteRecord = async (record) => {
    if (!window.confirm(t('generate.history.confirmDeleteRecord', { title: record.title }))) return
    if (!removeRecord(record.id)) return
    setMessage(t('generate.history.messages.recordDeleted'))
    await persistHistoryDeletion()
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
        kind: 'version',
        title: `${record.title} v${version.number}`,
        data: { recordId: record.id, recordTitle: record.title, version },
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
          <div>
            <h2 className="text-sm font-semibold text-sf-text-primary">{t('generate.history.title')}</h2>
            <p className="mt-1 text-[11px] text-sf-text-muted">{t('generate.history.description')}</p>
          </div>
          {message && <div className="text-[11px] text-emerald-300">{message}</div>}
          {[...records].reverse().map((record) => {
            const collapsed = collapsedRecordIds.has(record.id)
            return (
            <section key={record.id} className="rounded-xl border border-sf-dark-700 bg-sf-dark-900 p-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => toggleRecordCollapsed(record.id)} title={t(collapsed ? 'generate.history.expand' : 'generate.history.collapse')} className="rounded p-1 text-sf-text-muted hover:bg-sf-dark-800 hover:text-sf-text-primary">
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-medium text-sf-text-primary">{record.title}</h3>
                  <div className="mt-0.5 text-[10px] text-sf-text-muted">{formatDate(record.updatedAt, language)} · {t('generate.history.versionCount', { count: record.versions.length })}</div>
                </div>
                <button type="button" onClick={() => { void exportRecord(record) }} title={t('generate.history.exportRecord')} className="rounded p-1.5 text-sf-text-muted hover:bg-sky-500/10 hover:text-sky-300"><Download className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => { void deleteRecord(record) }} title={t('generate.history.deleteRecord')} className="rounded p-1.5 text-sf-text-muted hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
              {!collapsed && <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[...record.versions].reverse().map((version) => {
                  const active = record.activeVersionId === version.id
                  const outputAssets = (version.outputAssetIds || []).map((id) => assetsById.get(id)).filter(Boolean)
                  const preview = outputAssets.find((asset) => asset.url)
                  return (
                    <article key={version.id} className={`overflow-hidden rounded-lg border ${active ? 'border-sf-accent bg-sf-accent/5' : 'border-sf-dark-700 bg-sf-dark-800/60'}`}>
                      {preview?.url && (
                        <div className="h-32 bg-black/30">
                          {preview.type === 'video' ? <video src={preview.url} className="h-full w-full object-contain" muted /> : <img src={preview.url} alt="" className="h-full w-full object-contain" />}
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
                          <button type="button" onClick={() => { void copyPrompt(version.prompt) }} className="inline-flex items-center gap-1 rounded bg-sf-dark-700 px-2 py-1 text-[10px] text-sf-text-secondary hover:text-sf-text-primary"><Clipboard className="h-3 w-3" /> {t('generate.history.copy')}</button>
                          <button type="button" onClick={() => onUseInQueue?.({ positive: version.prompt || '', negative: version.settings?.negativePrompt || '' })} className="rounded bg-sf-accent/15 px-2 py-1 text-[10px] text-sf-accent hover:bg-sf-accent/25">{t('generate.prompter.useInQueue')}</button>
                          {version.apiWorkflow && <button type="button" disabled={Boolean(openingVersionId)} onClick={() => { void openVersion(record, version) }} className="inline-flex items-center gap-1 rounded bg-violet-500/15 px-2 py-1 text-[10px] text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"><ExternalLink className="h-3 w-3" /> {openingVersionId === version.id ? t('generate.history.opening') : t('generate.history.openComfy')}</button>}
                          {version.apiWorkflow && <button type="button" disabled={Boolean(repairingVersionId)} onClick={() => { void repairVersion(record, version) }} className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-500/25 disabled:opacity-50"><Wrench className="h-3 w-3" /> {repairingVersionId === version.id ? t('generate.history.repairing') : t('generate.history.repair')}</button>}
                          {!active && <button type="button" onClick={() => setActiveVersion(record.id, version.id)} className="rounded bg-sf-dark-700 px-2 py-1 text-[10px] text-sf-text-secondary hover:text-sf-text-primary">{t('generate.history.setActive')}</button>}
                          <button type="button" onClick={() => { void exportVersion(record, version) }} className="inline-flex items-center gap-1 rounded bg-sky-500/10 px-2 py-1 text-[10px] text-sky-300 hover:bg-sky-500/20"><Download className="h-3 w-3" /> {t('generate.history.export')}</button>
                          <button type="button" onClick={() => { void deleteVersion(record, version) }} title={t('generate.history.deleteVersion')} className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300 hover:bg-red-500/20"><Trash2 className="h-3 w-3" /> {t('generate.history.delete')}</button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>}
            </section>
            )
          })}
          {records.length === 0 && <div className="rounded-xl border border-dashed border-sf-dark-700 py-16 text-center text-xs text-sf-text-muted">{t('generate.history.empty')}</div>}
        </div>
      )}
    </div>
  )
}
