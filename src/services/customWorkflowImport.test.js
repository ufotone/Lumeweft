import test from 'node:test'
import assert from 'node:assert/strict'

import {
  detectCustomWorkflowJsonFormat,
  normalizeCustomWorkflowJson,
} from './customWorkflowImport.js'

const apiWorkflow = {
  '1': { class_type: 'SaveImage', inputs: { filename_prefix: 'test' } },
}

test('detects direct and wrapped API workflows', () => {
  assert.equal(detectCustomWorkflowJsonFormat(apiWorkflow).format, 'api')
  assert.equal(detectCustomWorkflowJsonFormat({ prompt: apiWorkflow }).workflow, apiWorkflow)
})

test('detects a regular ComfyUI UI graph', () => {
  const uiWorkflow = { nodes: [{ id: 1, type: 'SaveImage' }], links: [] }
  assert.equal(detectCustomWorkflowJsonFormat(uiWorkflow).format, 'ui')
})

test('converts UI graphs and preserves API exports', async () => {
  let convertedGraph = null
  const uiWorkflow = { nodes: [{ id: 1, type: 'SaveImage' }], links: [] }
  const uiResult = await normalizeCustomWorkflowJson(uiWorkflow, {
    convertUiWorkflow: async (graph) => {
      convertedGraph = graph
      return apiWorkflow
    },
  })
  assert.equal(convertedGraph, uiWorkflow)
  assert.equal(uiResult.workflow, apiWorkflow)
  assert.equal(uiResult.sourceFormat, 'ui')

  const apiResult = await normalizeCustomWorkflowJson(apiWorkflow, {
    convertUiWorkflow: async () => assert.fail('API JSON should not be converted'),
  })
  assert.equal(apiResult.workflow, apiWorkflow)
  assert.equal(apiResult.sourceFormat, 'api')
})

test('rejects unknown JSON and invalid converter output', async () => {
  await assert.rejects(
    normalizeCustomWorkflowJson({ hello: 'world' }),
    /not a recognized ComfyUI/,
  )
  await assert.rejects(
    normalizeCustomWorkflowJson({ nodes: [], links: [] }, { convertUiWorkflow: async () => ({}) }),
    /did not return a valid API workflow/,
  )
})
