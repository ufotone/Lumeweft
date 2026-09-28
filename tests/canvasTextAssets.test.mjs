import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { build } from 'esbuild'
import { makeTextAssetFile, saveCanvasTextAsset } from '../src/services/canvasTextAssets.mjs'

test('exports UTF-8 text as a portable asset without overwriting an existing name', async () => {
  let storedFile
  const asset = await saveCanvasTextAsset({ text: '第一幕\n台詞：こんにちは。', name: 'scene.txt', projectHandle: 'project', documentId: 'flow1', nodeId: 'export',
    importAsset: async (project, file, category) => { storedFile = file; assert.equal(category, 'text'); return { name: 'scene_1.txt', path: 'assets/text/scene_1.txt' } },
    ensureFolder: segments => { assert.deepEqual(segments, ['CANVAS', 'Texts']); return 'texts' },
    addAsset: data => ({ id: 'text1', ...data }),
  })
  assert.equal(await storedFile.text(), '第一幕\n台詞：こんにちは。')
  assert.equal(asset.name, 'scene_1.txt')
  assert.equal(asset.path, 'assets/text/scene_1.txt')
  assert.equal(asset.type, 'text')
  assert.equal(JSON.parse(JSON.stringify(asset)).textContent, await storedFile.text())
})

test('rejects blank exports and sanitizes filenames', () => {
  assert.throws(() => makeTextAssetFile(' \n'), /テキストがありません/)
  assert.equal(makeTextAssetFile('text', 'CON').name, 'text_CON.txt')
  assert.equal(makeTextAssetFile('text', '../a/b.txt').name, '.._a_b.txt')
})

test('saved text-input nodes reuse a text asset across documents', async () => {
  const bundle = await build({ entryPoints: [new URL('../src/services/flowAiSchema.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, write: false, platform: 'node', format: 'esm' })
  const schema = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  const input = schema.normalizeFlowNode(schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.textInput, { data: { assetId: 'text1' } }))
  const output = schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.textOutput)
  assert.equal(input.data.assetId, 'text1')
  assert.equal(schema.getFlowNodeSupportsExecution(output.type), true)
  const source = await fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8')
  const start = source.indexOf('export function resolveFlowNodeText(')
  const end = source.indexOf('\nfunction hasReusableNodeOutput', start)
  const resolve = new Function('FLOW_AI_NODE_TYPES', 'nodeMapFor', 'assetMapFor', 'collectIncomingEdges', source.slice(start, end).replace('export ', '') + '\nreturn resolveFlowNodeText')(
    schema.FLOW_AI_NODE_TYPES, doc => new Map(doc.nodes.map(node => [node.id, node])), () => new Map([['text1', { type: 'text', textContent: '保存したシナリオ' }]]),
    (doc, id) => doc.edges.filter(edge => edge.target === id),
  )
  const doc = { nodes: [input, output], edges: [{ source: input.id, target: output.id }] }
  assert.equal(resolve(doc, output), '保存したシナリオ')
})

test('prompt nodes always compose hidden preset instructions with editable creative direction', async () => {
  const bundle = await build({ entryPoints: [new URL('../src/services/flowAiSchema.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, write: false, platform: 'node', format: 'esm' })
  const schema = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  const source = await fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8')
  const start = source.indexOf('export function resolveFlowNodeText(')
  const end = source.indexOf('\nfunction hasReusableNodeOutput', start)
  const resolve = new Function('FLOW_AI_NODE_TYPES', 'nodeMapFor', 'assetMapFor', 'collectIncomingEdges', source.slice(start, end).replace('export ', '') + '\nreturn resolveFlowNodeText')(
    schema.FLOW_AI_NODE_TYPES, doc => new Map(doc.nodes.map(node => [node.id, node])), () => new Map(), () => [],
  )
  const prompt = schema.createFlowNode(schema.FLOW_AI_NODE_TYPES.prompt, { data: { basePrompt: 'Keep identity stable.', promptText: 'Slowly turn toward camera.' } })
  assert.equal(resolve({ nodes: [prompt], edges: [] }, prompt), 'Keep identity stable.\n\nSlowly turn toward camera.')
  prompt.data.promptText = ''
  assert.equal(resolve({ nodes: [prompt], edges: [] }, prompt), 'Keep identity stable.')
})

test('saved AfterMidnight canvases migrate the old visible boilerplate into a hidden base prompt', async () => {
  const bundle = await build({ entryPoints: [new URL('../src/services/flowAiSchema.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')], bundle: true, write: false, platform: 'node', format: 'esm' })
  const schema = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`)
  const old = schema.createFlowDocument({ templateId: 'nsfw-minimax-h3-aftermidnight-r2v' })
  const prompt = old.nodes.find(node => node.type === schema.FLOW_AI_NODE_TYPES.prompt)
  delete prompt.data.basePrompt
  prompt.data.promptText = 'Use <Picture 1> as the adult subject identity, face, hair, body, and clothing reference. Use <Video 1> as the motion, timing, pose, interaction, and camera reference. Describe the intended adult scene, coherent action, and synchronized sound.'
  const normalized = schema.normalizeFlowDocument(old)
  const migrated = normalized.nodes.find(node => node.id === prompt.id)
  assert.match(migrated.data.basePrompt, /Replace the primary subject in <Video 1>/)
  assert.equal(migrated.data.promptText, 'Perform the referenced action naturally and coherently.')
})

test('export waits for generation through a non-executable text viewer', async () => {
  const source = await fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8')
  const start = source.indexOf('function topologicalExecutionOrder(')
  const end = source.indexOf('\nfunction ', start + 10)
  const order = new Function('nodeMapFor', 'getExecutableNodeIds', 'collectIncomingEdges', source.slice(start, end) + '\nreturn topologicalExecutionOrder')(
    doc => new Map(doc.nodes.map(node => [node.id, node])), doc => doc.nodes.filter(node => node.id !== 'viewer').map(node => node.id), (doc, id) => doc.edges.filter(edge => edge.target === id),
  )
  const doc = { nodes: [{ id: 'export' }, { id: 'viewer' }, { id: 'generate' }], edges: [{ source: 'generate', target: 'viewer' }, { source: 'viewer', target: 'export' }] }
  assert.deepEqual(order(doc).map(node => node.id), ['generate', 'export'])
})
