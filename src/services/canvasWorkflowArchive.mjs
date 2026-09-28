export function createCanvasArchive(document, date = new Date()) {
  const pad = (n, width = 2) => String(n).padStart(width, '0')
  const stamp = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}-${pad(date.getMilliseconds(), 3)}`
  const name = String(document.name || 'Flow').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').slice(0, 100)
  const clean = JSON.parse(JSON.stringify(document))
  clean.nodes = clean.nodes.map((node) => ({ ...node, selected: false, data: Object.fromEntries(Object.entries(node.data || {}).filter(([key]) => !key.startsWith('_'))) }))
  return { kind: 'lumeweft-canvas', schemaVersion: 1, savedAt: date.toISOString(), filename: `CANVAS_${name}_${stamp}.canvas.json`, document: clean }
}

export function readCanvasArchive(value) {
  const archive = typeof value === 'string' ? JSON.parse(value) : value
  if (archive?.kind !== 'lumeweft-canvas' || archive.schemaVersion !== 1 || !Array.isArray(archive.document?.nodes) || !Array.isArray(archive.document?.edges)) {
    throw new Error('CANVAS専用のフローファイルを選択してください。ComfyUIのワークフローは読み込めません。')
  }
  const document = JSON.parse(JSON.stringify(archive.document))
  const ids = new Set()
  for (const node of document.nodes) {
    if (!node?.id || ids.has(node.id) || typeof node.type !== 'string' || !Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) throw new Error('CANVASのノード情報が不正です。')
    ids.add(node.id)
    node.data = Object.fromEntries(Object.entries(node.data || {}).filter(([key]) => !key.startsWith('_')))
    Object.assign(node.data, { status: 'idle', error: '', statusMessage: '' })
  }
  if (document.edges.some((edge) => !ids.has(edge.source) || !ids.has(edge.target))) throw new Error('CANVASの接続情報が不正です。')
  return document
}
