import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { modifyMinimaxH3GGUFReferenceWorkflow as configure } from '../src/services/minimaxH3ReferenceWorkflow.mjs'
import { modifyMinimaxH3PinkReferenceWorkflow as configurePink } from '../src/services/minimaxH3PinkReferenceWorkflow.mjs'
import { getWorkflowDependencyPack } from '../src/config/workflowDependencyPacks.js'
import { getModelInstallInfo } from '../src/config/workflowInstallCatalog.js'

const workflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_minimax_h3_gguf_r2v.json', import.meta.url)))
const pinkWorkflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_minimax_h3_pink_reference.json', import.meta.url)))
const afterMidnightWorkflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_minimax_h3_aftermidnight_r2v.json', import.meta.url)))
const characterSwapWorkflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_minimax_h3_character_swap.json', import.meta.url)))
const runtimeSource = await fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8')
const servicesDir = fileURLToPath(new URL('../src/services/', import.meta.url))
const unused = (names) => names.split(',').map(name => `export const ${name} = () => { throw new Error('Unexpected test call: ${name}') };`).join('\n')
const otherModifiers = runtimeSource.match(/import comfyui, \{([\s\S]*?)\} from '\.\/comfyui'/)[1]
  .split(',').map(s => s.trim()).filter(s => s && !['modifyMinimaxH3GGUFReferenceWorkflow', 'modifyMinimaxH3PinkReferenceWorkflow', 'modifyFastMinimaxH3Workflow', 'modifyVdnH3Workflow'].includes(s))
const stubs = {
  './comfyui': `export default {uploadFile: (...args) => globalThis.__h3Test.upload(...args)};
    export {modifyMinimaxH3GGUFReferenceWorkflow} from './minimaxH3ReferenceWorkflow.mjs';
    export {modifyMinimaxH3PinkReferenceWorkflow} from './minimaxH3PinkReferenceWorkflow.mjs';
    export {modifyFastMinimaxH3Workflow} from './fastMinimaxH3Workflow.mjs';
    export {modifyVdnH3Workflow} from './vdnH3Workflow.mjs';
    ${unused(otherModifiers.join(','))}`,
  './workflowDependencies': unused('checkWorkflowDependencies'),
  './fileSystem': unused('getProjectFileUrl,importAsset,isElectron'),
  './gifImport': unused('canImportGifMedia,importGifAsset,isGifFilename'),
  './playbackCache': unused('enqueuePlaybackTranscode'),
  './proxyCache': unused('enqueueProxyTranscode,isProxyPlaybackEnabled'),
  './comfyPromptGuard': unused('markPromptHandledByApp'),
  '../stores/assetsStore': 'export const useAssetsStore = {getState: () => ({assets: globalThis.__h3Test.assets})}',
  '../stores/projectStore': unused('useProjectStore'),
  './topazVideoUpscale': unused('buildTopazVideoUpscaleBaseName,runTopazVideoUpscale'),
}
// Bundle actual schema/runtime code, replacing only external IO. Expose the private
// context builder in this test bundle so no real prompt is queued or model loaded.
const bundled = await build({
  stdin: {
    contents: runtimeSource + '\nexport {buildExecutionContext, configureWorkflow, resolveVideoFrameTime, resolveMutedNodePassthrough}; export {createFlowDocument, createFlowNode, createFlowEdge, normalizeFlowDocument} from "./flowAiSchema";',
    resolveDir: servicesDir, sourcefile: 'h3-runtime-test.js',
  },
  bundle: true, write: false, format: 'esm', platform: 'node',
  define: {'import.meta.env.BASE_URL': '"/"'},
  plugins: [{name: 'mock-io', setup(builder) {
    builder.onResolve({filter: /.*/}, args => Object.hasOwn(stubs, args.path) ? {path: args.path, namespace: 'mock'} : undefined)
    builder.onLoad({filter: /.*/, namespace: 'mock'}, args => ({contents: stubs[args.path], resolveDir: servicesDir, loader: 'js'}))
  }}],
})
const runtime = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`)

test('Ref2VA graph keeps native audio and all nodes/models covered by Workflow Setup', () => {
  assert.equal(workflow['2'].inputs.model_name, 'minimax-h3-ref2va-Q4_0.gguf')
  assert.equal(workflow['6'].class_type, 'MiniMaxH3ReferenceToVideo')
  assert.deepEqual(workflow['14'].inputs.audio, ['13', 0])
  const pack = getWorkflowDependencyPack('minimax-h3-gguf-r2v')
  for (const node of Object.values(workflow)) {
    assert.ok(pack.requiredNodes.some(entry => entry.classType === node.class_type), node.class_type)
    for (const key of ['model_name', 'clip_name', 'mmproj_name', 'vae_name', 'lora_name']) {
      if (node.inputs[key]) assert.ok(pack.requiredModels.some(entry => entry.filename === node.inputs[key]))
    }
  }
  for (const model of pack.requiredModels) {
    const recipe = getModelInstallInfo(model)
    assert.ok(recipe.downloadUrl, model.filename)
    if (recipe.sha256) assert.match(recipe.sha256, /^[a-f0-9]{64}$/)
    if (recipe.sizeBytes) assert.ok(recipe.sizeBytes > 0)
  }
})

test('reference trimming uses a fixed 24 fps clock while generated duration stays on H3 grid', () => {
  const result = configure(workflow, {referenceVideo: 'motion.mov', referenceStart: 1.25, referenceDuration: 8, duration: 10, width: 721, height: 401})
  assert.equal(result['1'].inputs.skip_first_frames, 30)
  assert.equal(result['1'].inputs.frame_load_cap, 192)
  assert.equal(result['1'].inputs.force_rate, 24)
  assert.equal(result['1'].inputs.custom_height, 0)
  assert.equal(result['6'].inputs.length, 243)
  assert.equal(result['6'].inputs.width % 32, 0)
  assert.equal(result['6'].inputs.height % 32, 0)
  assert.equal(workflow['1'].inputs.video, 'reference.mp4', 'bundled graph is not mutated')
  for (const duration of [0.1, 5, 15, 100]) {
    const length = configure(workflow, {referenceVideo: 'clip.mp4', duration})['6'].inputs.length
    assert.ok(length >= 124 && length <= 362)
    assert.equal(length % 17, 5)
  }
})

test('eight image references keep order and reruns remove stale image/audio bindings', () => {
  const refs = Array.from({length: 8}, (_, index) => `picture-${index + 1}.png`)
  const first = configure(workflow, {referenceVideo: 'clip.mp4', referenceImages: refs, useReferenceAudio: true})
  for (let index = 0; index < 8; index++) assert.equal(first[`h3_ref_${index}`].inputs.image, refs[index])
  assert.deepEqual(first['6'].inputs['ref_video_audios.ref_video_audio_0'], ['1', 2])
  const second = configure(first, {referenceVideo: 'silent.mp4'})
  assert.ok(!Object.keys(second).some(id => id.startsWith('h3_ref_')))
  assert.ok(!Object.keys(second['6'].inputs).some(key => key.startsWith('ref_images.') || key.startsWith('ref_video_audios.')))
  assert.throws(() => configure(workflow, {referenceVideo: 'clip.mp4', referenceImages: [...refs, 'extra.png']}), /eight/)
})

test('Ref2VA PDD keeps its trained recipe with or without optional SageAttention', () => {
  const enabled = configure(workflow, {referenceVideo: 'clip.mp4'})
  assert.equal(enabled['17'].class_type, 'LoraLoaderModelOnly')
  assert.equal(enabled['17'].inputs.lora_name, 'MiniMax-H3-Ref2VA-Acc-8Step_pruned_comfy.safetensors')
  assert.equal(enabled['17'].inputs.strength_model, 1)
  assert.deepEqual(enabled['17'].inputs.model, ['2', 0])
  assert.equal(enabled['16'].class_type, 'PathchSageAttentionKJ')
  assert.deepEqual(enabled['16'].inputs, {model: ['17', 0], sage_attention: 'auto', allow_compile: false})
  assert.deepEqual(enabled['18'].inputs, {model: ['16', 0], video_shift: 12, audio_shift: 3})
  for (const id of ['8', '10']) assert.deepEqual(enabled[id].inputs.model, ['18', 0])
  assert.equal(enabled['9'].inputs.sampler_name, 'euler')
  assert.deepEqual(
    {scheduler: enabled['10'].inputs.scheduler, steps: enabled['10'].inputs.steps, denoise: enabled['10'].inputs.denoise},
    {scheduler: 'simple', steps: 8, denoise: 1},
  )
  const disabled = configure(enabled, {referenceVideo: 'clip.mp4', useSageAttention: false})
  assert.equal(disabled['16'], undefined)
  assert.deepEqual(disabled['18'].inputs.model, ['17', 0])
  for (const id of ['8', '10']) assert.deepEqual(disabled[id].inputs.model, ['18', 0])
  assert.equal(enabled['10'].inputs.steps, disabled['10'].inputs.steps)
  assert.equal(enabled['6'].inputs.length, disabled['6'].inputs.length)
  assert.deepEqual(enabled['2'], disabled['2'])
  assert.ok(!Object.values(enabled).some(n => ['EasyCache', 'SolAttnPatch'].includes(n.class_type)))
})

test('PDD acceleration stays off incompatible or already-distilled H3 flows', () => {
  const excludedWorkflowIds = [
    'minimax-h3-character-sheet',
    'minimax-h3-character-swap',
    'minimax-h3-360-orbit',
    'minimax-h3-handheld',
    'minimax-h3-gguf-i2v',
    'minimax-h3-pink-reference',
    'minimax-h3-aftermidnight-r2v',
    'minimax-h3-aftermidnight-3ref',
    'minimax-h3-naughty-times',
    'minimax-h3-nsfw-pink-bunny',
    'minimax-h3-nsfw-motion-8step',
    'fast-minimax-h3-t2va',
    'vdn-h3-t2va',
  ]
  for (const workflowId of excludedWorkflowIds) {
    const filenames = getWorkflowDependencyPack(workflowId).requiredModels.map(model => model.filename)
    assert.ok(!filenames.some(filename => /MiniMax-H3-(?:FL2VA|Ref2VA)-Acc-8Step|flashgen/i.test(filename)), workflowId)
  }
})

test('CANVAS uploads the complete video plus all eight images and configures the R2V graph', async (t) => {
  const doc = runtime.createFlowDocument({templateId: 'reference-video-to-video'})
  const video = doc.nodes.find(node => node.type === 'video-gen')
  const source = doc.nodes.find(node => node.data.assetRole === 'reference-video')
  source.data.assetId = 'video'
  const inputBytes = new Uint8Array([0, 1, 2, 3, 4, 5])
  const uploads = []
  globalThis.__h3Test = {
    assets: [{id: 'video', type: 'video', name: 'motion.mp4', url: 'test:video', duration: 12}],
    upload: async file => {uploads.push(file); return {name: `uploaded_${file.name}`}},
  }
  t.after(() => {delete globalThis.__h3Test})
  t.mock.method(globalThis, 'fetch', async url => new Response(inputBytes, {headers: {'Content-Type': url === 'test:video' ? 'video/mp4' : 'image/png'}}))
  const ref = doc.nodes.find(node => node.type === 'style-reference')
  for (let index = 0; index < 8; index++) {
    const node = index === 0 ? ref : runtime.createFlowNode('style-reference')
    node.data.assetId = `image${index}`
    globalThis.__h3Test.assets.push({id: node.data.assetId, type: 'image', name: `ref${index}.png`, url: `test:image${index}`})
    if (index > 0) {
      doc.nodes.push(node)
      doc.edges.push(runtime.createFlowEdge({source: node.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:style'}))
    }
  }
  const context = await runtime.buildExecutionContext(doc, video)
  assert.equal(context.useSageAttention, true)
  assert.equal(uploads.length, 9)
  assert.equal(uploads[0].name, 'motion.mp4')
  assert.deepEqual(new Uint8Array(await uploads[0].arrayBuffer()), inputBytes)
  assert.equal(context.referenceFilenames.length, 8)
  const configured = await runtime.configureWorkflow(video.data.workflowId, workflow, context)
  assert.equal(configured['1'].inputs.video, 'uploaded_motion.mp4')
  assert.equal(configured.h3_ref_7.inputs.image, 'uploaded_ref7.png')
  assert.equal(configured['6'].inputs.prompt, context.promptText)
  assert.equal(configured['16'].inputs.sage_attention, 'auto')
  // Existing saved documents lack the new field and must also get acceleration.
  delete video.data.useSageAttention
  assert.equal((await runtime.buildExecutionContext(doc, video)).useSageAttention, true)
  video.data.useSageAttention = false
  const standardContext = await runtime.buildExecutionContext(doc, video)
  const standardGraph = await runtime.configureWorkflow(video.data.workflowId, workflow, standardContext)
  assert.equal(standardGraph['16'], undefined)
  assert.equal(doc.edges.find(edge => edge.source === video.id).targetHandle, 'in:video')
  source.data.assetId = ''
  await assert.rejects(runtime.buildExecutionContext(doc, video), /Connect a reference video/)
  source.data.assetId = 'video'
  video.data.referenceStart = 11
  await assert.rejects(runtime.buildExecutionContext(doc, video), /at least two seconds/)
  assert.equal(uploads.length, 27, 'invalid references fail before upload')
  assert.equal(runtime.createFlowDocument({templateId: 'image-to-video'}).nodes.find(node => node.type === 'video-gen').data.workflowId, 'minimax-h3-gguf-i2v')
})

test('PinkFluffy reference graph uses the Ref2VA base, no Turbo, and covers setup dependencies', () => {
  assert.equal(pinkWorkflow['2'].inputs.model_name, 'minimax-h3-ref2va-Q4_0.gguf')
  assert.equal(pinkWorkflow['17'].inputs.lora_name, 'PinkFluffyBunny-unpruned-v2-rank128.safetensors')
  assert.deepEqual(pinkWorkflow['17'].inputs.model, ['2', 0])
  assert.deepEqual(pinkWorkflow['18'].inputs.model, ['17', 0])
  assert.deepEqual(pinkWorkflow['19'].inputs.model, ['18', 0])
  assert.deepEqual(pinkWorkflow['8'].inputs.model, ['19', 0])
  assert.deepEqual(pinkWorkflow['10'].inputs.model, ['19', 0])
  assert.equal(pinkWorkflow['10'].inputs.steps, 20)
  assert.ok(!JSON.stringify(pinkWorkflow).toLowerCase().includes('turbo'))
  const pack = getWorkflowDependencyPack('minimax-h3-pink-reference')
  for (const node of Object.values(pinkWorkflow)) {
    assert.ok(pack.requiredNodes.some(entry => entry.classType === node.class_type), node.class_type)
    for (const key of ['model_name', 'clip_name', 'mmproj_name', 'vae_name', 'lora_name']) {
      if (node.inputs[key]) assert.ok(pack.requiredModels.some(entry => entry.filename === node.inputs[key]), node.inputs[key])
    }
  }
  for (const model of pack.requiredModels) {
    const recipe = getModelInstallInfo(model)
    assert.ok(recipe.downloadUrl, model.filename)
    if (recipe.sha256) assert.match(recipe.sha256, /^[a-f0-9]{64}$/)
    if (recipe.sizeBytes) assert.ok(recipe.sizeBytes > 0)
  }
})

test('Character Swap reproduces the published beginner recipe and hard-limits shots to 4-5 seconds', async t => {
  assert.equal(characterSwapWorkflow['2'].inputs.model_name, 'minimax-h3-ref2va-Q4_0.gguf')
  assert.equal(characterSwapWorkflow['17'].inputs.lora_name, 'h3_character_swap_pro4500_1000.safetensors')
  assert.equal(characterSwapWorkflow['17'].inputs.strength_model, 1)
  assert.ok(!JSON.stringify(characterSwapWorkflow).toLowerCase().includes('turbo'))

  const pack = getWorkflowDependencyPack('minimax-h3-character-swap')
  const lora = pack.requiredModels.find(model => model.targetSubdir === 'loras')
  const recipe = getModelInstallInfo(lora)
  assert.equal(lora.filename, 'h3_character_swap_pro4500_1000.safetensors')
  assert.equal(recipe.sizeBytes, 155110320)
  assert.equal(recipe.sha256, '4b2a3f420ae804c0aa3422761ff84dbd1bf52eef6900ffab6d2e66df63cb4e79')
  assert.ok(!pack.requiredNodes.some(node => node.classType === 'PathchSageAttentionKJ'))

  const doc = runtime.createFlowDocument({templateId: 'minimax-h3-character-swap'})
  const video = doc.nodes.find(node => node.type === 'video-gen')
  const source = doc.nodes.find(node => node.data.assetRole === 'reference-video')
  const character = doc.nodes.find(node => node.data.assetRole === 'character-swap-image')
  assert.equal(video.data.workflowId, 'minimax-h3-character-swap')
  assert.equal(video.data.useSageAttention, false)
  source.data.assetId = 'shot'
  character.data.assetId = 'character'
  video.data.duration = 4
  video.data.referenceDuration = 4
  globalThis.__h3Test = {
    assets: [
      {id: 'shot', type: 'video', name: 'shot.mp4', url: 'test:shot', duration: 4.5},
      {id: 'character', type: 'image', name: 'character.png', url: 'test:character'},
    ],
    upload: async file => ({name: `uploaded_${file.name}`}),
  }
  t.after(() => { delete globalThis.__h3Test })
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([7, 8, 9])))

  const context = await runtime.buildExecutionContext(doc, video)
  assert.equal(context.duration, 4)
  assert.equal(context.referenceDuration, 4)
  assert.equal(context.referenceFilenames.length, 1)
  const configured = await runtime.configureWorkflow(video.data.workflowId, characterSwapWorkflow, context)
  assert.equal(configured['18'], undefined)
  assert.deepEqual(configured['19'].inputs.model, ['17', 0])
  assert.equal(configured['1'].inputs.frame_load_cap, 96)
  assert.equal(configured['6'].inputs.length, 107)
  assert.match(configured['6'].inputs.prompt, /<Video 1>/)
  assert.match(configured['6'].inputs.prompt, /<Picture 1>/)

  video.data.duration = 99
  video.data.referenceDuration = 99
  const capped = await runtime.buildExecutionContext(doc, video)
  assert.equal(capped.duration, 5)
  assert.equal(capped.referenceDuration, 5)

  character.data.assetId = ''
  await assert.rejects(runtime.buildExecutionContext(doc, video), /exactly one replacement-character image/)
})

test('PinkFluffy CANVAS template uploads reference video and routes LoRA through optional SageAttention', async t => {
  const doc = runtime.createFlowDocument({templateId: 'nsfw-minimax-h3-pink-reference'})
  const video = doc.nodes.find(node => node.type === 'video-gen')
  const source = doc.nodes.find(node => node.data.assetRole === 'reference-video')
  const image = doc.nodes.find(node => node.type === 'style-reference')
  assert.equal(video.data.workflowId, 'minimax-h3-pink-reference')
  source.data.assetId = 'motion'
  image.data.assetId = 'face'
  globalThis.__h3Test = {
    assets: [
      {id: 'motion', type: 'video', name: 'motion.mp4', url: 'test:motion', duration: 8},
      {id: 'face', type: 'image', name: 'face.png', url: 'test:face'},
    ],
    upload: async file => ({name: `uploaded_${file.name}`}),
  }
  t.after(() => { delete globalThis.__h3Test })
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1, 2, 3])))
  const context = await runtime.buildExecutionContext(doc, video)
  const enabled = await runtime.configureWorkflow(video.data.workflowId, pinkWorkflow, context)
  assert.equal(enabled['1'].inputs.video, 'uploaded_motion.mp4')
  assert.equal(enabled.pink_h3_ref_0.inputs.image, 'uploaded_face.png')
  assert.equal(enabled['6'].inputs.ref_image_size, 'max')
  assert.match(enabled['6'].inputs.prompt, /<Picture 1>/)
  assert.deepEqual(enabled['18'].inputs.model, ['17', 0])
  assert.deepEqual(enabled['19'].inputs.model, ['18', 0])
  video.data.useSageAttention = false
  const disabledContext = await runtime.buildExecutionContext(doc, video)
  const disabled = await runtime.configureWorkflow(video.data.workflowId, pinkWorkflow, disabledContext)
  assert.equal(disabled['18'], undefined)
  assert.deepEqual(disabled['19'].inputs.model, ['17', 0])
  const direct = configurePink(enabled, {referenceVideo: 'next.mp4', referenceImages: [], useSageAttention: false})
  assert.ok(!Object.keys(direct).some(id => id.startsWith('pink_h3_ref_')))
})

test('AfterMidnightR2V preserves the author-required Ref2VA, Euler, beta and sexytime v1.2 recipe', async t => {
  assert.equal(afterMidnightWorkflow['2'].inputs.model_name, 'minimax-h3-ref2va-Q4_0.gguf')
  assert.equal(afterMidnightWorkflow['9'].inputs.sampler_name, 'euler')
  assert.equal(afterMidnightWorkflow['10'].inputs.scheduler, 'beta')
  assert.equal(afterMidnightWorkflow['10'].inputs.steps, 20)
  assert.equal(afterMidnightWorkflow['17'].inputs.lora_name, 'AfterMidnight_ref2va_h3_sexytime_rank64-v1.2.safetensors')
  assert.equal(afterMidnightWorkflow['17'].inputs.strength_model, 1)
  assert.ok(!JSON.stringify(afterMidnightWorkflow).toLowerCase().includes('turbo'))

  const pack = getWorkflowDependencyPack('minimax-h3-aftermidnight-r2v')
  const lora = pack.requiredModels.find(model => model.targetSubdir === 'loras')
  assert.equal(lora.filename, 'AfterMidnight_ref2va_h3_sexytime_rank64-v1.2.safetensors')
  const recipe = getModelInstallInfo(lora)
  assert.equal(recipe.sizeBytes, 1192828320)
  assert.equal(recipe.sha256, '82226a7c7f0b4631092f9270fa33d078c985a2d757895fcbe8f3fca8881bef59')

  const doc = runtime.createFlowDocument({templateId: 'nsfw-minimax-h3-aftermidnight-r2v'})
  const video = doc.nodes.find(node => node.type === 'video-gen')
  const source = doc.nodes.find(node => node.data.assetRole === 'reference-video')
  const image = doc.nodes.find(node => node.type === 'style-reference')
  assert.equal(video.data.workflowId, 'minimax-h3-aftermidnight-r2v')
  source.data.assetId = 'motion'
  image.data.assetId = 'identity'
  const uploads = []
  globalThis.__h3Test = {
    assets: [
      {id: 'motion', type: 'video', name: 'motion.mp4', url: 'test:motion', duration: 8},
      {id: 'motion-replacement', type: 'video', name: 'motion.mp4', url: 'test:motion-replacement', duration: 8},
      {id: 'identity', type: 'image', name: 'identity.png', url: 'test:identity'},
      {id: 'identity-replacement', type: 'image', name: 'identity.png', url: 'test:identity-replacement'},
    ],
    upload: async (file, filename) => {
      uploads.push({file, filename})
      return {name: filename || `uploaded_${file.name}`}
    },
  }
  t.after(() => { delete globalThis.__h3Test })
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([4, 5, 6])))
  const context = await runtime.buildExecutionContext(doc, video)
  const visiblePrompt = doc.nodes.find(node => node.type === 'prompt')
  assert.equal(visiblePrompt.data.promptText, '1girl, adult, naked')
  assert.doesNotMatch(visiblePrompt.data.promptText, /Replace the primary subject/)
  assert.match(visiblePrompt.data.basePrompt, /Replace the primary subject/)
  assert.match(context.promptText, /Replace the primary subject/)
  assert.match(context.promptText, /Perform the referenced action/)
  assert.match(context.promptText, /1girl, adult, naked/)
  assert.match(context.referenceVideoFilename, /^canvas_ref_video_motion_/)
  assert.match(context.referenceFilenames[0], /^canvas_ref_image_identity_/)
  const configured = await runtime.configureWorkflow(video.data.workflowId, afterMidnightWorkflow, context)
  assert.equal(configured['1'].inputs.video, context.referenceVideoFilename)
  assert.equal(configured.aftermidnight_h3_ref_0.inputs.image, context.referenceFilenames[0])
  assert.match(configured['6'].inputs.prompt, /<Picture 1>/)
  assert.match(configured['6'].inputs.prompt, /<Video 1>/)
  assert.match(configured['6'].inputs.prompt, /do not copy the original subject's appearance/)
  assert.doesNotMatch(configured['6'].inputs.prompt, /Describe the intended adult scene/)
  assert.equal(configured['6'].inputs.ref_image_size, 'max')
  assert.equal(configured['9'].inputs.sampler_name, 'euler')
  assert.equal(configured['10'].inputs.scheduler, 'beta')

  source.data.assetId = 'motion-replacement'
  const replacementContext = await runtime.buildExecutionContext(doc, video)
  assert.match(replacementContext.referenceVideoFilename, /^canvas_ref_video_motion-replacement_/)
  assert.notEqual(replacementContext.referenceVideoFilename, context.referenceVideoFilename)
  const replacementGraph = await runtime.configureWorkflow(video.data.workflowId, afterMidnightWorkflow, replacementContext)
  assert.equal(replacementGraph['1'].inputs.video, replacementContext.referenceVideoFilename)
  assert.equal(uploads.filter(entry => entry.filename?.startsWith('canvas_ref_video_')).length, 2)

  image.data.assetId = 'identity-replacement'
  const replacementImageContext = await runtime.buildExecutionContext(doc, video)
  assert.match(replacementImageContext.referenceFilenames[0], /^canvas_ref_image_identity-replacement_/)
  assert.notEqual(replacementImageContext.referenceFilenames[0], replacementContext.referenceFilenames[0])
  const replacementImageGraph = await runtime.configureWorkflow(video.data.workflowId, afterMidnightWorkflow, replacementImageContext)
  assert.equal(replacementImageGraph.aftermidnight_h3_ref_0.inputs.image, replacementImageContext.referenceFilenames[0])
  assert.equal(uploads.filter(entry => entry.filename?.startsWith('canvas_ref_image_')).length, 3)

  const legacy = structuredClone(doc)
  const legacyPrompt = legacy.nodes.find(node => node.type === 'prompt')
  legacyPrompt.data.promptText = 'Perform the referenced action naturally and coherently.'
  legacyPrompt.data.basePrompt = 'Old internal instructions.'
  delete legacyPrompt.data.labelKey
  delete legacyPrompt.data.promptRole
  const upgraded = runtime.normalizeFlowDocument(legacy)
  const upgradedPrompt = upgraded.nodes.find(node => node.data.promptRole === 'aftermidnight-content')
  assert.equal(upgradedPrompt.data.promptText, '1girl, adult, naked')
  assert.match(upgradedPrompt.data.basePrompt, /Perform the referenced action naturally and coherently/)

  const customPrompt = configurePink(afterMidnightWorkflow, {
    referenceVideo: 'motion.mp4', referenceImages: ['identity.png'], prompt: 'A neon-lit hotel room.',
  })['6'].inputs.prompt
  assert.match(customPrompt, /<Picture 1>/)
  assert.match(customPrompt, /<Video 1>/)
  assert.match(customPrompt, /A neon-lit hotel room/)
  const twoReferences = configurePink(afterMidnightWorkflow, {
    referenceVideo: 'motion.mp4', referenceImages: ['identity.png', 'costume.png'], prompt: '<Picture 1> performs the action from <Video 1>.',
  })['6'].inputs.prompt
  assert.match(twoReferences, /<Picture 2>/)
  const videoOnly = configurePink(afterMidnightWorkflow, {
    referenceVideo: 'motion.mp4', referenceImages: [], prompt: afterMidnightWorkflow['6'].inputs.prompt,
  })['6'].inputs.prompt
  assert.doesNotMatch(videoOnly, /<Picture 1>/)
})

test('NSFW three-reference flow keeps scene, character sheet, and optional props in fixed picture order', async t => {
  const doc = runtime.createFlowDocument({templateId: 'nsfw-minimax-h3-scene-character-props'})
  const video = doc.nodes.find(node => node.data.workflowId === 'minimax-h3-aftermidnight-3ref')
  const scene = doc.nodes.find(node => node.data.assetRole === 'scene-reference')
  const character = doc.nodes.find(node => node.data.assetRole === 'character-sheet-reference')
  const props = doc.nodes.find(node => node.data.assetRole === 'props-stage-reference')
  const prompt = doc.nodes.find(node => node.data.promptRole === 'h3-three-reference-content')
  assert.ok(video && scene && character && props && prompt)
  assert.match(prompt.data.basePrompt, /<Picture 1> as the scene/)
  assert.match(prompt.data.basePrompt, /<Picture 2> as the exact adult character identity/)
  assert.match(prompt.data.basePrompt, /<Picture 3> is supplied/)
  assert.equal(prompt.data.promptText, '1girl, adult, naked')

  scene.data.assetId = 'scene'
  character.data.assetId = 'character'
  globalThis.__h3Test = {
    assets: [
      {id: 'scene', type: 'image', name: 'scene.png', url: 'test:scene'},
      {id: 'character', type: 'image', name: 'character-sheet.png', url: 'test:character'},
      {id: 'props', type: 'image', name: 'props.png', url: 'test:props'},
    ],
    upload: async (file, filename) => ({name: filename || file.name}),
  }
  t.after(() => { delete globalThis.__h3Test })
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([7, 8, 9])))

  const requiredOnlyContext = await runtime.buildExecutionContext(doc, video)
  assert.equal(requiredOnlyContext.referenceFilenames.length, 2)
  const requiredOnlyGraph = await runtime.configureWorkflow(video.data.workflowId, afterMidnightWorkflow, requiredOnlyContext)
  assert.equal(requiredOnlyGraph['1'], undefined)
  assert.equal(requiredOnlyGraph.aftermidnight_h3_ref_0.inputs.image, requiredOnlyContext.referenceFilenames[0])
  assert.equal(requiredOnlyGraph.aftermidnight_h3_ref_1.inputs.image, requiredOnlyContext.referenceFilenames[1])
  assert.equal(requiredOnlyGraph.aftermidnight_h3_ref_2, undefined)
  assert.equal(requiredOnlyGraph['6'].inputs['ref_videos.ref_video_0'], undefined)

  props.data.assetId = 'props'
  const fullContext = await runtime.buildExecutionContext(doc, video)
  assert.equal(fullContext.referenceFilenames.length, 3)
  const fullGraph = await runtime.configureWorkflow(video.data.workflowId, afterMidnightWorkflow, fullContext)
  assert.equal(fullGraph.aftermidnight_h3_ref_2.inputs.image, fullContext.referenceFilenames[2])

  character.data.assetId = ''
  await assert.rejects(runtime.buildExecutionContext(doc, video), /scene image and character sheet/)
})

test('anime endpoint templates extract one source video into first/last image edits and expose both video strategies', () => {
  const endpoint = runtime.createFlowDocument({templateId: 'nsfw-anime-endpoints-flf2v'})
  const endpointSource = endpoint.nodes.find(node => node.data.assetRole === 'endpoint-video')
  const endpointImages = endpoint.nodes.filter(node => node.type === 'image-gen')
  const endpointVideo = endpoint.nodes.find(node => node.type === 'video-gen')
  assert.ok(endpointSource)
  assert.equal(endpointSource.data.labelKey, 'canvas.nodes.video-input.label')
  assert.deepEqual(endpointSource.data.acceptedAssetTypes, ['video'])
  assert.equal(endpointImages.length, 2)
  assert.deepEqual(endpointImages.map(node => node.data.frameTimeMode).sort(), ['first', 'last'])
  assert.ok(endpointImages.every(node => node.data.workflowId === 'image-edit' && node.data.variantCount === 1))
  assert.equal(endpointVideo.data.workflowId, 'minimax-h3-nsfw-pink-bunny')
  assert.equal(endpointVideo.data.requiresLastFrame, true)
  assert.ok(endpoint.edges.some(edge => edge.source === endpointImages[0].id && edge.target === endpointVideo.id && edge.targetHandle === 'in:image'))
  assert.ok(endpoint.edges.some(edge => edge.source === endpointImages[1].id && edge.target === endpointVideo.id && edge.targetHandle === 'in:last-image'))
  assert.equal(endpoint.edges.filter(edge => edge.source === endpointSource.id && edge.targetHandle === 'in:image').length, 2)

  const motion = runtime.createFlowDocument({templateId: 'nsfw-anime-endpoints-r2v'})
  const motionSource = motion.nodes.find(node => node.data.assetRole === 'endpoint-video')
  const motionImages = motion.nodes.filter(node => node.type === 'image-gen')
  const motionVideo = motion.nodes.find(node => node.type === 'video-gen')
  assert.equal(motionVideo.data.workflowId, 'minimax-h3-aftermidnight-r2v')
  assert.ok(motion.edges.some(edge => edge.source === motionSource.id && edge.target === motionVideo.id && edge.targetHandle === 'in:video'))
  assert.equal(motion.edges.filter(edge => motionImages.some(node => node.id === edge.source) && edge.target === motionVideo.id && edge.targetHandle === 'in:style').length, 2)
  const prompt = motion.nodes.find(node => node.data.promptRole === 'anime-endpoint-content')
  assert.equal(prompt.data.promptText, '1girl, adult, naked')
  assert.match(prompt.data.basePrompt, /<Picture 1>/)
  assert.match(prompt.data.basePrompt, /<Picture 2>/)
  assert.match(prompt.data.basePrompt, /<Video 1>/)
  assert.match(prompt.data.basePrompt, /Perform the referenced action naturally and coherently/)

  const legacy = structuredClone(motion)
  const legacyPrompt = legacy.nodes.find(node => node.data.promptRole === 'anime-endpoint-content')
  legacyPrompt.data.label = 'Motion / Camera / Scene Direction'
  legacyPrompt.data.promptText = 'Follow the source performance and camera path while rendering a coherent anime scene.'
  legacyPrompt.data.basePrompt = 'Old internal reference instructions.'
  delete legacyPrompt.data.labelKey
  delete legacyPrompt.data.promptRole
  const upgraded = runtime.normalizeFlowDocument(legacy)
  const upgradedPrompt = upgraded.nodes.find(node => node.data.promptRole === 'anime-endpoint-content')
  assert.equal(upgradedPrompt.data.promptText, '1girl, adult, naked')
  assert.match(upgradedPrompt.data.basePrompt, /<Video 1>/)
})

test('endpoint frame timing resolves the actual first and final source frames', () => {
  const asset = {duration: 8, settings: {fps: 25}}
  assert.equal(runtime.resolveVideoFrameTime({data: {frameTimeMode: 'first'}}, asset), 0)
  assert.equal(runtime.resolveVideoFrameTime({data: {frameTimeMode: 'last'}}, asset), 7.96)
  assert.equal(runtime.resolveVideoFrameTime({data: {frameTime: 1.25}}, asset), 1.25)
  assert.equal(runtime.resolveVideoFrameTime({data: {frameTimeMode: 'last'}}, {}), Number.MAX_SAFE_INTEGER)
})

test('CANVAS node mute defaults off, persists, and passes compatible intermediate assets through', t => {
  const source = runtime.createFlowNode('image-input')
  source.data.assetId = 'source-image'
  const edit = runtime.createFlowNode('image-gen', {data: {muted: true, workflowId: 'image-edit'}})
  const video = runtime.createFlowNode('video-gen', {data: {muted: true, workflowId: 'minimax-h3-nsfw-pink-bunny'}})
  const output = runtime.createFlowNode('output', {data: {muted: true}})
  const document = {
    nodes: [source, edit, video, output],
    edges: [
      runtime.createFlowEdge({source: source.id, sourceHandle: 'out:image', target: edit.id, targetHandle: 'in:image'}),
      runtime.createFlowEdge({source: edit.id, sourceHandle: 'out:image', target: video.id, targetHandle: 'in:image'}),
      runtime.createFlowEdge({source: video.id, sourceHandle: 'out:video', target: output.id, targetHandle: 'in:video'}),
    ],
  }
  globalThis.__h3Test = {assets: [{id: 'source-image', type: 'image', name: 'source.png', url: 'test:source'}]}
  t.after(() => { delete globalThis.__h3Test })

  assert.equal(runtime.createFlowNode('image-gen').data.muted, false)
  assert.equal(runtime.normalizeFlowDocument({nodes: [edit], edges: []}).nodes[0].data.muted, true)
  assert.deepEqual(runtime.resolveMutedNodePassthrough(document, edit).outputAssetIds, ['source-image'])
  assert.deepEqual(runtime.resolveMutedNodePassthrough(document, video).outputAssetIds, [], 'an image cannot pass through a video output')
})

test('muted text processors pass input text through while muted source prompts emit nothing', () => {
  const prompt = runtime.createFlowNode('prompt', {data: {basePrompt: 'base', promptText: 'visible'}})
  const helper = runtime.createFlowNode('prompt-assist', {data: {muted: true, outputText: 'stale generated text'}})
  const mutedPrompt = runtime.createFlowNode('prompt', {data: {muted: true, promptText: 'hidden'}})
  const doc = {
    nodes: [prompt, helper, mutedPrompt],
    edges: [runtime.createFlowEdge({source: prompt.id, sourceHandle: 'out:text', target: helper.id, targetHandle: 'in:text'})],
  }
  assert.equal(runtime.resolveMutedNodePassthrough(doc, helper).outputText, 'base\n\nvisible')
  assert.equal(runtime.resolveMutedNodePassthrough(doc, mutedPrompt).outputText, '')
})

const fastWorkflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_fast_minimax_h3_t2va.json', import.meta.url)))
const {modifyFastMinimaxH3Workflow: fast, FAST_H3_SIGMAS} = await import('../src/services/fastMinimaxH3Workflow.mjs')

test('Fast H3 preserves the source model, native audio, Euler and published schedules', () => {
  const pack = getWorkflowDependencyPack('fast-minimax-h3-t2va')
  for (const steps of [4, 6, 8]) {
    const graph = fast(fastWorkflow, {steps, seed: 42})
    assert.equal(graph['10'].inputs.sigmas, FAST_H3_SIGMAS[steps])
    assert.equal(graph['10'].inputs.sigmas.split(',').length, steps + 1)
    assert.equal(graph['9'].inputs.sampler_name, 'euler')
    assert.equal(graph['2'].inputs.sage_attention, 'auto')
    assert.equal(graph['2'].inputs.model_name, 'minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors')
    assert.deepEqual(graph['14'].inputs.audio, ['13', 0])
    assert.equal(graph['7'].inputs.noise_seed, 42)
    for (const node of Object.values(graph)) {
      assert.ok(pack.requiredNodes.some(entry => entry.classType === node.class_type), node.class_type)
      for (const key of ['model_name', 'clip_name', 'vae_name']) {
        if (node.inputs[key]) assert.ok(pack.requiredModels.some(entry => entry.filename === node.inputs[key]), node.inputs[key])
      }
    }
  }
  for (const model of pack.requiredModels) {
    const recipe = getModelInstallInfo(model)
    assert.ok(recipe.downloadUrl, model.filename)
    assert.match(recipe.sha256, /^[a-f0-9]{64}$/)
    assert.ok(recipe.sizeBytes > 0)
  }
})

test('Fast H3 removes stale references and rejects more than two per kind', () => {
  const graph = fast(fastWorkflow, {referenceImages: ['one.png','two.png'], referenceAudio: ['voice.wav','ambience.mp3']})
  assert.deepEqual(graph['6'].inputs['ref_audios.ref_audio_1'], ['fast_ref_audio_1',0])
  assert.equal(graph.fast_ref_audio_1.inputs.audio, 'ambience.mp3')
  const empty = fast(graph, {})
  assert.ok(!Object.keys(empty).some(id => id.startsWith('fast_ref_')))
  assert.ok(!Object.keys(empty['6'].inputs).some(key => key.startsWith('ref_audios.') || key.startsWith('ref_images.')))
  assert.throws(() => fast(graph, {referenceAudio: ['a','b','c']}), /two/)
  assert.throws(() => fast(graph, {referenceImages: ['a','b','c']}), /two/)
  assert.equal(fastWorkflow.fast_ref_audio_1, undefined)
})

test('CANVAS Fast H3 runs text-only or uploads two images and two complete audio files', async t => {
  const doc = runtime.createFlowDocument({templateId: 'fast-minimax-h3-t2va'})
  const video = doc.nodes.find(n => n.type === 'video-gen')
  const audios = doc.nodes.filter(n => n.data.assetRole === 'reference-audio')
  const images = doc.nodes.filter(n => n.type === 'style-reference')
  assert.equal(audios.length, 2)
  assert.equal(images.length, 2)
  assert.equal(doc.edges.filter(e => e.targetHandle === 'in:voice').length, 2)
  const uploads = []
  globalThis.__h3Test = {assets: [], upload: async file => {uploads.push(file);return {name: 'uploaded_' + file.name}}}
  t.after(() => {delete globalThis.__h3Test})
  const bytes = new Uint8Array([9,8,7,6])
  t.mock.method(globalThis, 'fetch', async () => new Response(bytes))
  let context = await runtime.buildExecutionContext(doc, video)
  assert.equal(context.width, 864)
  assert.equal(context.fastH3Steps, 4)
  assert.equal(uploads.length, 0)
  let graph = await runtime.configureWorkflow(video.data.workflowId, fastWorkflow, context)
  assert.equal(graph['6'].inputs.length, 124)
  assert.equal(graph['6'].inputs.prompt, context.promptText)
  for (const [kind, nodes, ext] of [['audio',audios,'.mp3'],['image',images,'.png']]) {
    nodes.forEach((node,index) => {
      node.data.assetId = kind + index
      globalThis.__h3Test.assets.push({id: node.data.assetId, type: kind, name: node.data.assetId + ext, url: 'test:' + node.data.assetId})
    })
  }
  video.data.fastH3Steps = 8
  context = await runtime.buildExecutionContext(doc, video)
  graph = await runtime.configureWorkflow(video.data.workflowId, fastWorkflow, context)
  assert.equal(context.referenceAudioFilenames.length, 2)
  assert.equal(context.referenceFilenames.length, 2)
  assert.equal(uploads.length, 4)
  assert.equal(graph.fast_ref_audio_1.inputs.audio, 'uploaded_audio1.mp3')
  assert.equal(graph.fast_ref_image_1.inputs.image, 'uploaded_image1.png')
  assert.equal(graph['10'].inputs.sigmas, FAST_H3_SIGMAS[8])
  for (const file of uploads) assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes)
})

const vdnWorkflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_vdn_h3_t2va.json', import.meta.url)))
const {modifyVdnH3Workflow: vdn} = await import('../src/services/vdnH3Workflow.mjs')

test('VDN uses its own plain base and 8-step adapters without SOL or community Turbo', () => {
  const graph = vdn(vdnWorkflow, {prompt: 'drama scene', duration: 10, seed: 123})
  assert.equal(graph['2'].inputs.unet_name, 'minimax_h3_fl2va_int8_convrot.safetensors')
  assert.deepEqual(graph['8'].inputs.model, ['16',0])
  assert.deepEqual(graph['10'].inputs.model, ['16',0])
  assert.equal(graph['16'].inputs.vdn_checkpoint, 'stage-dmd-step-250')
  assert.equal(graph['16'].inputs.apply_turbo_adapter, true)
  assert.equal(graph['16'].inputs.branch_weights, 'stream')
  assert.equal(graph['16'].inputs.lora_mode, 'merge')
  assert.equal(graph['16'].inputs.attention_backend, 'grouped')
  assert.equal(graph['9'].inputs.sampler_name, 'er_sde')
  assert.equal(graph['10'].inputs.scheduler, 'beta')
  assert.equal(graph['10'].inputs.steps, 8)
  assert.deepEqual(graph['14'].inputs.audio, ['13',0])
  assert.equal(graph['6'].inputs.length, 243)
  assert.equal(graph['7'].inputs.noise_seed, 123)
  assert.equal(graph['6'].inputs.prompt, 'drama scene')
  assert.ok(!Object.values(graph).some(n => /Sage|SolAttn|LoraLoader/.test(n.class_type)))
  for (const seconds of [0.1, 5, 10, 15, 600]) {
    const length = vdn(vdnWorkflow,{duration:seconds})['6'].inputs.length
    assert.equal(length % 17,5)
    assert.ok(length >= 124 && length <= 362)
  }
  const pack = getWorkflowDependencyPack('vdn-h3-t2va')
  for (const node of Object.values(graph)) assert.ok(pack.requiredNodes.some(n=>n.classType===node.class_type))
  for (const file of pack.requiredModels) {
    const recipe = getModelInstallInfo(file)
    assert.ok(recipe.downloadUrl, file.filename)
    assert.match(recipe.sha256, /^[a-f0-9]{64}$/)
  }
  assert.equal(pack.requiredModels.filter(m=>m.exactPath).length,8)
  assert.equal(vdnWorkflow['6'].inputs.length,124)
})

test('CANVAS VDN starts from text alone and configures the dedicated graph', async t => {
  globalThis.__h3Test = {assets: [], upload: () => {throw Error('No input uploads expected')}}
  t.after(()=>{delete globalThis.__h3Test})
  const doc = runtime.createFlowDocument({templateId:'vdn-h3-t2va'})
  assert.equal(doc.nodes.length,3)
  assert.equal(doc.edges.length,2)
  const video = doc.nodes.find(n=>n.type==='video-gen')
  video.data.duration=15
  const ctx = await runtime.buildExecutionContext(doc,video)
  const graph = await runtime.configureWorkflow(video.data.workflowId,vdnWorkflow,ctx)
  assert.equal(graph['6'].inputs.width,608)
  assert.equal(graph['6'].inputs.height,352)
  assert.equal(graph['6'].inputs.length,362)
  assert.equal(graph['6'].inputs.prompt,ctx.promptText)
  assert.equal(graph['15'].inputs.filename_prefix,ctx.outputPrefix)
})
