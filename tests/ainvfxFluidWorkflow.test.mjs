import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { modifyAinvfxFluidWorkflow as configure, validateAinvfxFluidSettings } from '../src/services/ainvfxFluidWorkflow.mjs'
import { getModelInstallInfo, getNodeInstallInfo } from '../src/config/workflowInstallCatalog.js'
import { getWorkflowDependencyPack } from '../src/config/workflowDependencyPacks.js'

const workflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_ainvfx_fluid.json', import.meta.url)))
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
  './fileSystem': unused('importAsset,isElectron'),
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
    contents: runtimeSource + '\nexport {buildExecutionContext, configureWorkflow}; export {createFlowDocument, createFlowNode, createFlowEdge} from "./flowAiSchema";',
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

test('distilled graph keeps 119 black frames between two keyframes and crops IC guides', () => {
  const graph = configure(workflow, { firstFrame: 'first.png', lastFrame: 'last.png' })
  assert.equal(graph.black.inputs.batch_size, 119)
  assert.equal(graph.black.inputs.color, 0)
  assert.deepEqual(graph.first_black.inputs, { image1: ['first_size', 0], image2: ['black', 0] })
  assert.deepEqual(graph.control.inputs, { image1: ['first_black', 0], image2: ['last_size', 0] })
  assert.deepEqual(graph.guide.inputs.latent_downscale_factor, ['lora', 1])
  assert.deepEqual(graph.decode.inputs.samples, ['crop', 2])
  assert.deepEqual(graph.av.inputs.audio_latent, ['audio_ref', 2])
  assert.deepEqual(graph.video.inputs.audio, ['audio_decode', 0])
  assert.equal(graph.sigmas.inputs.sigmas.split(',').length, 9)
  assert.equal(graph.guider.inputs.cfg, 1)
  assert.equal(graph.sampler.inputs.sampler_name, 'euler_ancestral')
  assert.equal(graph.guide.inputs.frame_idx, 0)
  assert.ok(!Object.values(graph).some(n => /Painter|Switch|TextGenerate|API|ImgToVideo/.test(n.class_type)))
  for (const n of Object.values(graph)) for (const input of Object.values(n.inputs)) {
    if (Array.isArray(input)) assert.ok(graph[input[0]], `Dangling link ${input}`)
  }
})

test('all supported FPS values preserve frame count and synchronize silent audio/output', () => {
  for (const fps of [24, 25, 50]) {
    const graph = configure(workflow, { firstFrame: 'a.png', lastFrame: 'b.png', width: 960, height: 512, fps, seed: 0, strength: 0, prompt: 'fire', negativePrompt: 'custom negative' })
    assert.equal(graph.latent.inputs.length, 121)
    assert.equal(graph.black.inputs.batch_size, 119)
    assert.equal(graph.silence.inputs.duration, 121 / fps)
    assert.equal(graph.conditioning.inputs.frame_rate, fps)
    assert.equal(graph.video.inputs.fps, fps)
    for (const id of ['first_size', 'last_size', 'black', 'latent']) assert.equal(graph[id].inputs.width, 960)
    assert.equal(graph.lora.inputs.strength_model, 0)
    assert.equal(graph.noise.inputs.noise_seed, 0)
    assert.equal(graph.positive.inputs.text, 'ainvfxfluid, fire')
    assert.equal(graph.negative.inputs.text, 'custom negative')
  }
  assert.equal(configure(workflow, { firstFrame: 'a', lastFrame: 'b', prompt: 'ainvfxfluid, steam' }).positive.inputs.text, 'ainvfxfluid, steam')
  assert.equal(workflow.first.inputs.image, 'ainvfx_first.png')
})

test('invalid keyframes and geometry fail explicitly', () => {
  for (const settings of [{ width: 513 }, { height: 720 }, { width: Infinity }, { height: 0 }, { fps: 30 }, { fps: NaN }]) {
    assert.throws(() => validateAinvfxFluidSettings(settings))
  }
  assert.throws(() => configure(workflow, { firstFrame: 'a' }), /both painted/)
  assert.throws(() => configure(workflow, { firstFrame: 'a', lastFrame: 'b', strength: -1 }), /strength/)
  assert.throws(() => configure(workflow, { firstFrame: 'a', lastFrame: 'b', seed: -1 }), /Seed/)
})

test('Workflow Setup covers every node and pins every model download and checksum', () => {
  const pack = getWorkflowDependencyPack('ainvfx-fluid')
  for (const n of Object.values(workflow)) {
    assert.ok(pack.requiredNodes.some(entry => entry.classType === n.class_type), n.class_type)
    assert.notEqual(getNodeInstallInfo(n.class_type).kind, 'manual', n.class_type)
    for (const key of ['unet_name', 'clip_name', 'vae_name', 'lora_name']) {
      if (n.inputs[key]) assert.ok(pack.requiredModels.some(m => m.filename === n.inputs[key]))
    }
  }
  assert.equal(pack.requiredModels.length, 5)
  for (const model of pack.requiredModels) {
    const recipe = getModelInstallInfo(model)
    assert.match(recipe.downloadUrl, /resolve\/[a-f0-9]{40}\//)
    assert.match(recipe.sha256, /^[a-f0-9]{64}$/)
    assert.ok(recipe.sizeBytes > 0)
  }
  const gatedBaseModels = pack.requiredModels.filter(model => model.filename !== 'ainvfx-fluid.safetensors')
  assert.equal(gatedBaseModels.length, 4)
  for (const model of gatedBaseModels) {
    assert.equal(getModelInstallInfo(model).requiresAccessApproval, true)
  }
  assert.match(pack.requiredModels.find(m => m.classType === 'UNETLoader').notes, /access approval/)
})

test('CANVAS uploads both keyframes and wires its editable controls into the executable graph', async t => {
  const doc = runtime.createFlowDocument({ templateId: 'ainvfx-fluid' })
  const inputs = doc.nodes.filter(n => n.data.assetRole === 'fluid-keyframe')
  const video = doc.nodes.find(n => n.type === 'video-gen')
  assert.equal(inputs.length, 2)
  const uploads = []
  globalThis.__h3Test = {
    assets: inputs.map((n, index) => { n.data.assetId = `paint${index}`; return { id: n.data.assetId, type: 'image', name: `frame${index}.png`, url: `test:frame${index}` } }),
    upload: async (file, name) => { uploads.push(file); return { name: `uploaded_${name || file.name}` } },
  }
  t.after(() => { delete globalThis.__h3Test })
  t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } }))
  const context = await runtime.buildExecutionContext(doc, video)
  const graph = await runtime.configureWorkflow('ainvfx-fluid', workflow, context)
  assert.equal(uploads.length, 2)
  assert.equal(graph.first.inputs.image, 'uploaded_frame0.png')
  assert.match(graph.last.inputs.image, /uploaded_canvas_last_.*frame1\.png/)
  assert.equal(graph.video.inputs.fps, 25)
  assert.equal(graph.noise.inputs.noise_seed, 42)
  assert.equal(graph.lora.inputs.strength_model, 1)
  assert.equal(graph.latent.inputs.width, 512)
  const restored = JSON.parse(JSON.stringify(doc))
  assert.equal(restored.nodes.find(n => n.id === inputs[1].id).data.assetId, 'paint1')
  inputs[1].data.assetId = ''
  await assert.rejects(runtime.buildExecutionContext(doc, video), /both painted/)
  inputs[1].data.assetId = 'paint1'; video.data.width = 513
  await assert.rejects(runtime.buildExecutionContext(doc, video), /multiples of 64/)
  assert.equal(uploads.length, 2, 'invalid inputs must fail before upload')
})
