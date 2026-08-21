const MODEL_INPUT_KEYS = new Set([
  'ckpt_name',
  'unet_name',
  'lora_name',
  'vae_name',
  'clip_name',
  'control_net_name',
  'controlnet_name',
  'style_model_name',
  'gligen_name',
])

const ROLE_TOKENS = ['high', 'low', 'i2v', 't2v', 'fl2v', 'v2v']
const GENERIC_TOKENS = new Set(['safetensors', 'ckpt', 'pt', 'pth', 'bin', 'model'])

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}))
}

function basename(value) {
  return String(value || '').replace(/\\/g, '/').split('/').pop().toLowerCase()
}

function normalizedStem(value) {
  return basename(value).replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '')
}

function tokens(value) {
  return new Set(
    basename(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token && !GENERIC_TOKENS.has(token))
  )
}

function similarity(left, right) {
  const a = tokens(left)
  const b = tokens(right)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return (2 * shared) / (a.size + b.size)
}

function preservesRoles(source, candidate) {
  const sourceTokens = tokens(source)
  const candidateTokens = tokens(candidate)
  return ROLE_TOKENS.every((role) => !sourceTokens.has(role) || candidateTokens.has(role))
}

function getChoices(nodeSchema, inputName) {
  const spec = nodeSchema?.input?.required?.[inputName] || nodeSchema?.input?.optional?.[inputName]
  return Array.isArray(spec?.[0]) ? spec[0].filter((value) => typeof value === 'string') : []
}

function findReplacement(currentValue, choices) {
  const current = String(currentValue || '').trim()
  if (!current || choices.includes(current)) return null

  const sameBasename = choices.filter((choice) => basename(choice) === basename(current))
  if (sameBasename.length === 1) return { value: sameBasename[0], confidence: 'basename', score: 1 }

  const sameNormalizedName = choices.filter((choice) => normalizedStem(choice) === normalizedStem(current))
  if (sameNormalizedName.length === 1) return { value: sameNormalizedName[0], confidence: 'normalized-name', score: 0.99 }

  const ranked = choices
    .filter((choice) => preservesRoles(current, choice))
    .map((choice) => ({ value: choice, score: similarity(current, choice) }))
    .sort((left, right) => right.score - left.score)
  const best = ranked[0]
  const next = ranked[1]
  if (best && best.score >= 0.55 && (!next || best.score - next.score >= 0.12)) {
    return { ...best, confidence: 'unique-similar-name' }
  }
  return null
}

export function repairApiWorkflowModels(apiWorkflow = {}, objectInfo = {}) {
  const repairedWorkflow = clone(apiWorkflow)
  const replacements = []
  const unresolved = []
  const missingNodes = []

  for (const [nodeId, node] of Object.entries(repairedWorkflow)) {
    const classType = String(node?.class_type || '')
    const nodeSchema = objectInfo?.[classType]
    if (!nodeSchema) {
      missingNodes.push({ nodeId, classType })
      continue
    }
    for (const [inputName, currentValue] of Object.entries(node?.inputs || {})) {
      if (!MODEL_INPUT_KEYS.has(inputName) || typeof currentValue !== 'string') continue
      const choices = getChoices(nodeSchema, inputName)
      if (choices.length === 0 || choices.includes(currentValue)) continue
      const replacement = findReplacement(currentValue, choices)
      if (!replacement) {
        unresolved.push({ nodeId, classType, inputName, currentValue, candidateCount: choices.length })
        continue
      }
      node.inputs[inputName] = replacement.value
      replacements.push({
        nodeId,
        classType,
        inputName,
        from: currentValue,
        to: replacement.value,
        confidence: replacement.confidence,
        score: replacement.score,
      })
    }
  }

  return { repairedWorkflow, replacements, unresolved, missingNodes, changed: replacements.length > 0 }
}

export async function diagnoseAndRepairApiWorkflow(apiWorkflow = {}) {
  const { comfyui } = await import('./comfyui.js')
  const objectInfo = await comfyui.getObjectInfo()
  return repairApiWorkflowModels(apiWorkflow, objectInfo)
}
