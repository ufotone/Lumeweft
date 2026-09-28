export const GENERATION_ARTIFACT_VERSION = 1

const ARTIFACT_CONFIG = Object.freeze({
  canvas: { extension: 'json', filterName: 'CANVAS Flow' },
  recipe: {
    format: 'lumeweft-generation-recipe',
    extension: 'lwrecipe',
    filterName: 'Lumeweft Generation Recipe',
  },
  history: {
    format: 'lumeweft-generation-history',
    extension: 'lwhistory',
    filterName: 'Lumeweft Generation History',
  },
  version: {
    format: 'lumeweft-generation-version',
    extension: 'lwversion',
    filterName: 'Lumeweft Generation Version',
  },
})

export function safeArtifactFilename(value, fallback = 'lumeweft-generation') {
  const cleaned = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')
  return (cleaned || fallback).slice(0, 120)
}

export function buildGenerationArtifact(kind, data, exportedAt = new Date().toISOString()) {
  const config = ARTIFACT_CONFIG[kind]
  if (!config) throw new Error(`Unsupported generation artifact kind: ${kind}`)
  return {
    format: config.format,
    version: GENERATION_ARTIFACT_VERSION,
    exportedAt,
    data: JSON.parse(JSON.stringify(data ?? null)),
  }
}

export async function exportGenerationArtifact({ kind, title, data }) {
  const config = ARTIFACT_CONFIG[kind]
  if (!config) throw new Error(`Unsupported generation artifact kind: ${kind}`)
  const filename = kind === 'canvas' ? data.filename : `${safeArtifactFilename(title)}.${config.extension}`
  const json = `${JSON.stringify(kind === 'canvas' ? data : buildGenerationArtifact(kind, data), null, 2)}\n`
  const api = typeof window !== 'undefined' ? window.electronAPI : null

  if (api?.saveFileDialog && api?.writeFile) {
    const filePath = await api.saveFileDialog({
      title: `Save ${config.filterName}`,
      defaultPath: filename,
      filters: [
        { name: config.filterName, extensions: [config.extension] },
        { name: 'JSON', extensions: ['json'] },
      ],
    })
    if (!filePath) return { success: false, cancelled: true }
    const result = await api.writeFile(filePath, json, { encoding: 'utf8' })
    if (!result?.success) throw new Error(result?.error || 'Could not save the generation artifact.')
    return { success: true, filePath }
  }

  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
  return { success: true, filePath: filename }
}
