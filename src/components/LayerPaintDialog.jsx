import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/I18nContext'
import useAssetsStore from '../stores/assetsStore'
import useProjectStore from '../stores/projectStore'
import { assertPaintCapacity, compositePaint, createPaintHistory, createPaintLayer, deserializePaint, invertPaintMask, loadPaintImage, makePaintCanvas, paintDimensions, paintPngBlob, beginPaintStroke, serializePaint } from '../services/layeredPaint.mjs'
import { paintAssetUrl, readPaintDocument, savePaintAsset } from '../services/paintProjectAssets'

export default function LayerPaintDialog({ projectHandle, sourceAsset = null, firstAsset = null, folderId = null, defaultSize = 1024, background = null, embedded = false, onSaved, onClose }) {
  const { t } = useI18n()
  const tr = key => t(`paint.${key}`)
  const assets = useAssetsStore(state => state.assets)
  const doc = useRef(null), history = useRef(null), canvas = useRef(null), gesture = useRef(null), root = useRef(null)
  const [revision, refresh] = useState(0), [active, setActive] = useState(''), [target, setTarget] = useState('pixels')
  const [busy, setBusy] = useState(true), [error, setError] = useState(''), [fallback, setFallback] = useState(false)
  const [dirty, setDirty] = useState(false), [discard, setDiscard] = useState(false)
  const [tool, setTool] = useState('brush'), [color, setColor] = useState('#ffffff'), [size, setSize] = useState(32), [opacity, setOpacity] = useState(1)
  const [reveal, setReveal] = useState(false), [maskView, setMaskView] = useState(false), [zoom, setZoom] = useState('fit')
  const [name, setName] = useState(sourceAsset?.name || 'Paint'), [width, setWidth] = useState(defaultSize), [height, setHeight] = useState(defaultSize)
  const [setup, setSetup] = useState(!sourceAsset), [fill, setFill] = useState(background || 'transparent')
  const layer = doc.current?.layers.find(item => item.id === active)
  const bump = () => refresh(value => value + 1)
  const commit = () => { history.current.push(serializePaint(doc.current)); setDirty(true); bump() }
  const mutate = action => { try { action(); commit(); setError('') } catch (e) { setError(e.message) } }
  const accept = value => { doc.current = value; history.current = createPaintHistory(serializePaint(value)); setActive(value.layers.at(-1).id); setTarget('pixels'); bump() }
  const imageLayer = async asset => {
    const image = await loadPaintImage(await paintAssetUrl(projectHandle, asset))
    const value = createPaintLayer(doc.current.width, doc.current.height, asset.name)
    const scale = Math.min(1, doc.current.width / image.naturalWidth, doc.current.height / image.naturalHeight)
    value.pixels.getContext('2d').drawImage(image, (doc.current.width - image.naturalWidth * scale) / 2, (doc.current.height - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale)
    return value
  }
  const initialize = async flattened => {
    setBusy(true); setError('')
    try {
      const saved = sourceAsset && !flattened ? await readPaintDocument(projectHandle, sourceAsset) : null
      if (saved) { accept(await deserializePaint(saved)); setName(saved.name) }
      else if (sourceAsset) {
        const image = await loadPaintImage(await paintAssetUrl(projectHandle, sourceAsset))
        const dimensions = paintDimensions(image.naturalWidth, image.naturalHeight)
        const item = createPaintLayer(dimensions.width, dimensions.height, sourceAsset.name)
        item.pixels.getContext('2d').drawImage(image, 0, 0)
        accept({ ...dimensions, name: sourceAsset.name, layers: [item] })
      }
      setFallback(false)
    } catch (e) { setError(e.message); setFallback(Boolean(sourceAsset?.settings?.paintDocument)) }
    finally { setBusy(false) }
  }
  useEffect(() => { initialize(false) }, [])
  useEffect(() => {
    const previous = document.activeElement
    root.current?.focus()
    return () => previous?.focus?.()
  }, [])
  useEffect(() => {
    if (!canvas.current || !doc.current) return
    if (maskView && target === 'mask' && layer?.mask) {
      const ctx = canvas.current.getContext('2d'); ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, doc.current.width, doc.current.height); ctx.drawImage(layer.mask, 0, 0)
    } else compositePaint(doc.current, canvas.current)
  }, [revision, active, target, maskView, setup])
  const undo = async redo => {
    if (busy || gesture.current) return
    const snapshot = redo ? history.current?.redo() : history.current?.undo()
    if (!snapshot) return
    setBusy(true)
    try { doc.current = await deserializePaint(snapshot); if (!doc.current.layers.some(l => l.id === active)) setActive(doc.current.layers.at(-1).id); setDirty(true); bump() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const close = () => { if (!busy) dirty ? setDiscard(true) : onClose() }
  const point = event => { const rect = canvas.current.getBoundingClientRect(); return { x: (event.clientX - rect.left) * doc.current.width / rect.width, y: (event.clientY - rect.top) * doc.current.height / rect.height } }
  const frame = useRef(null)
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current) }, [])
  const renderGesture = () => {
    const g = gesture.current
    if (!g) return
    if (g.stroke) g.stroke.render()
    else { const ctx = g.surface.getContext('2d'); ctx.clearRect(0, 0, doc.current.width, doc.current.height); ctx.drawImage(g.backup, g.last.x - g.from.x, g.last.y - g.from.y) }
    bump()
  }
  const start = event => {
    if (busy || discard || gesture.current || event.button !== 0 || !layer?.[target]) return
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId)
    const pos = point(event), backup = makePaintCanvas(doc.current.width, doc.current.height), surface = layer[target]
    backup.getContext('2d').drawImage(surface, 0, 0)
    gesture.current = { pointerId: event.pointerId, from: pos, last: pos, backup, surface,
      stroke: tool === 'move' ? null : beginPaintStroke(surface, pos, { size, opacity, color: target === 'mask' ? '#ffffff' : color, erase: target === 'mask' ? !reveal : tool === 'eraser' }, backup) }
    renderGesture()
  }
  const sample = event => {
    const g = gesture.current
    const native = event.nativeEvent || event
    const samples = native.getCoalescedEvents?.() || []
    // Some engines omit the dispatched endpoint from the coalesced list.
    for (const entry of [...samples, event]) { const pos = point(entry); g.stroke?.append(pos); g.last = pos }
  }
  const move = event => {
    if (!gesture.current || event.pointerId !== gesture.current.pointerId) return
    sample(event)
    if (frame.current === null) frame.current = requestAnimationFrame(() => { frame.current = null; renderGesture() })
  }
  const finish = (cancel, event) => {
    const g = gesture.current
    if (!g || (event && event.pointerId !== g.pointerId)) return
    if (frame.current !== null) { cancelAnimationFrame(frame.current); frame.current = null }
    if (cancel) { const ctx = g.surface.getContext('2d'); ctx.clearRect(0, 0, doc.current.width, doc.current.height); ctx.drawImage(g.backup, 0, 0); bump() }
    else { if (event) sample(event); renderGesture(); commit() }
    gesture.current = null
  }
  const addImage = async asset => {
    setBusy(true)
    try { assertPaintCapacity(doc.current, 1, 1); const item = await imageLayer(asset); doc.current.layers.push(item); setActive(item.id); setTarget('pixels'); commit() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const save = async () => {
    setBusy(true); setError('')
    try {
      doc.current.name = name
      const asset = await savePaintAsset({ projectHandle, document: serializePaint(doc.current), png: await paintPngBlob(compositePaint(doc.current)), name, folderId, sourceAssetId: sourceAsset?.id })
      if (useProjectStore.getState().currentProjectHandle !== projectHandle) throw new Error(tr('projectChanged'))
      const registered = useAssetsStore.getState().addAsset(asset)
      onSaved?.(registered); onClose()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const duplicate = () => mutate(() => { assertPaintCapacity(doc.current, layer.mask ? 2 : 1, 1); const item = createPaintLayer(doc.current.width, doc.current.height, `${layer.name} +`); Object.assign(item, { visible: layer.visible, opacity: layer.opacity, blend: layer.blend, maskEnabled: layer.maskEnabled }); item.pixels.getContext('2d').drawImage(layer.pixels, 0, 0); if (layer.mask) { item.mask = makePaintCanvas(doc.current.width, doc.current.height); item.mask.getContext('2d').drawImage(layer.mask, 0, 0) } doc.current.layers.splice(doc.current.layers.indexOf(layer) + 1, 0, item); setActive(item.id) })
  const button = 'rounded px-2 py-1.5 bg-sf-dark-700 hover:bg-sf-dark-600 disabled:opacity-40 text-xs'
  const field = 'rounded bg-sf-dark-800 border border-sf-dark-600 p-1 min-w-0 text-xs'
  const content = <div className={embedded ? "flex flex-1 min-h-0 h-full" : "fixed inset-0 z-[80] bg-black/80 flex items-center justify-center"} onPointerDown={e => e.stopPropagation()}>
    <section ref={root} tabIndex={-1} role={embedded ? 'region' : 'dialog'} aria-modal={embedded ? undefined : true} aria-label={tr('title')} className={`${embedded ? "w-full h-full min-h-0" : "w-[96vw] h-[92vh] rounded-xl border border-sf-dark-600"} flex flex-col bg-sf-dark-900 text-sf-text-primary overflow-hidden`} onKeyDown={event => {
      event.stopPropagation()
      if (!embedded && event.key === 'Tab') { const elements = [...root.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el => el.offsetParent); const first = elements[0], last = elements.at(-1); if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) { event.preventDefault(); last?.focus() } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() } }
      if (event.key === 'Escape') { event.preventDefault(); discard ? setDiscard(false) : close() }
      if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName) && (event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); undo(event.shiftKey || event.key.toLowerCase() === 'y') }
    }}>
      <header className="flex gap-3 items-center p-3 border-b border-sf-dark-700"><strong>{tr('title')}</strong><input aria-label={tr('name')} className={field} value={name} onChange={e => { setName(e.target.value); setDirty(true) }} /><span className="text-xs text-sf-text-muted flex-1">{tr('saveHint')}</span><button className={button} disabled={busy || !doc.current || setup} onClick={save}>{busy ? tr('working') : tr('save')}</button><button className={button} disabled={busy} onClick={close}>{tr('close')}</button></header>
      {error && <div role="alert" className="p-2 text-red-300 text-sm">{error} {fallback && <button className={button} onClick={() => initialize(true)}>{tr('flattened')}</button>}</div>}
      {discard && <div role="alertdialog" aria-label={tr('discard')} className="p-4 bg-sf-dark-700 flex gap-3 items-center"><span>{tr('discard')}</span><button className={button} onClick={onClose}>{tr('discardYes')}</button><button className={button} onClick={() => setDiscard(false)}>{tr('continue')}</button></div>}
      {setup ? <div className="m-auto flex flex-col gap-4"><h3>{tr('new')}</h3><label>{tr('width')} <input className={field} type="number" min="16" max="4096" value={width} onChange={e => setWidth(e.target.value)} /></label><label>{tr('height')} <input className={field} type="number" min="16" max="4096" value={height} onChange={e => setHeight(e.target.value)} /></label><select aria-label={tr('background')} className={field} value={fill} onChange={e => setFill(e.target.value)}><option value="transparent">{tr('transparent')}</option><option value="#000000">{tr('black')}</option><option value="#ffffff">{tr('white')}</option></select><button className={button} disabled={busy} onClick={() => { try { const dims = paintDimensions(width, height); accept({ ...dims, name, layers: [createPaintLayer(dims.width, dims.height, tr('layer'), fill === 'transparent' ? null : fill)] }); setSetup(false); setDirty(true); setError('') } catch (e) { setError(e.message) } }}>{tr('create')}</button></div> : doc.current && <>
        <fieldset disabled={busy || discard} className="flex items-center gap-3 p-2 flex-wrap border-b border-sf-dark-700">
          {['brush', 'eraser', 'move'].map(value => <button key={value} aria-pressed={tool === value} className={`${button} ${tool === value ? 'ring-1 ring-sf-accent' : ''}`} onClick={() => setTool(value)}>{tr(value)}</button>)}
          <input type="color" aria-label={tr('color')} value={color} onChange={e => setColor(e.target.value)} disabled={target === 'mask'} />
          <label className="text-xs">{tr('size')} <input aria-label={tr('size')} className="w-24" type="range" min="1" max="300" value={size} onChange={e => setSize(+e.target.value)} /> {size}</label>
          <label className="text-xs">{tr('brushOpacity')} <input aria-label={tr('brushOpacity')} className="w-20" type="range" min="0.05" max="1" step="0.05" value={opacity} onChange={e => setOpacity(+e.target.value)} /></label>
          <button className={button} disabled={!history.current?.canUndo} onClick={() => undo(false)}>{tr('undo')}</button><button className={button} disabled={!history.current?.canRedo} onClick={() => undo(true)}>{tr('redo')}</button>
          <select aria-label={tr('zoom')} className={field} value={zoom} onChange={e => setZoom(e.target.value)}>{['fit', '0.25', '0.5', '1', '2', '4'].map(value => <option key={value} value={value}>{value === 'fit' ? tr('fit') : `${Number(value) * 100}%`}</option>)}</select>
        </fieldset>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 overflow-auto p-6 bg-sf-dark-950"><canvas ref={canvas} width={doc.current.width} height={doc.current.height} aria-label={tr('canvas')} onPointerDown={start} onPointerMove={move} onPointerUp={event => finish(false, event)} onPointerCancel={event => finish(true, event)} onLostPointerCapture={event => finish(true, event)} style={{ touchAction: 'none', cursor: tool === 'move' ? 'move' : 'crosshair', display: 'block', margin: 'auto', width: zoom === 'fit' ? 'auto' : doc.current.width * Number(zoom), height: zoom === 'fit' ? 'auto' : doc.current.height * Number(zoom), maxWidth: zoom === 'fit' ? '100%' : undefined, maxHeight: zoom === 'fit' ? '100%' : undefined, background: 'repeating-conic-gradient(#333 0% 25%, #444 0% 50%) 0 / 20px 20px' }} /></div>
          <fieldset disabled={busy || discard} className="w-64 shrink-0 p-3 border-l border-sf-dark-700 overflow-y-auto space-y-3">
            <div className="flex gap-2"><strong className="text-sm">{tr('layers')}</strong><button className={button} onClick={() => mutate(() => { assertPaintCapacity(doc.current, 1, 1); const item = createPaintLayer(doc.current.width, doc.current.height, `${tr('layer')} ${doc.current.layers.length + 1}`); doc.current.layers.push(item); setActive(item.id); setTarget('pixels') })}>{tr('add')}</button></div>
            <select aria-label={tr('addImage')} className={`${field} w-full`} value="" onChange={e => { const asset = assets.find(a => a.id === e.target.value); if (asset) addImage(asset) }}><option value="">{tr('addImage')}</option>{assets.filter(a => a.type === 'image').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            {firstAsset && <button className={button} onClick={() => addImage(firstAsset)}>{tr('copyFirst')}</button>}
            {[...doc.current.layers].reverse().map(item => <div key={item.id} className={`p-2 rounded border ${item.id === active ? 'border-sf-accent' : 'border-sf-dark-600'}`}><div className="flex gap-2 items-center"><input type="checkbox" aria-label={`${tr('visible')} ${item.name}`} checked={item.visible} onChange={e => mutate(() => { item.visible = e.target.checked })} /><button className="truncate text-xs flex-1 text-left" onClick={() => { setActive(item.id); setTarget('pixels') }}>{item.name}</button></div><div className="flex gap-1 mt-2"><button aria-pressed={active === item.id && target === 'pixels'} className={button} onClick={() => { setActive(item.id); setTarget('pixels') }}>{tr('pixels')}</button>{item.mask && <button aria-pressed={active === item.id && target === 'mask'} className={`${button} ${active === item.id && target === 'mask' ? 'ring-1 ring-sf-accent' : ''}`} onClick={() => { setActive(item.id); setTarget('mask') }}>{tr('mask')}</button>}</div></div>)}
            {layer && <><button className={button} onClick={duplicate}>{tr('duplicate')}</button><input aria-label={tr('layerName')} className={`${field} w-full`} value={layer.name} onChange={e => { layer.name = e.target.value; bump() }} onBlur={commit} /><label className="block text-xs">{tr('layerOpacity')}<input aria-label={tr('layerOpacity')} type="range" min="0" max="1" step="0.01" value={layer.opacity} onChange={e => { layer.opacity = +e.target.value; bump() }} onPointerUp={commit} onKeyUp={commit} /></label><select aria-label={tr('blend')} className={field} value={layer.blend} onChange={e => mutate(() => { layer.blend = e.target.value })}>{['source-over', 'multiply', 'screen', 'lighter'].map(mode => <option key={mode} value={mode}>{tr(mode)}</option>)}</select>
              <div className="flex gap-1">{[-1, 1].map(direction => <button key={direction} className={button} disabled={doc.current.layers.indexOf(layer) + direction < 0 || doc.current.layers.indexOf(layer) + direction >= doc.current.layers.length} onClick={() => mutate(() => { const index = doc.current.layers.indexOf(layer); doc.current.layers.splice(index, 1); doc.current.layers.splice(index + direction, 0, layer) })}>{tr(direction === 1 ? 'up' : 'down')}</button>)}<button className={button} disabled={doc.current.layers.length === 1} onClick={() => mutate(() => { doc.current.layers = doc.current.layers.filter(item => item !== layer); setActive(doc.current.layers.at(-1).id); setTarget('pixels') })}>{tr('remove')}</button></div>
              {!layer.mask ? <button className={button} onClick={() => mutate(() => { assertPaintCapacity(doc.current); layer.mask = createPaintLayer(doc.current.width, doc.current.height, '', '#ffffff').pixels; setTarget('mask') })}>{tr('addMask')}</button> : <><label className="block text-xs"><input type="checkbox" checked={layer.maskEnabled} onChange={e => mutate(() => { layer.maskEnabled = e.target.checked })} /> {tr('enableMask')}</label><button className={button} onClick={() => mutate(() => invertPaintMask(layer.mask))}>{tr('invert')}</button><button className={button} onClick={() => mutate(() => { layer.mask = null; setTarget('pixels') })}>{tr('removeMask')}</button></>}
              {target === 'mask' && layer.mask && <div className="space-y-2 border-t border-sf-dark-600 pt-2"><p className="text-xs">{tr('maskHint')}</p><button className={button} aria-pressed={!reveal} onClick={() => setReveal(false)}>{tr('hide')}</button><button className={button} aria-pressed={reveal} onClick={() => setReveal(true)}>{tr('reveal')}</button><label className="block text-xs"><input type="checkbox" checked={maskView} onChange={e => setMaskView(e.target.checked)} /> {tr('maskView')}</label></div>}
            </>}
          </fieldset>
        </div><footer className="p-2 text-xs text-sf-text-muted">{doc.current.width} × {doc.current.height} · {tr('target')}: {tr(target)} · {tr('limits')}</footer>
      </>}
    </section>
  </div>
  return embedded ? content : createPortal(content, document.body)
}
