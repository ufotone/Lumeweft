export const PAINT_VERSION = 1
export const PAINT_MAX_LAYERS = 16
export const PAINT_MAX_PIXELS = 64 * 1024 * 1024
export const PAINT_BLEND_MODES = ['source-over', 'multiply', 'screen', 'lighter']
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/

export function paintDimensions(width, height) {
  const w = Number(width), h = Number(height)
  if (![w, h].every(n => Number.isInteger(n) && n >= 16 && n <= 4096)) {
    throw new Error('画像サイズは16〜4096pxの整数にしてください。 / Image dimensions must be integers from 16 to 4096.')
  }
  return { width: w, height: h }
}

export function validatePaintDocument(value) {
  if (!value || value.kind !== 'lumeweft-paint' || value.version !== PAINT_VERSION) throw new Error('未対応のペイントデータです。 / Unsupported paint document.')
  const { width, height } = paintDimensions(value.width, value.height)
  if (!Array.isArray(value.layers) || !value.layers.length || value.layers.length > PAINT_MAX_LAYERS) throw new Error('レイヤー数が不正です。 / Invalid layer count.')
  const ids = new Set()
  let planes = 0
  const layers = value.layers.map(layer => {
    if (!layer || typeof layer.id !== 'string' || !layer.id || ids.has(layer.id)) throw new Error('レイヤーIDが不正です。 / Invalid layer ID.')
    ids.add(layer.id)
    if (!PNG.test(layer.pixels || '') || (layer.mask != null && !PNG.test(layer.mask))) throw new Error('レイヤー画像が不正です。 / Invalid layer image.')
    if (!Number.isFinite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1 || !PAINT_BLEND_MODES.includes(layer.blend)) throw new Error('レイヤー設定が不正です。 / Invalid layer settings.')
    planes += layer.mask ? 2 : 1
    return { id: layer.id, name: String(layer.name || 'Layer').slice(0, 120), visible: layer.visible !== false,
      opacity: layer.opacity, blend: layer.blend, pixels: layer.pixels, mask: layer.mask || null, maskEnabled: layer.maskEnabled !== false }
  })
  if (planes * width * height > PAINT_MAX_PIXELS) throw new Error('レイヤーのメモリ上限を超えています。 / Paint layer memory limit exceeded.')
  return { kind: 'lumeweft-paint', version: PAINT_VERSION, width, height, name: String(value.name || 'Paint').slice(0, 120), layers }
}

export function isPaintSidecarPath(path) {
  return typeof path === 'string' && /^assets\/paint\/[a-zA-Z0-9_-]+\.lumeweft-paint\.json$/.test(path)
}

export function createPaintHistory(initial, maxBytes = 48 * 1024 * 1024) {
  const states = [initial]
  let index = 0
  return {
    push(state) {
      if (JSON.stringify(states[index]) === JSON.stringify(state)) return false
      states.splice(index + 1)
      states.push(state)
      while (states.length > 1 && (states.length > 21 || states.reduce((sum, s) => sum + JSON.stringify(s).length * 2, 0) > maxBytes)) states.shift()
      index = states.length - 1
      return true
    },
    undo() { if (index > 0) return states[--index]; return null },
    redo() { if (index < states.length - 1) return states[++index]; return null },
    get canUndo() { return index > 0 },
    get canRedo() { return index < states.length - 1 },
  }
}

export function makePaintCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = height
  return canvas
}

export async function loadPaintImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('画像を読み込めませんでした。 / Could not load image.'))
    image.src = url
  })
}

const newId = () => `layer_${crypto.randomUUID()}`
export function createPaintLayer(width, height, name, fill = null) {
  const pixels = makePaintCanvas(width, height)
  if (fill) { const ctx = pixels.getContext('2d'); ctx.fillStyle = fill; ctx.fillRect(0, 0, width, height) }
  return { id: newId(), name, pixels, mask: null, maskEnabled: true, visible: true, opacity: 1, blend: 'source-over' }
}

export function assertPaintCapacity(doc, extraPlanes = 1, extraLayers = 0) {
  const planes = doc.layers.reduce((sum, layer) => sum + (layer.mask ? 2 : 1), 0)
  if (doc.layers.length + extraLayers > PAINT_MAX_LAYERS || (planes + extraPlanes) * doc.width * doc.height > PAINT_MAX_PIXELS) {
    throw new Error('レイヤー上限です。不要なレイヤーを削除するか、小さい画像で作成してください。 / Layer limit reached. Remove a layer or use a smaller canvas.')
  }
}

export function serializePaint(doc) {
  return { kind: 'lumeweft-paint', version: PAINT_VERSION, width: doc.width, height: doc.height, name: doc.name,
    layers: doc.layers.map(layer => ({ id: layer.id, name: layer.name, visible: layer.visible, opacity: layer.opacity,
      blend: layer.blend, maskEnabled: layer.maskEnabled,
      pixels: layer.pixels.toDataURL('image/png'), mask: layer.mask?.toDataURL('image/png') || null })) }
}

export async function deserializePaint(value) {
  const source = validatePaintDocument(value)
  const layers = []
  for (const layer of source.layers) {
    const decode = async url => {
      const image = await loadPaintImage(url)
      if (image.naturalWidth !== source.width || image.naturalHeight !== source.height) throw new Error('レイヤーのサイズが一致しません。 / Layer dimensions do not match.')
      const canvas = makePaintCanvas(source.width, source.height)
      canvas.getContext('2d').drawImage(image, 0, 0)
      return canvas
    }
    layers.push({ ...layer, pixels: await decode(layer.pixels), mask: layer.mask ? await decode(layer.mask) : null })
  }
  return { ...source, layers }
}

// Masks are white RGB with alpha representing visibility. The UI shows them
// over black: white reveals, black conceals, grey is partial visibility.
const compositingBuffers = new WeakMap()
export function compositePaint(doc, output = makePaintCanvas(doc.width, doc.height)) {
  const ctx = output.getContext('2d')
  ctx.clearRect(0, 0, output.width, output.height)
  let scratch = compositingBuffers.get(output)
  if (!scratch || scratch.width !== doc.width || scratch.height !== doc.height) {
    scratch = makePaintCanvas(doc.width, doc.height)
    compositingBuffers.set(output, scratch)
  }
  const sc = scratch.getContext('2d')
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity === 0) continue
    sc.clearRect(0, 0, doc.width, doc.height)
    sc.globalCompositeOperation = 'source-over'
    sc.drawImage(layer.pixels, 0, 0)
    if (layer.mask && layer.maskEnabled) {
      sc.globalCompositeOperation = 'destination-in'
      sc.drawImage(layer.mask, 0, 0)
    }
    ctx.globalAlpha = layer.opacity
    ctx.globalCompositeOperation = layer.blend
    ctx.drawImage(scratch, 0, 0)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  return output
}

export function invertPaintMask(mask) {
  const ctx = mask.getContext('2d')
  const image = ctx.getImageData(0, 0, mask.width, mask.height)
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = image.data[i + 1] = image.data[i + 2] = 255
    image.data[i + 3] = 255 - image.data[i + 3]
  }
  ctx.putImageData(image, 0, 0)
}

// One pointer gesture is one coverage shape. Opacity is applied only when
// compositing that shape over the pre-stroke pixels, never per input sample.
export function beginPaintStroke(canvas, first, { size, opacity, color, erase = false }, backup = null) {
  const base = backup || makePaintCanvas(canvas.width, canvas.height)
  if (!backup) base.getContext('2d').drawImage(canvas, 0, 0)
  const coverage = makePaintCanvas(canvas.width, canvas.height)
  const points = [{ x: first.x, y: first.y }]
  const restore = () => {
    const ctx = canvas.getContext('2d')
    ctx.save(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(base, 0, 0); ctx.restore()
  }
  return {
    append(point) {
      const last = points.at(-1)
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
      if (point.x !== last.x || point.y !== last.y) points.push({ x: point.x, y: point.y })
    },
    render() {
      const ctx = coverage.getContext('2d')
      ctx.clearRect(0, 0, coverage.width, coverage.height)
      ctx.fillStyle = ctx.strokeStyle = color
      ctx.lineWidth = size; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      if (points.length === 1) {
        ctx.arc(first.x, first.y, size / 2, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.moveTo(points[0].x, points[0].y)
        // Midpoint quadratic interpolation rounds sample corners without
        // introducing a delayed cursor or overshooting the sampled path.
        for (let i = 1; i < points.length - 1; i++) {
          const p = points[i], next = points[i + 1]
          ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2)
        }
        const last = points.at(-1)
        ctx.lineTo(last.x, last.y); ctx.stroke()
      }
      restore()
      const dest = canvas.getContext('2d')
      dest.save(); dest.globalAlpha = opacity
      dest.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
      dest.drawImage(coverage, 0, 0); dest.restore()
    },
    cancel: restore,
  }
}

// Convenience for a complete two-point gesture (not successive samples).
export function paintStroke(canvas, from, to, options) {
  const stroke = beginPaintStroke(canvas, from, options)
  stroke.append(to); stroke.render()
}

export async function paintPngBlob(canvas) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('PNGを作成できませんでした。 / Could not create PNG.')
  return blob
}
