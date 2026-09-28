export function makeTextAssetFile(text, name = 'text') {
  if (!String(text || '').trim()) throw new Error('書き出すテキストがありません。文章を出力するノードを接続してください。')
  let basename = String(name || 'text').replace(/\.(txt|md)$/i, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').slice(0, 120) || 'text'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(basename)) basename = `text_${basename}`
  return new File([String(text)], `${basename}.txt`, { type: 'text/plain;charset=utf-8' })
}

export async function saveCanvasTextAsset({ text, name, folderName, projectHandle, documentId, nodeId, importAsset, addAsset, ensureFolder }) {
  if (!projectHandle) throw new Error('プロジェクトを開いてください。')
  const file = makeTextAssetFile(text, name)
  const info = await importAsset(projectHandle, file, 'text')
  const folderId = ensureFolder(['CANVAS', String(folderName || 'Texts').trim() || 'Texts'])
  return addAsset({ ...info, type: 'text', textContent: String(text), folderId, isImported: true,
    flowAi: { documentId, nodeId, importedAt: new Date().toISOString(), runtime: 'local' } })
}
