import { useEffect, useRef, useState } from 'react'

// Painting stays in Lumeweft. Saving creates a new project asset so prior takes
// and undo snapshots retain their original keyframes.
export default function FluidKeyframePainter({ sourceUrl, firstFrameUrl, width = 512, height = 512, onSave, t }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const undo = useRef([])
  const [undoCount, setUndoCount] = useState(0)
  const [color, setColor] = useState('#a3a3a3')
  const [brushSize, setBrushSize] = useState(28)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [error, setError] = useState('')
  const [copyFirst, setCopyFirst] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    let cancelled = false
    context.fillStyle = '#000000'
    context.fillRect(0, 0, width, height)
    undo.current = []
    setUndoCount(0)
    setDirty(false)
    setError('')
    const url = copyFirst ? firstFrameUrl : sourceUrl
    if (!url) { setLoading(false); return }
    setLoading(true)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      if (cancelled) return
      context.drawImage(image, 0, 0, width, height)
      setLoading(false)
      setDirty(copyFirst)
    }
    image.onerror = () => {
      if (cancelled) return
      setLoading(false)
      setError(t('canvas.fluid.imageError'))
    }
    image.src = url
    return () => { cancelled = true }
  }, [sourceUrl, firstFrameUrl, copyFirst, width, height, t])

  const remember = () => {
    const canvas = canvasRef.current
    undo.current.push(canvas.getContext('2d').getImageData(0, 0, width, height))
    if (undo.current.length > 8) undo.current.shift()
    setUndoCount(undo.current.length)
  }
  const position = event => {
    const rect = canvasRef.current.getBoundingClientRect()
    return [(event.clientX - rect.left) * width / rect.width, (event.clientY - rect.top) * height / rect.height]
  }
  const start = event => {
    if (busy || loading || error || event.button !== 0) return
    event.preventDefault()
    remember()
    drawing.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    const ctx = canvasRef.current.getContext('2d')
    const [x, y] = position(event)
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y)
    setDirty(true)
  }
  const move = event => {
    if (!drawing.current) return
    const context = canvasRef.current.getContext('2d')
    context.lineTo(...position(event))
    context.stroke()
  }
  const save = async () => {
    setBusy(true)
    setError('')
    try {
      const blob = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error(t('canvas.fluid.saveError'))
      await onSave(new File([blob], 'fluid-keyframe.png', { type: 'image/png' }))
      setCopyFirst(false)
      setDirty(false)
    } catch (err) { setError(err?.message || t('canvas.fluid.saveError')) }
    finally { setBusy(false) }
  }
  const buttonClass = 'rounded-lg border border-sf-dark-600 px-3 py-2 text-xs disabled:opacity-40'
  return (
    <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-sf-dark-900 p-3">
      <p className="text-sm font-medium">{t('canvas.fluid.paint')}</p>
      <p className="text-xs text-sf-text-secondary">{t('canvas.fluid.paintHelp')}</p>
      <fieldset disabled={busy || loading} className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {['#000000', '#a3a3a3', '#ffffff', '#ff7b00', '#ffe45c'].map(value => (
            <button key={value} type="button" aria-label={`${t('canvas.fluid.color')} ${value}`} aria-pressed={color === value}
              onClick={() => setColor(value)} className={`h-7 w-7 rounded-full border-2 ${color === value ? 'border-cyan-300' : 'border-sf-dark-600'}`} style={{ backgroundColor: value }} />
          ))}
          <input aria-label={t('canvas.fluid.color')} type="color" value={color} onChange={event => setColor(event.target.value)} className="h-7 w-8" />
        </div>
        <label className="flex items-center gap-2 text-xs">{t('canvas.fluid.brush')}
          <input type="range" min="2" max="120" value={brushSize} onChange={event => setBrushSize(Number(event.target.value))} className="min-w-0 flex-1" />{brushSize}
        </label>
        <canvas ref={canvasRef} width={width} height={height} aria-label={t('canvas.fluid.paint')}
          className="w-full rounded-lg border border-sf-dark-600 bg-black" style={{ touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false }}
          onPointerCancel={() => { drawing.current = false }} onLostPointerCapture={() => { drawing.current = false }} />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} disabled={!undoCount} onClick={() => {
            canvasRef.current.getContext('2d').putImageData(undo.current.pop(), 0, 0)
            setUndoCount(undo.current.length)
            setDirty(true)
          }}>{t('canvas.fluid.undo')}</button>
          <button type="button" className={buttonClass} onClick={() => {
            remember()
            const ctx = canvasRef.current.getContext('2d')
            ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, width, height)
            setDirty(true)
            setError('')
          }}>{t('canvas.fluid.clear')}</button>
          {firstFrameUrl && !copyFirst && <button type="button" className={buttonClass} onClick={() => setCopyFirst(true)}>{t('canvas.fluid.copyFirst')}</button>}
          <button type="button" className={`${buttonClass} bg-cyan-500/15 text-cyan-200`} disabled={!dirty} onClick={save}>{t(busy ? 'canvas.fluid.saving' : 'canvas.fluid.save')}</button>
        </div>
      </fieldset>
      {dirty && <p className="text-xs text-amber-200">{t('canvas.fluid.unsaved')}</p>}
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  )
}
