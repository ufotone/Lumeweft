export const NUMBERED_REFERENCE_MAX = 5
export const NUMBERED_REFERENCE_SHEET_SIZE = 1024

export function planNumberedReferenceSheets(items = []) {
  const normalized = (Array.isArray(items) ? items : [])
    .filter(item => item?.file && Number.isInteger(Number(item?.referenceNumber)))
    .slice(0, NUMBERED_REFERENCE_MAX)
  return [normalized.slice(0, 3), normalized.slice(3, 5)].filter(group => group.length > 0)
}

export function getNumberedReferenceSheetLayout(itemCount, size = NUMBERED_REFERENCE_SHEET_SIZE) {
  const count = Math.max(1, Math.min(3, Math.floor(Number(itemCount) || 1)))
  const sheetSize = Math.max(512, Math.floor(Number(size) || NUMBERED_REFERENCE_SHEET_SIZE))
  const columns = count === 1 ? 1 : 2
  const rows = count <= 2 ? 1 : 2
  return {
    count,
    columns,
    rows,
    width: sheetSize,
    height: sheetSize,
    cellWidth: sheetSize / columns,
    cellHeight: sheetSize / rows,
  }
}

function getContainedRect(imageWidth, imageHeight, bounds) {
  const width = Math.max(1, Number(imageWidth) || 1)
  const height = Math.max(1, Number(imageHeight) || 1)
  const scale = Math.min(bounds.width / width, bounds.height / height)
  const drawWidth = Math.max(1, Math.round(width * scale))
  const drawHeight = Math.max(1, Math.round(height * scale))
  return {
    x: Math.round(bounds.x + (bounds.width - drawWidth) / 2),
    y: Math.round(bounds.y + (bounds.height - drawHeight) / 2),
    width: drawWidth,
    height: drawHeight,
  }
}

export async function createNumberedReferenceSheet(items = [], options = {}) {
  if (typeof document === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('Numbered reference sheets require the CANVAS browser renderer.')
  }
  const entries = (Array.isArray(items) ? items : []).filter(item => item?.file).slice(0, 3)
  if (entries.length === 0) throw new Error('No character references were supplied for the numbered sheet.')

  const layout = getNumberedReferenceSheetLayout(entries.length, options.size)
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the numbered reference sheet canvas.')

  context.fillStyle = '#15171c'
  context.fillRect(0, 0, layout.width, layout.height)
  const bitmaps = []
  try {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index]
      const bitmap = await createImageBitmap(entry.file)
      bitmaps.push(bitmap)
      const column = index % layout.columns
      const row = Math.floor(index / layout.columns)
      const cellX = column * layout.cellWidth
      const cellY = row * layout.cellHeight
      const labelHeight = Math.max(64, Math.round(layout.height * 0.075))
      const padding = 18
      const rect = getContainedRect(bitmap.width, bitmap.height, {
        x: cellX + padding,
        y: cellY + labelHeight + padding,
        width: layout.cellWidth - padding * 2,
        height: layout.cellHeight - labelHeight - padding * 2,
      })

      context.fillStyle = '#ffffff'
      context.fillRect(cellX + 6, cellY + 6, layout.cellWidth - 12, layout.cellHeight - 12)
      context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height)
      context.fillStyle = '#090a0d'
      context.fillRect(cellX + 6, cellY + 6, layout.cellWidth - 12, labelHeight)
      context.fillStyle = '#ffffff'
      context.font = `700 ${Math.max(34, Math.round(labelHeight * 0.62))}px system-ui, sans-serif`
      context.textBaseline = 'middle'
      context.fillText(`REFERENCE ${entry.referenceNumber}`, cellX + 24, cellY + 6 + labelHeight / 2)
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new Error('Could not encode the numbered reference sheet.')
    const first = entries[0].referenceNumber
    const last = entries[entries.length - 1].referenceNumber
    return new File([blob], `canvas_character_references_${first}-${last}.png`, { type: 'image/png' })
  } finally {
    bitmaps.forEach(bitmap => bitmap.close?.())
  }
}
