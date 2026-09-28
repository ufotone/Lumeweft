import { WORKFLOW_DEPENDENCY_PACKS } from '../config/workflowDependencyPacks'
import { CURATED_NODE_PACKS, getModelInstallInfo } from '../config/workflowInstallCatalog'

const MODEL_EXTENSIONS = new Set([
  '.safetensors', '.ckpt', '.pt', '.pth', '.bin', '.gguf', '.onnx', '.engine', '.tflite',
])

function extensionOf(name = '') {
  const index = String(name).lastIndexOf('.')
  return index >= 0 ? String(name).slice(index).toLowerCase() : ''
}

function normalize(value = '') {
  return String(value).replaceAll('\\', '/').toLowerCase()
}

function basename(value = '') {
  return String(value).replaceAll('\\', '/').split('/').pop() || ''
}

function buildDependencyIndex() {
  const models = new Map()
  const nodes = new Map()

  for (const pack of Object.values(WORKFLOW_DEPENDENCY_PACKS)) {
    for (const model of pack.requiredModels || []) {
      const key = normalize(model.filename)
      if (!key) continue
      if (!models.has(key)) models.set(key, [])
      models.get(key).push({ id: pack.id, name: pack.displayName || pack.id })
    }
    for (const node of pack.requiredNodes || []) {
      const classType = String(node.classType || '').trim()
      if (!classType) continue
      if (!nodes.has(classType)) nodes.set(classType, [])
      nodes.get(classType).push({ id: pack.id, name: pack.displayName || pack.id })
    }
  }

  return { models, nodes }
}

const DEPENDENCIES = buildDependencyIndex()

async function walkFiles(api, rootPath, relativeBase = '') {
  const result = await api.listDirectory(rootPath, { includeStats: true })
  if (!result?.success) throw new Error(result?.error || `Could not scan ${rootPath}`)
  const files = []
  for (const item of result.items || []) {
    const relativePath = relativeBase ? `${relativeBase}/${item.name}` : item.name
    if (item.isDirectory) files.push(...await walkFiles(api, item.path, relativePath))
    else if (item.isFile) files.push({ ...item, relativePath })
  }
  return files
}

async function directorySize(api, rootPath) {
  const files = await walkFiles(api, rootPath)
  return files.reduce((total, file) => total + (Number(file.size) || 0), 0)
}

function modelKind(relativePath = '') {
  const folder = normalize(relativePath).split('/')[0] || 'models'
  const labels = {
    checkpoints: 'Checkpoint', diffusion_models: 'Diffusion model', unet: 'Diffusion model',
    loras: 'LoRA', vae: 'VAE', text_encoders: 'Text encoder', clip: 'Text encoder',
    upscale_models: 'Upscaler', controlnet: 'ControlNet', embeddings: 'Embedding',
  }
  return labels[folder] || folder
}

export async function scanComfyStorage({ comfyRootPath, savedSources = {}, api = window.electronAPI } = {}) {
  const root = String(comfyRootPath || '').trim()
  if (!root) throw new Error('ComfyUI folder is not configured.')
  const modelsRoot = await api.pathJoin(root, 'models')
  const customNodesRoot = await api.pathJoin(root, 'custom_nodes')
  const items = []

  if (await api.exists(modelsRoot)) {
    for (const file of await walkFiles(api, modelsRoot)) {
      if (!MODEL_EXTENSIONS.has(extensionOf(file.name))) continue
      const usages = DEPENDENCIES.models.get(normalize(file.name)) || []
      const targetSubdir = String(file.relativePath).replaceAll('\\', '/').split('/')[0] || ''
      const recipe = getModelInstallInfo({ filename: file.name, targetSubdir })
      const savedSource = savedSources[normalize(file.name)] || null
      items.push({
        id: `model:${normalize(file.path)}`,
        type: 'model', kind: modelKind(file.relativePath), name: file.name,
        path: file.path, relativePath: file.relativePath, size: Number(file.size) || 0,
        modified: file.modified || '', usages,
        availability: savedSource?.sourceUrl || recipe.downloadUrl ? 'known' : 'unknown',
        sourceUrl: savedSource?.sourceUrl || recipe.sourceUrl || recipe.downloadUrl || '',
        downloadUrl: savedSource?.downloadUrl || recipe.downloadUrl || '',
      })
    }
  }

  if (await api.exists(customNodesRoot)) {
    const result = await api.listDirectory(customNodesRoot, { includeStats: true })
    if (!result?.success) throw new Error(result?.error || 'Could not scan custom nodes.')
    for (const entry of result.items || []) {
      if (!entry.isDirectory || entry.name.startsWith('.') || entry.name === '__pycache__') continue
      const curated = CURATED_NODE_PACKS.find((pack) => normalize(pack.installDirName) === normalize(entry.name))
      const usages = curated
        ? Array.from(new Map(curated.classTypes.flatMap((classType) => DEPENDENCIES.nodes.get(classType) || []).map((use) => [use.id, use])).values())
        : []
      items.push({
        id: `node:${normalize(entry.path)}`,
        type: 'node', kind: 'Custom node', name: entry.name, path: entry.path,
        relativePath: entry.name, size: await directorySize(api, entry.path),
        modified: entry.modified || '', usages,
        availability: curated?.repoUrl ? 'known' : 'unknown', sourceUrl: curated?.repoUrl || '',
      })
    }
  }

  return items.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name))
}

export async function findModelSourceCandidates(item, api = window.electronAPI) {
  if (item?.type !== 'model') throw new Error('Online source search is available for model files.')
  const result = await api?.searchComfyModelSources?.({ filename: item.name, kind: item.kind })
  if (!result?.success) throw new Error(result?.error || 'Online source search failed.')
  return result
}

export function storageSourceKey(filename = '') {
  return normalize(basename(filename))
}

export function createManualModelSourceCandidate(value = '') {
  const input = String(value || '').trim()
  let url
  try { url = new URL(input) } catch { throw new Error('有効な配布URLを入力してください。') }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('認証情報を含まないHTTPSの配布URLを入力してください。')
  }
  const hostname = url.hostname.toLowerCase()
  const provider = hostname === 'huggingface.co' || hostname.endsWith('.huggingface.co')
    ? 'huggingface'
    : (hostname === 'civitai.com' || hostname.endsWith('.civitai.com') || hostname === 'civitai.red' || hostname.endsWith('.civitai.red'))
      ? 'civitai'
      : 'manual'
  let downloadUrl = ''
  if (provider === 'huggingface' && url.pathname.includes('/blob/')) {
    const direct = new URL(url.toString())
    direct.pathname = direct.pathname.replace('/blob/', '/resolve/')
    downloadUrl = direct.toString()
  } else if (provider === 'huggingface' && url.pathname.includes('/resolve/')) {
    downloadUrl = url.toString()
  } else if (provider === 'civitai' && /^\/api\/download\/models\/\d+/.test(url.pathname)) {
    downloadUrl = url.toString()
  }
  return {
    provider,
    title: provider === 'manual' ? url.hostname : (provider === 'civitai' ? 'Civitai（手動登録）' : 'Hugging Face（手動登録）'),
    filename: '', sourceUrl: url.toString(), downloadUrl, score: null, manual: true,
  }
}

export async function retireComfyItems(items, destinationRoot, api = window.electronAPI) {
  const root = String(destinationRoot || '').trim()
  if (!root) throw new Error('Choose a retirement destination.')
  const moved = []
  for (const item of items) {
    const category = item.type === 'node' ? 'custom_nodes' : 'models'
    const destination = await api.pathJoin(root, category, item.relativePath)
    if (await api.exists(destination)) throw new Error(`Destination already exists: ${destination}`)
    let result
    if (item.type === 'node') {
      result = await api.copyDirectory(item.path, destination)
      if (result?.success) {
        const copiedSize = await directorySize(api, destination)
        if (copiedSize !== item.size) {
          throw new Error(`Copy verification failed for ${item.name}: expected ${item.size} bytes, found ${copiedSize}. The original was kept.`)
        }
        result = await api.trashItem(item.path)
      }
    } else {
      result = await api.moveFile(item.path, destination)
    }
    if (!result?.success) throw new Error(result?.error || `Could not retire ${item.name}`)
    moved.push({ ...item, destination })
  }
  return moved
}

export async function trashComfyItems(items, api = window.electronAPI) {
  const removed = []
  for (const item of items) {
    const result = await api.trashItem(item.path)
    if (!result?.success) throw new Error(result?.error || `Could not move ${item.name} to trash.`)
    removed.push(item)
  }
  return removed
}

export function formatStorageBytes(value = 0) {
  const bytes = Number(value) || 0
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let amount = bytes
  let unit = -1
  do { amount /= 1024; unit += 1 } while (amount >= 1024 && unit < units.length - 1)
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unit]}`
}
