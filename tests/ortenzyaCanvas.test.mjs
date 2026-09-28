import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { build } from 'esbuild'
import { generateOrtenzyaText, cancelOrtenzyaGeneration, ORTENZYA_WORKFLOW_ID } from '../src/services/ortenzyaCanvas.mjs'

test('template and saved scenario edits survive normalization with connected draft output', async () => {
  const bundle = await build({ entryPoints: [new URL('../src/services/flowAiSchema.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, write: false, platform: 'node', format: 'esm' })
  const schema = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  const doc = schema.createFlowDocument({ templateId: 'nsfw-ortenzya-scenario' })
  assert.equal(doc.nodes.length, 4)
  const [brief, scenario, drafts, viewer] = doc.nodes
  scenario.data.outputText = 'edited scenario'
  scenario.data.localLlmModel = 'custom-alias'
  const restored = schema.normalizeFlowNode(JSON.parse(JSON.stringify(scenario)))
  assert.equal(restored.data.outputText, 'edited scenario')
  assert.equal(restored.data.localLlmModel, 'custom-alias')
  assert.equal(restored.data.workflowId, ORTENZYA_WORKFLOW_ID)
  assert.deepEqual(doc.edges.map(edge => [edge.source, edge.target]), [[brief.id, scenario.id], [scenario.id, drafts.id], [drafts.id, viewer.id]])
  assert.equal(schema.getDefaultWorkflowId('prompt-assist'), 'jp-tag-assistant')
})

test('detects actual server model ID and passes scenario content and sampling settings', async () => {
  const requests = []
  const result = await generateOrtenzyaText({ prompt: 'edited scenario', endpoint: 'http://localhost:1234/v1/', systemPrompt: 'make shot drafts', fetchImpl: async (url, options) => {
    requests.push({ url, options })
    return { ok: true, json: async () => url.endsWith('/models')
      ? { data: [{ id: 'other' }, { id: 'gemma-4-Ortenzya-31B-Q4_K_M.gguf' }] }
      : { choices: [{ message: { content: 'shot 1' }, finish_reason: 'length' }] } }
  } })
  assert.equal(requests[0].url, 'http://localhost:1234/v1/models')
  const body = JSON.parse(requests[1].options.body)
  assert.equal(body.model, 'gemma-4-Ortenzya-31B-Q4_K_M.gguf')
  assert.deepEqual(body.messages, [{ role: 'system', content: 'make shot drafts' }, { role: 'user', content: 'edited scenario' }])
  assert.equal(body.top_k, 64)
  assert.equal(result.text, 'shot 1')
  assert.equal(result.truncated, true)
})

test('does not silently select an unrelated model or send to a remote server', async () => {
  await assert.rejects(generateOrtenzyaText({ prompt: 'x', fetchImpl: async () => ({ ok: true, json: async () => ({ data: [{ id: 'other' }] }) }) }), /Ortenzya 31B/)
  await assert.rejects(generateOrtenzyaText({ prompt: 'x', endpoint: 'https://example.com' }), /localhost/)
})

test('reports an empty model response', async () => {
  await assert.rejects(generateOrtenzyaText({ prompt: 'x', modelId: 'alias', fetchImpl: async url => ({ ok: true, json: async () => url.endsWith('/models') ? { data: [{ id: 'alias' }] } : { choices: [{ message: { content: '' } }] } }) }), /本文/)
})

test('stop cancels a pending local request', async () => {
  const pending = generateOrtenzyaText({ prompt: 'x', fetchImpl: async (url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  }) })
  assert.equal(cancelOrtenzyaGeneration(), true)
  await assert.rejects(pending, /interrupted/)
  assert.equal(cancelOrtenzyaGeneration(), false)
})

test('CANVAS local text execution bypasses ComfyUI and preserves edited upstream scenario', async () => {
  const source = await fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8')
  const start = source.indexOf('async function runExecutableNode(')
  const end = source.indexOf('\nexport async function runFlowGraph', start)
  const run = new Function('throwIfFlowInterrupted', 'useProjectStore', 'FLOW_AI_NODE_TYPES', 'ORTENZYA_WORKFLOW_ID', 'generateOrtenzyaText', 'collectIncomingEdges', 'resolvePromptText', 'checkWorkflowDependencies', source.slice(start, end) + '\nreturn runExecutableNode')(
    () => {},
    { getState: () => ({ currentProjectHandle: 'project' }) }, { promptAssist: 'prompt-assist' }, ORTENZYA_WORKFLOW_ID,
    async options => { assert.equal(options.prompt, 'edited scenario'); return { text: 'draft', modelId: 'ortenzya-31b', truncated: false } },
    () => [], () => 'edited scenario', () => { throw new Error('must not contact ComfyUI') },
  )
  const result = await run({}, { id: 'draft', type: 'prompt-assist', data: { workflowId: ORTENZYA_WORKFLOW_ID } })
  assert.equal(result.textOutput, 'draft')
  assert.deepEqual(result.importedAssets, [])
})
