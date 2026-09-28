export const CHARACTER_REFERENCE_CELL_SIZE = 512
export const CHARACTER_REFERENCE_MAX_COLUMNS = 4

export function getCharacterReferenceSheetLayout(imageCount, options = {}) {
  const count = Math.max(0, Math.floor(Number(imageCount) || 0))
  const cellSize = Math.max(64, Math.floor(Number(options.cellSize) || CHARACTER_REFERENCE_CELL_SIZE))
  const maxColumns = Math.max(1, Math.floor(Number(options.maxColumns) || CHARACTER_REFERENCE_MAX_COLUMNS))
  const columns = count > 0 ? Math.min(maxColumns, count) : 1
  const rows = Math.max(1, Math.ceil(count / columns))
  return {
    count,
    columns,
    rows,
    cellSize,
    width: columns * cellSize,
    height: rows * cellSize,
  }
}

export function getContainedImageRect(imageWidth, imageHeight, cellX, cellY, cellSize, padding = 12) {
  const width = Math.max(1, Number(imageWidth) || 1)
  const height = Math.max(1, Number(imageHeight) || 1)
  const inset = Math.max(0, Math.min(cellSize / 3, Number(padding) || 0))
  const available = Math.max(1, cellSize - inset * 2)
  const scale = Math.min(available / width, available / height)
  const drawWidth = Math.max(1, Math.round(width * scale))
  const drawHeight = Math.max(1, Math.round(height * scale))
  return {
    x: Math.round(cellX + (cellSize - drawWidth) / 2),
    y: Math.round(cellY + (cellSize - drawHeight) / 2),
    width: drawWidth,
    height: drawHeight,
  }
}
