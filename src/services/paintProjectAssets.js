import { importAsset, readProjectFile, getProjectFileUrl, getAbsoluteFileUrl } from './fileSystem'
import { isPaintSidecarPath, validatePaintDocument } from './layeredPaint.mjs'

export async function readPaintDocument(projectHandle, asset) {
  const reference = asset?.settings?.paintDocument
  if (!reference) return null
  if (!isPaintSidecarPath(reference.path)) throw new Error('ペイントデータの保存先が不正です。 / Invalid paint document path.')
  const file = await readProjectFile(projectHandle, reference.path)
  const text = typeof file.text === 'function' ? await file.text() : await new Blob([file.data]).text()
  if (text.length > 64 * 1024 * 1024) throw new Error('ペイントデータが大きすぎます。 / Paint document is too large.')
  return validatePaintDocument(JSON.parse(text))
}

export async function paintAssetUrl(projectHandle, asset) {
  // Prefer the project-relative path after a project has moved/reopened.
  if (asset?.path && projectHandle && !/^(?:[a-z]+:|\/|\\)/i.test(asset.path) && !asset.path.split(/[\\/]/).includes('..')) {
    try { return await getProjectFileUrl(projectHandle, asset.path) } catch (_) { /* URL/legacy fallback */ }
  }
  if (asset?.absolutePath) return getAbsoluteFileUrl(asset.absolutePath)
  if (asset?.url) return asset.url
  throw new Error('元の画像が見つかりません。 / Source image is unavailable.')
}

// Save immutable pairs. Register only after both writes succeed: the original
// asset and sidecar remain valid for earlier generations and project undo.
export async function savePaintAsset({ projectHandle, document, png, name, folderId = null, sourceAssetId = null }, io = {}) {
  if (!projectHandle) throw new Error('プロジェクトを開いてください。 / Open a project first.')
  const value = validatePaintDocument(document)
  const json = JSON.stringify(value)
  if (json.length > 64 * 1024 * 1024) throw new Error('ペイントデータが大きすぎます。 / Paint document is too large.')
  const importer = io.importAsset || importAsset
  const token = `paint_${crypto.randomUUID()}`
  const sidecar = await importer(projectHandle, new File([json], `${token}.lumeweft-paint.json`, { type: 'application/json' }), 'paint')
  if (!isPaintSidecarPath(sidecar.path)) throw new Error('ペイントデータを保存できませんでした。 / Invalid saved paint path.')
  const image = await importer(projectHandle, new File([png], `${token}.png`, { type: 'image/png' }), 'images', { subfolderSegments: ['Paint'] })
  const url = image.absolutePath ? await (io.getAbsoluteFileUrl || getAbsoluteFileUrl)(image.absolutePath) : URL.createObjectURL(png)
  return { ...image, name: String(name || value.name || 'Paint').trim().slice(0, 120) || 'Paint', type: 'image', url, folderId,
    width: value.width, height: value.height, isImported: true,
    settings: { ...(image.settings || {}), paintDocument: { version: 1, path: sidecar.path }, paintSourceAssetId: sourceAssetId } }
}
