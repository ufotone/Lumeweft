import { useEffect, useMemo, useState } from 'react'
import { Archive, ExternalLink, FolderOpen, Link2, Loader2, RefreshCcw, Search, Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { createManualModelSourceCandidate, findModelSourceCandidates, formatStorageBytes, retireComfyItems, scanComfyStorage, storageSourceKey, trashComfyItems } from '../services/comfyStorageManager'

export default function ComfyStorageManagerSection() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(new Set())
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirm, setConfirm] = useState(null)
  const [sourceSearch, setSourceSearch] = useState(null)
  const [sourceSearchBusy, setSourceSearchBusy] = useState('')
  const [manualSourceUrl, setManualSourceUrl] = useState('')
  const [manualSourceError, setManualSourceError] = useState('')

  const scan = async () => {
    setBusy(true); setMessage('')
    try {
      const comfyRootPath = await window.electronAPI?.getSetting?.('comfyRootPath')
      const savedSources = await window.electronAPI?.getSetting?.('comfyStorageSources') || {}
      const result = await scanComfyStorage({ comfyRootPath, savedSources })
      setItems(result); setSelected(new Set())
      setMessage(`${result.length} items found.`)
    } catch (error) {
      setMessage(error?.message || 'Scan failed.')
    } finally { setBusy(false) }
  }

  useEffect(() => { void scan() }, [])

  const visible = useMemo(() => items.filter((item) => {
    if (filter !== 'all' && item.type !== filter) return false
    const needle = query.trim().toLowerCase()
    return !needle || `${item.name} ${item.relativePath} ${item.kind}`.toLowerCase().includes(needle)
  }), [filter, items, query])
  const selectedItems = items.filter((item) => selected.has(item.id))
  const selectedSize = selectedItems.reduce((sum, item) => sum + item.size, 0)

  const toggle = (id) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const runRetire = async () => {
    const destination = await window.electronAPI?.selectDirectory?.({ title: 'Choose a folder for retired ComfyUI items' })
    if (!destination) return
    setBusy(true); setMessage('')
    try {
      await retireComfyItems(selectedItems, destination)
      setMessage(`${selectedItems.length} items moved to ${destination}`)
      await scan()
    } catch (error) { setMessage(error?.message || 'Retirement failed.') } finally { setBusy(false) }
  }

  const runTrash = async () => {
    setBusy(true); setMessage('')
    try {
      await trashComfyItems(selectedItems)
      setMessage(`${selectedItems.length} items moved to the OS trash.`)
      await scan()
    } catch (error) { setMessage(error?.message || 'Delete failed.') } finally { setBusy(false); setConfirm(null) }
  }

  const searchSources = async (item) => {
    setSourceSearchBusy(item.id); setMessage('')
    try {
      const result = await findModelSourceCandidates(item)
      setSourceSearch({ item, ...result })
      setManualSourceUrl(''); setManualSourceError('')
      if (!result.candidates.length) setMessage(`「${result.query}」の配布候補は見つかりませんでした。`)
    } catch (error) { setMessage(error?.message || '配布元検索に失敗しました。') } finally { setSourceSearchBusy('') }
  }

  const adoptSource = async (candidate) => {
    const saved = await window.electronAPI?.getSetting?.('comfyStorageSources') || {}
    const next = { ...saved, [storageSourceKey(sourceSearch.item.name)]: { ...candidate, savedAt: new Date().toISOString() } }
    const result = await window.electronAPI?.setSetting?.('comfyStorageSources', next)
    if (!result?.success) { setMessage(result?.error || '配布元を保存できませんでした。'); return }
    setItems((current) => current.map((item) => item.id === sourceSearch.item.id
      ? { ...item, availability: 'known', sourceUrl: candidate.sourceUrl, downloadUrl: candidate.downloadUrl || '' }
      : item))
    setSourceSearch(null)
    const providerName = candidate.provider === 'civitai' ? 'Civitai' : candidate.provider === 'huggingface' ? 'Hugging Face' : candidate.title
    setMessage(`${sourceSearch.item.name} の配布元を ${providerName} に登録しました。`)
  }

  const openManualSource = (item) => {
    setManualSourceUrl(item.sourceUrl || ''); setManualSourceError('')
    setSourceSearch({ item, query: '', queries: [], candidates: [], errors: [], manualOnly: true })
  }

  const adoptManualSource = async () => {
    try {
      setManualSourceError('')
      await adoptSource(createManualModelSourceCandidate(manualSourceUrl))
    } catch (error) { setManualSourceError(error?.message || '配布URLを登録できませんでした。') }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-[11px] text-amber-100">
        「使用なし」はLumeweft内蔵ワークフローから参照が見つからないという意味です。外部ワークフローでの使用までは保証できません。ComfyUIを停止してから整理してください。
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-sf-text-muted" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="モデル・ノードを検索" className="w-full rounded border border-sf-dark-600 bg-sf-dark-800 py-2 pl-8 pr-3 text-xs text-sf-text-primary" /></div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary"><option value="all">すべて</option><option value="model">モデル</option><option value="node">拡張ノード</option></select>
        <button type="button" onClick={() => void scan()} disabled={busy} className="inline-flex items-center gap-2 rounded bg-sf-dark-700 px-3 py-2 text-xs text-sf-text-secondary hover:bg-sf-dark-600 disabled:opacity-50"><RefreshCcw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />再スキャン</button>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-sf-dark-700 bg-sf-dark-900/60 px-3 py-2">
        <span className="text-xs text-sf-text-secondary">{selectedItems.length}件選択 · {formatStorageBytes(selectedSize)}</span>
        <div className="flex gap-2"><button type="button" disabled={busy || !selectedItems.length} onClick={() => void runRetire()} className="inline-flex items-center gap-1.5 rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary hover:bg-sf-dark-600 disabled:opacity-40"><Archive className="h-3.5 w-3.5" />指定先へ退避</button><button type="button" disabled={busy || !selectedItems.length} onClick={() => setConfirm({})} className="inline-flex items-center gap-1.5 rounded bg-red-900/40 px-3 py-1.5 text-xs text-red-200 hover:bg-red-900/60 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" />ごみ箱へ</button></div>
      </div>
      {message && <p className="text-[11px] text-sf-text-muted">{message}</p>}
      <div className="overflow-hidden rounded-lg border border-sf-dark-700">
        {busy && !items.length ? <div className="flex items-center justify-center gap-2 p-8 text-sm text-sf-text-muted"><Loader2 className="h-4 w-4 animate-spin" />スキャン中…</div> : visible.map((item) => (
          <label key={item.id} className="flex cursor-pointer items-start gap-3 border-b border-sf-dark-700 bg-sf-dark-900/40 px-3 py-3 last:border-b-0 hover:bg-sf-dark-800/60">
            <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="mt-1" />
            <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="break-all text-xs font-medium text-sf-text-primary">{item.name}</span><span className="rounded bg-sf-dark-700 px-1.5 py-0.5 text-[10px] text-sf-text-secondary">{item.kind}</span><span className={`rounded px-1.5 py-0.5 text-[10px] ${item.usages.length ? 'bg-green-900/35 text-green-300' : 'bg-sf-dark-700 text-sf-text-muted'}`}>{item.usages.length ? `Lumeweft使用: ${item.usages.length}` : 'Lumeweft参照なし'}</span><span className={`rounded px-1.5 py-0.5 text-[10px] ${item.availability === 'known' ? 'bg-blue-900/35 text-blue-300' : 'bg-amber-900/30 text-amber-200'}`}>{item.availability === 'known' ? '再入手先登録済み' : '再入手先不明'}</span></div><div className="mt-1 break-all text-[10px] text-sf-text-muted">{item.path}</div>{item.usages.length > 0 && <div className="mt-1 text-[10px] text-sf-text-secondary">{item.usages.map((use) => use.name).join('、')}</div>}</div>
            <div className="flex flex-shrink-0 items-center gap-2"><span className="text-[11px] text-sf-text-muted">{formatStorageBytes(item.size)}</span>{item.type === 'model' && <><button type="button" title="配布URLを手動登録" onClick={(event) => { event.preventDefault(); openManualSource(item) }} className="text-sf-text-muted hover:text-sf-accent"><Link2 className="h-3.5 w-3.5" /></button><button type="button" disabled={Boolean(sourceSearchBusy)} title="Hugging FaceとCivitaiから配布元を検索" onClick={(event) => { event.preventDefault(); void searchSources(item) }} className="text-sf-text-muted hover:text-sf-accent disabled:opacity-40">{sourceSearchBusy === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}</button></>}{item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer" title="配布元を開く" className="text-sf-accent"><ExternalLink className="h-3.5 w-3.5" /></a>}<button type="button" title="保存先を開く" onClick={(event) => { event.preventDefault(); void window.electronAPI?.showItemInFolder?.(item.path) }} className="text-sf-text-muted hover:text-sf-text-primary"><FolderOpen className="h-3.5 w-3.5" /></button></div>
          </label>
        ))}
      </div>
      <ConfirmDialog isOpen={Boolean(confirm)} title="選択項目をごみ箱へ移動しますか？" message={`${selectedItems.length}件（${formatStorageBytes(selectedSize)}）をOSのごみ箱へ移動します。Lumeweftが参照する項目も含まれる可能性があります。`} confirmLabel="ごみ箱へ移動" cancelLabel="キャンセル" tone="danger" onConfirm={() => void runTrash()} onCancel={() => setConfirm(null)} />
      {sourceSearch && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSourceSearch(null) }}>
          <div className="flex max-h-[75vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-sf-dark-600 bg-sf-dark-900 shadow-2xl">
            <div className="border-b border-sf-dark-700 px-4 py-3"><div className="text-sm font-semibold text-sf-text-primary">配布元を選択・登録</div><div className="mt-1 break-all text-[11px] text-sf-text-muted">{sourceSearch.item.name} · 検索語: {sourceSearch.query}</div><div className="mt-3 flex gap-2"><input type="url" value={manualSourceUrl} onChange={(event) => { setManualSourceUrl(event.target.value); setManualSourceError('') }} onKeyDown={(event) => { if (event.key === 'Enter' && manualSourceUrl.trim()) void adoptManualSource() }} placeholder="https://huggingface.co/... または配布ページURL" className="min-w-0 flex-1 rounded border border-sf-dark-600 bg-sf-dark-800 px-3 py-2 text-xs text-sf-text-primary placeholder-sf-text-muted focus:border-sf-accent focus:outline-none" /><button type="button" disabled={!manualSourceUrl.trim()} onClick={() => void adoptManualSource()} className="flex-shrink-0 rounded bg-sf-accent px-3 py-2 text-xs font-medium text-white hover:bg-sf-accent/90 disabled:opacity-40">配布先を登録</button></div>{manualSourceError && <div className="mt-1.5 text-[10px] text-red-300">{manualSourceError}</div>}</div>
            {!sourceSearch.manualOnly && <div className="overflow-y-auto p-3">{sourceSearch.candidates.length ? sourceSearch.candidates.map((candidate, index) => <div key={`${candidate.provider}:${candidate.sourceUrl}:${index}`} className="mb-2 rounded-lg border border-sf-dark-700 bg-sf-dark-800/60 p-3 last:mb-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-1.5 py-0.5 text-[10px] ${candidate.provider === 'civitai' ? 'bg-violet-900/40 text-violet-200' : 'bg-yellow-900/40 text-yellow-200'}`}>{candidate.provider === 'civitai' ? 'Civitai' : 'Hugging Face'}</span><span className="text-xs font-medium text-sf-text-primary">一致度 {candidate.score}</span></div><div className="mt-1 break-all text-xs text-sf-text-secondary">{candidate.title}</div>{candidate.filename && <div className="mt-1 break-all text-[10px] text-sf-text-muted">{candidate.filename}</div>}</div><div className="flex flex-shrink-0 gap-2"><a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="rounded bg-sf-dark-700 px-2.5 py-1.5 text-[11px] text-sf-text-secondary hover:bg-sf-dark-600">確認</a><button type="button" onClick={() => void adoptSource(candidate)} className="rounded bg-sf-accent px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-sf-accent/90">この配布元を登録</button></div></div></div>) : <div className="p-6 text-center text-xs text-sf-text-muted">候補が見つかりませんでした。</div>}{sourceSearch.errors?.map((error) => <div key={error} className="mt-2 text-[10px] text-amber-300">{error}</div>)}</div>}
            <div className="flex justify-end border-t border-sf-dark-700 px-4 py-3"><button type="button" onClick={() => setSourceSearch(null)} className="rounded bg-sf-dark-700 px-3 py-1.5 text-xs text-sf-text-secondary hover:bg-sf-dark-600">閉じる</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
