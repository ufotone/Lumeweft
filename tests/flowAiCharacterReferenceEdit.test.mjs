import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import {
  createNumberedReferenceSheet,
  getNumberedReferenceSheetLayout,
  planNumberedReferenceSheets,
} from '../src/services/numberedReferenceSheets.mjs'

const servicesDir = fileURLToPath(new URL('../src/services/', import.meta.url))
const bundled = await build({
  stdin: {
    contents: 'export { createFlowDocument, normalizeFlowDocument, FLOW_AI_NODE_TYPES, FLOW_AI_TEMPLATES } from "./flowAiSchema"; export { modifyQwenImageEdit2509Workflow } from "./comfyui";',
    resolveDir: servicesDir,
    sourcefile: 'character-reference-edit-test.js',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  define: { 'import.meta.env.BASE_URL': '"/"' },
})
const { createFlowDocument, normalizeFlowDocument, FLOW_AI_NODE_TYPES, FLOW_AI_TEMPLATES, modifyQwenImageEdit2509Workflow } = await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`
)

test('I2I character edit exposes one primary and five numbered optional references', () => {
  assert.ok(FLOW_AI_TEMPLATES.some(template => template.id === 'character-reference-edit' && template.label === 'Qwen Character Edit'))

  const document = createFlowDocument({ templateId: 'character-reference-edit' })
  const primary = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.imageInput)
  const references = document.nodes.filter(node => node.type === FLOW_AI_NODE_TYPES.styleReference)
  const prompt = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.prompt)
  const generator = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.imageGen)
  const output = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.output)

  assert.ok(primary)
  assert.deepEqual(primary.data.acceptedAssetTypes, ['image'])
  assert.equal(references.length, 5)
  assert.deepEqual(references.map(node => node.data.assetRole), [
    'character-reference-2',
    'character-reference-3',
    'character-reference-4',
    'character-reference-5',
    'character-reference-6',
  ])
  assert.equal(generator?.data?.workflowId, 'image-edit')
  assert.equal(generator?.data?.preserveInputResolution, true)
  assert.equal(generator?.data?.variantCount, 1)
  assert.equal(generator?.data?.referencePacking, 'numbered-six')
  assert.equal(output?.data?.folderName, 'Character Reference Edits')
  assert.match(prompt?.data?.basePrompt || '', /Preserve Reference 1 facial identity/)
  assert.match(prompt?.data?.basePrompt || '', /REFERENCE 2 through REFERENCE 6/)
  assert.match(prompt?.data?.basePrompt || '', /Reference N or 参照N/)
  assert.match(prompt?.data?.basePrompt || '', /Transfer only the requested elements/)

  const primaryEdges = document.edges.filter(edge => edge.target === generator.id && edge.targetHandle === 'in:image')
  const referenceEdges = document.edges.filter(edge => edge.target === generator.id && edge.targetHandle === 'in:style')
  const promptEdges = document.edges.filter(edge => edge.target === generator.id && edge.targetHandle === 'in:text')
  assert.equal(primaryEdges.length, 1)
  assert.equal(referenceEdges.length, 5)
  assert.equal(promptEdges.length, 1)
})

test('Qwen image edit maps the two generated reference sheets to image2 and image3', () => {
  const workflow = {
    source: { class_type: 'LoadImage', inputs: { image: 'old.png' }, _meta: { title: 'Load Image' } },
    positive: {
      class_type: 'TextEncodeQwenImageEditPlus',
      inputs: { prompt: '', image1: ['source', 0] },
      _meta: { title: 'Image Edit Positive' },
    },
  }
  const modified = modifyQwenImageEdit2509Workflow(workflow, {
    prompt: 'new outfit',
    inputImage: 'character-front.png',
    referenceImages: ['references-2-4.png', 'references-5-6.png'],
  })

  assert.equal(modified.source.inputs.image, 'character-front.png')
  assert.equal(modified.ref_img_1.inputs.image, 'references-2-4.png')
  assert.equal(modified.ref_img_2.inputs.image, 'references-5-6.png')
  assert.deepEqual(modified.positive.inputs.image2, ['ref_img_1', 0])
  assert.deepEqual(modified.positive.inputs.image3, ['ref_img_2', 0])
})

test('five optional references are packed into two numbered sheets without losing slot numbers', () => {
  const items = Array.from({ length: 5 }, (_, index) => ({
    file: { name: `reference-${index + 2}.png` },
    referenceNumber: index + 2,
  }))
  const groups = planNumberedReferenceSheets(items)
  assert.deepEqual(groups.map(group => group.map(item => item.referenceNumber)), [[2, 3, 4], [5, 6]])
  assert.deepEqual(getNumberedReferenceSheetLayout(3), {
    count: 3,
    columns: 2,
    rows: 2,
    width: 1024,
    height: 1024,
    cellWidth: 512,
    cellHeight: 512,
  })
})

test('reference sheet renderer burns each prompt-facing number into the image', async () => {
  const originalDocument = globalThis.document
  const originalCreateImageBitmap = globalThis.createImageBitmap
  const labels = []
  const context = {
    fillStyle: '', font: '', textBaseline: '',
    fillRect() {}, drawImage() {},
    fillText(value) { labels.push(value) },
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => context,
    toBlob: callback => callback(new Blob(['sheet'], { type: 'image/png' })),
  }
  globalThis.document = { createElement: () => canvas }
  globalThis.createImageBitmap = async () => ({ width: 640, height: 960, close() {} })
  try {
    const sheet = await createNumberedReferenceSheet([
      { file: new Blob(['2']), referenceNumber: 2 },
      { file: new Blob(['3']), referenceNumber: 3 },
      { file: new Blob(['4']), referenceNumber: 4 },
    ])
    assert.equal(sheet.name, 'canvas_character_references_2-4.png')
    assert.equal(canvas.width, 1024)
    assert.equal(canvas.height, 1024)
    assert.deepEqual(labels, ['REFERENCE 2', 'REFERENCE 3', 'REFERENCE 4'])
  } finally {
    globalThis.document = originalDocument
    globalThis.createImageBitmap = originalCreateImageBitmap
  }
})

test('saved three-reference documents are upgraded to six slots without losing assigned assets', () => {
  const legacy = createFlowDocument({ templateId: 'character-reference-edit' })
  const generator = legacy.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.imageGen)
  const styleNodes = legacy.nodes.filter(node => node.type === FLOW_AI_NODE_TYPES.styleReference)
  const keptIds = new Set(styleNodes.slice(0, 2).map(node => node.id))
  styleNodes[0].data.assetRole = 'character-reference-secondary'
  styleNodes[0].data.assetId = 'asset-outfit'
  styleNodes[1].data.assetRole = 'character-reference-tertiary'
  styleNodes[1].data.assetId = 'asset-bag'
  legacy.nodes = legacy.nodes.filter(node => node.type !== FLOW_AI_NODE_TYPES.styleReference || keptIds.has(node.id))
  legacy.edges = legacy.edges.filter(edge => edge.targetHandle !== 'in:style' || keptIds.has(edge.source))

  const upgraded = normalizeFlowDocument(legacy)
  const references = upgraded.nodes.filter(node => node.type === FLOW_AI_NODE_TYPES.styleReference)
    .sort((left, right) => left.data.assetRole.localeCompare(right.data.assetRole))
  assert.equal(references.length, 5)
  assert.deepEqual(references.map(node => node.data.assetRole), Array.from({ length: 5 }, (_, index) => `character-reference-${index + 2}`))
  assert.equal(references[0].data.assetId, 'asset-outfit')
  assert.equal(references[1].data.assetId, 'asset-bag')
  assert.equal(upgraded.nodes.find(node => node.id === generator.id).data.referencePacking, 'numbered-six')
})
