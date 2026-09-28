import { useState } from 'react'
import { useI18n } from '../i18n/I18nContext'
import useAssetsStore from '../stores/assetsStore'
import useProjectStore from '../stores/projectStore'
import LayerPaintDialog from './LayerPaintDialog'

// Kept mounted by App so switching top tabs preserves the current drawing.
export default function PaintWorkspace() {
  const { t } = useI18n()
  const projectHandle = useProjectStore(state => state.currentProjectHandle)
  const assets = useAssetsStore(state => state.assets)
  const [request, setRequest] = useState(null)
  if (request) return <LayerPaintDialog embedded {...request} onClose={() => setRequest(null)} />
  const images = assets.filter(asset => asset.type === 'image')
  return <section className="flex-1 min-h-0 overflow-auto bg-sf-dark-950 p-6 text-sf-text-primary">
    <header className="flex items-center gap-4 mb-6">
      <div className="flex-1"><h1 className="text-xl font-semibold">Paint</h1><p className="mt-2 text-sm text-sf-text-muted">{t('paint.workspaceHint')}</p></div>
      <button disabled={!projectHandle} onClick={() => setRequest({ projectHandle })} className="rounded-lg bg-sf-accent px-4 py-2 text-sm text-white disabled:opacity-40">{t('paint.new')}</button>
    </header>
    {!images.length && <p className="text-sm text-sf-text-muted">{t('paint.empty')}</p>}
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
      {images.map(asset => <button key={asset.id} disabled={!projectHandle} onClick={() => setRequest({ projectHandle, sourceAsset: asset, folderId: asset.folderId })} title={t('paint.open')} className="overflow-hidden rounded-lg border border-sf-dark-700 bg-sf-dark-900 text-left hover:border-sf-accent">
        <div className="h-32 bg-sf-dark-800">{asset.url && <img src={asset.url} alt="" loading="lazy" className="h-full w-full object-contain" />}</div>
        <div className="p-3"><p className="truncate text-sm">{asset.name}</p>{asset.settings?.paintDocument && <p className="mt-1 text-xs text-sf-text-muted">{t('paint.layers')}</p>}</div>
      </button>)}
    </div>
  </section>
}
