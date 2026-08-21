function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function looksLikeApiPrompt(value) {
  if (!isPlainObject(value)) return false
  const nodes = Object.values(value)
  return nodes.length > 0 && nodes.every((node) => (
    isPlainObject(node)
    && typeof node.class_type === 'string'
    && isPlainObject(node.inputs)
  ))
}

/** Identify the two JSON formats exported by ComfyUI. */
export function detectCustomWorkflowJsonFormat(value) {
  if (looksLikeApiPrompt(value)) {
    return { format: 'api', workflow: value }
  }

  // Some API integrations wrap the prompt in a top-level `prompt` property.
  if (isPlainObject(value) && looksLikeApiPrompt(value.prompt)) {
    return { format: 'api', workflow: value.prompt }
  }

  if (isPlainObject(value) && Array.isArray(value.nodes)) {
    return { format: 'ui', workflow: value }
  }

  return { format: 'unknown', workflow: null }
}

/**
 * Return API prompt JSON for either an API export or a regular UI/graph
 * export. UI graphs are converted by the caller through the embedded ComfyUI
 * frontend so serialization stays compatible with the installed version.
 */
export async function normalizeCustomWorkflowJson(value, { convertUiWorkflow } = {}) {
  const detected = detectCustomWorkflowJsonFormat(value)
  if (detected.format === 'api') {
    return { workflow: detected.workflow, sourceFormat: 'api' }
  }

  if (detected.format === 'ui') {
    if (typeof convertUiWorkflow !== 'function') {
      throw new Error('UI workflow JSON conversion is only available in the Lumeweft desktop app.')
    }
    const converted = await convertUiWorkflow(detected.workflow)
    if (!looksLikeApiPrompt(converted)) {
      throw new Error('ComfyUI did not return a valid API workflow after converting the UI JSON.')
    }
    return { workflow: converted, sourceFormat: 'ui' }
  }

  throw new Error('This JSON is not a recognized ComfyUI API workflow or UI workflow export.')
}
