import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

import {
  buildQwenImage21Prompt,
  modifyQwenImage21CharacterSheetWorkflow,
  modifyQwenImage21HereticEditWorkflow,
  modifyQwenImage21HereticWorkflow,
} from '../src/services/qwenImage21HereticWorkflow.mjs'

const repoUrl = new URL('../', import.meta.url)
const workflow = JSON.parse(await fs.readFile(new URL('public/workflows/image_qwen_image_2_1_heretic.json', repoUrl), 'utf8'))
const editWorkflow = JSON.parse(await fs.readFile(new URL('public/workflows/image_qwen_image_2_1_heretic_edit.json', repoUrl), 'utf8'))
const characterSheetWorkflow = JSON.parse(await fs.readFile(new URL('public/workflows/image_qwen_image_2_1_character_sheet.json', repoUrl), 'utf8'))
const schemaSource = await fs.readFile(new URL('src/services/flowAiSchema.js', repoUrl), 'utf8')
const runtimeSource = await fs.readFile(new URL('src/services/flowAiRuntime.js', repoUrl), 'utf8')
const workspaceSource = await fs.readFile(new URL('src/components/FlowAIWorkspace.jsx', repoUrl), 'utf8')
const dependencySource = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installSource = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')
const setupManagerSource = await fs.readFile(new URL('src/services/workflowSetupManager.js', repoUrl), 'utf8')
const servicesDir = fileURLToPath(new URL('src/services/', repoUrl))
const schemaBundle = await build({
  stdin: {
    contents: 'export { createFlowDocument, normalizeFlowDocument, FLOW_AI_NODE_TYPES } from "./flowAiSchema";',
    resolveDir: servicesDir,
    sourcefile: 'qwen-transparent-prompt-test.js',
  },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  define: { 'import.meta.env.BASE_URL': '"/"' },
})
const { createFlowDocument, normalizeFlowDocument, FLOW_AI_NODE_TYPES } = await import(
  `data:text/javascript;base64,${Buffer.from(schemaBundle.outputFiles[0].text).toString('base64')}`
)

test('Qwen Image 2.1 Heretic graph uses the requested GGUF encoder and official image stack', () => {
  assert.equal(workflow['1'].class_type, 'UNETLoader')
  assert.equal(workflow['1'].inputs.unet_name, 'qwen_image_2.1_int8_convrot.safetensors')
  assert.equal(workflow['2'].class_type, 'CLIPLoaderGGUF')
  assert.equal(workflow['2'].inputs.clip_name, 'qwen3vl_8b_heretic-Q4_K_M.gguf')
  assert.equal(workflow['2'].inputs.type, 'qwen_image')
  assert.equal(workflow['4'].class_type, 'TextEncodeQwenImage21')
  assert.equal(workflow['3'].inputs.vae_name, 'qwen_image_2.1_vae_bf16.safetensors')
})

test('transparent PNG switch wraps the prompt without changing the saved note text', () => {
  const prompt = 'デフォルメされたメイドさんの全身イラスト。'
  assert.equal(buildQwenImage21Prompt(prompt, false), prompt)
  assert.equal(
    buildQwenImage21Prompt(prompt, true),
    `This is an RGBA format image with transparency. ${prompt} The image has an alpha channel and a transparent background.`
  )
})

test('transparent PNG control is visibly connected to the Qwen prompt', () => {
  for (const templateId of ['qwen-image-2-1-heretic', 'qwen-image-2-1-heretic-edit']) {
    const document = createFlowDocument({ templateId })
    const note = document.nodes.find(node => node.data?.controlKind === 'transparent-png')
    const prompt = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.prompt)
    const generator = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.imageGen)

    assert.equal(prompt.data.acceptsPromptControls, true)
    assert.ok(document.edges.some(edge => (
      edge.source === note.id && edge.target === prompt.id
      && edge.sourceHandle === 'out:control' && edge.targetHandle === 'in:control'
    )))
    assert.equal(document.edges.some(edge => (
      edge.source === note.id && edge.target === generator.id && edge.targetHandle === 'in:control'
    )), false)
  }
  assert.match(runtimeSource, /edge\.targetHandle === 'in:text'[\s\S]*pendingNodeIds\.push\(sourceNode\.id\)/)
})

test('saved Qwen flows move the legacy transparent control edge onto the prompt', () => {
  const document = createFlowDocument({ templateId: 'qwen-image-2-1-heretic-edit' })
  const note = document.nodes.find(node => node.data?.controlKind === 'transparent-png')
  const prompt = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.prompt)
  const generator = document.nodes.find(node => node.type === FLOW_AI_NODE_TYPES.imageGen)
  prompt.data.acceptsPromptControls = false
  prompt.data.status = 'error'
  prompt.data.error = 'Workflow qwen-image-2-1-heretic-edit is missing dependencies. Open Workflow Setup to install the required nodes/models.'
  document.edges = document.edges.filter(edge => !(edge.source === note.id && edge.target === prompt.id))
  document.edges.push({
    id: 'legacy-transparent-edge',
    source: note.id,
    sourceHandle: 'out:control',
    target: generator.id,
    targetHandle: 'in:control',
  })

  const normalized = normalizeFlowDocument(document)
  const normalizedPrompt = normalized.nodes.find(node => node.id === prompt.id)
  assert.equal(normalizedPrompt.data.acceptsPromptControls, true)
  assert.equal(normalizedPrompt.data.status, 'idle')
  assert.equal(normalizedPrompt.data.error, '')
  assert.ok(normalized.edges.some(edge => edge.source === note.id && edge.target === prompt.id && edge.targetHandle === 'in:control'))
  assert.equal(normalized.edges.some(edge => edge.id === 'legacy-transparent-edge'), false)
})

test('a CANVAS run failure is not copied onto whichever non-executable node is selected', () => {
  const catchBlock = workspaceSource.slice(
    workspaceSource.indexOf("const message = error instanceof Error ? error.message : String(error || 'CANVAS run failed.')"),
    workspaceSource.indexOf("const message = error instanceof Error ? error.message : String(error || 'CANVAS run failed.')") + 900,
  )
  assert.doesNotMatch(catchBlock, /updateNodeData\(selectedNodeId/)
  assert.match(runtimeSource, /patchWorkingNode\(node\.id,[\s\S]*status: interrupted \? 'idle' : 'error'/)
})

test('modifier applies official sampling defaults and RGBA prompt', () => {
  const result = modifyQwenImage21HereticWorkflow(workflow, {
    prompt: 'A small fox sticker.', transparentPng: true, width: 768, height: 1024,
    seed: 42, steps: 25, cfg: 1, variantCount: 3, filenamePrefix: 'image/test_qwen21',
  })
  assert.match(result['4'].inputs.prompt, /^This is an RGBA format image with transparency\./)
  assert.equal(result['5'].inputs.width, 768)
  assert.equal(result['5'].inputs.batch_size, 3)
  assert.equal(result['6'].inputs.sampler_name, 'euler')
  assert.equal(result['6'].inputs.scheduler, 'simple')
  assert.equal(result['8'].inputs.filename_prefix, 'image/test_qwen21')
  assert.equal(workflow['4'].inputs.prompt, 'A clean studio product photograph.')
})

test('image edit graph feeds image_1 and VAE into TextEncodeQwenImage21 and samples its latent', () => {
  assert.equal(editWorkflow['2'].inputs.clip_name, workflow['2'].inputs.clip_name)
  assert.equal(editWorkflow['1'].inputs.unet_name, workflow['1'].inputs.unet_name)
  assert.equal(editWorkflow['3'].inputs.vae_name, workflow['3'].inputs.vae_name)
  assert.deepEqual(editWorkflow['5'].inputs['images.image_1'], ['4', 0])
  assert.deepEqual(editWorkflow['5'].inputs.vae, ['3', 0])
  assert.deepEqual(editWorkflow['6'].inputs.latent_image, ['5', 2])
})

test('image edit modifier applies input, edit prompt, transparency, and official defaults without mutation', () => {
  const result = modifyQwenImage21HereticEditWorkflow(editWorkflow, {
    inputImage: 'canvas/source.png', prompt: 'Change <image1> into a sticker.', transparentPng: true,
    resolution: 0, seed: 123, steps: 25, cfg: 1, filenamePrefix: 'image/test_qwen21_edit',
  })
  assert.equal(result['4'].inputs.image, 'canvas/source.png')
  assert.match(result['5'].inputs.prompt, /^This is an RGBA format image with transparency\./)
  assert.equal(result['5'].inputs.resolution, 0)
  assert.equal(result['6'].inputs.seed, 123)
  assert.equal(result['6'].inputs.sampler_name, 'euler')
  assert.equal(result['8'].inputs.filename_prefix, 'image/test_qwen21_edit')
  assert.equal(editWorkflow['4'].inputs.image, 'input.png')
})

test('image edit modifier rejects a missing edit target', () => {
  assert.throws(
    () => modifyQwenImage21HereticEditWorkflow(editWorkflow, { prompt: 'Edit <image1>.' }),
    /requires an input image/
  )
})

test('QWEN character sheet uses a separate 3:2 latent and the published sampling baseline', () => {
  assert.deepEqual(characterSheetWorkflow['5'].inputs['images.image_1'], ['4', 0])
  assert.deepEqual(characterSheetWorkflow['7'].inputs.latent_image, ['6', 0])

  const result = modifyQwenImage21CharacterSheetWorkflow(characterSheetWorkflow, {
    inputImage: 'canvas/character.png',
    prompt: 'Create a design sheet for Alice from <image1>.',
    width: 2240,
    height: 1504,
    resolution: 1536,
    seed: 42,
    filenamePrefix: 'image/test_qwen_character_sheet',
  })

  assert.equal(result['4'].inputs.image, 'canvas/character.png')
  assert.equal(result['5'].inputs.prompt, 'Create a design sheet for Alice from <image1>.')
  assert.equal(result['5'].inputs.resolution, 1536)
  assert.equal(result['6'].inputs.width, 2240)
  assert.equal(result['6'].inputs.height, 1504)
  assert.equal(result['7'].inputs.sampler_name, 'res_2m')
  assert.equal(result['7'].inputs.scheduler, 'beta')
  assert.equal(result['7'].inputs.steps, 25)
  assert.equal(result['7'].inputs.cfg, 1)
  assert.equal(result['9'].inputs.filename_prefix, 'image/test_qwen_character_sheet')
  assert.equal(characterSheetWorkflow['4'].inputs.image, 'character_reference.png')
})

test('QWEN character sheet rejects a missing reference image', () => {
  assert.throws(
    () => modifyQwenImage21CharacterSheetWorkflow(characterSheetWorkflow, { prompt: 'Create a sheet.' }),
    /requires a reference image/
  )
})

test('CANVAS and Workflow Setup expose the Heretic flow and exact dependencies', () => {
  assert.match(schemaSource, /id: 'qwen-image-2-1-heretic'/)
  assert.match(schemaSource, /id: 'qwen-image-2-1-heretic-edit'/)
  assert.match(schemaSource, /id: 'qwen-image-2-1-character-sheet'/)
  assert.match(schemaSource, /label: 'Qwen 2\.1 Character Sheet'/)
  assert.match(schemaSource, /controlKind: 'transparent-png'/)
  assert.match(dependencySource, /'qwen-image-2-1-heretic-edit': Object\.freeze/)
  assert.match(dependencySource, /'qwen-image-2-1-character-sheet': Object\.freeze/)
  assert.match(dependencySource, /requiredModels: QWEN_IMAGE_21_HERETIC_MODELS/)
  assert.match(dependencySource, /qwen3vl_8b_heretic-Q4_K_M\.gguf/)
  assert.match(dependencySource, /mmproj-qwen3vl_8b_heretic-f16\.gguf/)
  assert.match(installSource, /ComfyUI-GGUF-Qwen3VL-TE/)
  assert.match(installSource, /1338274ac7a6344f262a16c7a52d1bd7fe789307d252733b23ea421126e5d343/)
})

test('deprecated Image Edit With References template is omitted while shared image-edit runtime remains', () => {
  assert.doesNotMatch(schemaSource, /id: 'style-edit'/)
  assert.doesNotMatch(schemaSource, /buildStyleEditTemplate/)
  assert.match(schemaSource, /id: 'character-reference-edit'/)
})

test('Workflow Setup plans the patch add-on even though it exposes no ComfyUI node class', () => {
  assert.match(setupManagerSource, /getNodePackInstallInfo/)
  assert.match(setupManagerSource, /for \(const pack of result\.missingNodePacks \|\| \[\]\)/)
  assert.match(setupManagerSource, /nodePackMap\.set\(pack\.install\.id, current\)/)
})
