import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

async function loadSchema() {
  const bundle = await build({
    entryPoints: [new URL('../src/services/flowAiSchema.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'esm',
  })
  const source = bundle.outputFiles[0].text
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}

const schema = await loadSchema()

test('prompt language capabilities default to English and identify model-specific languages', () => {
  assert.deepEqual(schema.getFlowPromptLanguages('unknown-custom-flow'), ['EN'])
  assert.deepEqual(schema.getFlowPromptLanguages('qwen-image-2-1-heretic'), ['EN', 'JP', 'CH'])
  assert.deepEqual(schema.getFlowPromptLanguages('minimax-h3-gguf-i2v'), ['EN', 'CH'])
  assert.deepEqual(schema.getFlowPromptLanguages('irodori-v4-1-anime'), ['JP'])
})

test('prompt language badges follow the connected target workflow', () => {
  const prompt = schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.prompt, { id: 'prompt' })
  const generator = schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.imageGen, {
    id: 'generator',
    data: { workflowId: 'qwen-image-2-1-heretic' },
  })
  const document = {
    nodes: [prompt, generator],
    edges: [schema.createFlowEdge({
      source: prompt.id,
      sourceHandle: 'out:text',
      target: generator.id,
      targetHandle: 'in:text',
    })],
  }

  assert.deepEqual(schema.resolveFlowPromptLanguages(document, prompt), ['EN', 'JP', 'CH'])
  generator.data.workflowId = 'ltx23-i2v'
  assert.deepEqual(schema.resolveFlowPromptLanguages(document, prompt.id), ['EN'])
})

test('Japanese input is shown when the prompt first passes through the H3 optimizer', () => {
  const prompt = schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.prompt, { id: 'prompt' })
  const optimizer = schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.h3Optimizer, { id: 'optimizer' })
  const video = schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.videoGen, {
    id: 'video',
    data: { workflowId: 'minimax-h3-gguf-i2v' },
  })
  const document = {
    nodes: [prompt, optimizer, video],
    edges: [
      schema.createFlowEdge({ source: prompt.id, sourceHandle: 'out:text', target: optimizer.id, targetHandle: 'in:text' }),
      schema.createFlowEdge({ source: optimizer.id, sourceHandle: 'out:text', target: video.id, targetHandle: 'in:text' }),
    ],
  }

  assert.deepEqual(schema.resolveFlowPromptLanguages(document, prompt), ['EN', 'JP', 'CH'])
})
