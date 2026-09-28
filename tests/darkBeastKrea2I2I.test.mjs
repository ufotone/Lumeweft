import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

import { modifyDarkBeastKrea2I2IWorkflow } from '../src/services/darkBeastKrea2I2IWorkflow.mjs'
import { getWorkflowDependencyPack } from '../src/config/workflowDependencyPacks.js'

const workflowUrl = new URL('../public/workflows/image_dark_beast_krea2_i2i.json', import.meta.url)
const schemaSource = await fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8')
const runtimeSource = await fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8')
const dependencySource = await fs.readFile(new URL('../src/config/workflowDependencyPacks.js', import.meta.url), 'utf8')
const installSource = await fs.readFile(new URL('../src/config/workflowInstallCatalog.js', import.meta.url), 'utf8')
const registrySource = await fs.readFile(new URL('../src/config/workflowRegistry.js', import.meta.url), 'utf8')
const comfySource = await fs.readFile(new URL('../src/services/comfyui.js', import.meta.url), 'utf8')
const japaneseSource = await fs.readFile(new URL('../public/lang/lang_jp.json', import.meta.url), 'utf8')

const servicesDir = fileURLToPath(new URL('../src/services/', import.meta.url))
const dependencyBundle = await build({
  stdin: { contents: 'export { checkWorkflowDependencies } from "./workflowDependencies"', resolveDir: servicesDir },
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  define: { 'import.meta.env.BASE_URL': '"/"' },
  plugins: [{
    name: 'no-comfy-io',
    setup(builder) {
      builder.onResolve({ filter: /^\.\/comfyui$/ }, () => ({ path: 'comfyui', namespace: 'mock' }))
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: 'export const comfyui = {}', loader: 'js' }))
    },
  }],
})
const dependencies = await import(`data:text/javascript;base64,${Buffer.from(dependencyBundle.outputFiles[0].text).toString('base64')}`)

test('CANVAS exposes optional-image Dark Beast KREA 2 in the NSFW section', () => {
  assert.match(schemaSource, /id: 'nsfw-dark-beast-krea2-i2i'[\s\S]*section: 'nsfw'/)
  assert.match(schemaSource, /id: 'nsfw-dark-beast-krea2-i2i'[\s\S]*category: 't2i'/)
  assert.match(schemaSource, /workflowId: 'dark-beast-krea2-i2i'/)
  assert.match(schemaSource, /version 3078453 is not MiniMax H3/)
  assert.match(runtimeSource, /'dark-beast-krea2-i2i': modifyDarkBeastKrea2I2IWorkflow/)
  assert.match(registrySource, /image_dark_beast_krea2_i2i\.json/)
  assert.match(registrySource, /id: 'dark-beast-krea2-i2i'[\s\S]*needsImage: false/)
  assert.match(japaneseSource, /KREA 2 Dark Beast 画像生成 \/ 画像編集/)
})

test('Dark Beast workflow contains both T2I and latent I2I source paths', async () => {
  const workflow = JSON.parse(await fs.readFile(workflowUrl, 'utf8'))
  const classes = Object.values(workflow).map(node => node.class_type)
  for (const required of ['UNETLoader', 'CLIPLoader', 'VAELoader', 'LoadImage', 'VAEEncode', 'EmptyLatentImage', 'CLIPTextEncode', 'ConditioningZeroOut', 'KSampler', 'VAEDecode', 'SaveImage']) {
    assert.ok(classes.includes(required), `missing ${required}`)
  }
  assert.equal(workflow['1'].inputs.unet_name, 'darkBeastH3Director_darkBeastKREA2FP8_2958418.safetensors')
  assert.deepEqual(workflow['1']._meta.model_aliases.unet_name, [
    'darkBeastH3Director_darkBeastKREA2FP8_fp8.safetensors',
  ])
  assert.equal(workflow['2'].inputs.type, 'krea2')
  assert.deepEqual(workflow['8'].inputs.latent_image, ['5', 0])
  assert.deepEqual(workflow['11'].inputs, { width: 960, height: 1440, batch_size: 1 })
})

test('Dark Beast modifier applies source, prompt and published sampling defaults without mutating the template', async () => {
  const workflow = JSON.parse(await fs.readFile(workflowUrl, 'utf8'))
  const result = modifyDarkBeastKrea2I2IWorkflow(workflow, {
    inputImage: 'canvas_source.png',
    prompt: 'Change the outfit while preserving the adult character.',
    seed: 12345,
    steps: 18,
    cfg: 1.2,
    denoise: 0.42,
    filenamePrefix: 'image/test_dark_beast',
  })

  assert.equal(result['4'].inputs.image, 'canvas_source.png')
  assert.equal(result['6'].inputs.text, 'Change the outfit while preserving the adult character.')
  assert.deepEqual(result['8'].inputs, {
    ...workflow['8'].inputs,
    seed: 12345,
    steps: 18,
    cfg: 1.2,
    denoise: 0.42,
    sampler_name: 'euler',
    scheduler: 'simple',
  })
  assert.equal(result['10'].inputs.filename_prefix, 'image/test_dark_beast')
  assert.equal(result['11'], undefined)
  assert.equal(workflow['4'].inputs.image, 'example.png')
})

test('Dark Beast modifier runs T2I without an image and forces full denoise', async () => {
  const workflow = JSON.parse(await fs.readFile(workflowUrl, 'utf8'))
  const result = modifyDarkBeastKrea2I2IWorkflow(workflow, {
    prompt: 'A fictional adult character in cinematic lighting.',
    width: 1024,
    height: 1536,
    denoise: 0.2,
  })

  assert.equal(result['4'], undefined)
  assert.equal(result['5'], undefined)
  assert.deepEqual(result['11'].inputs, { width: 1024, height: 1536, batch_size: 1 })
  assert.deepEqual(result['8'].inputs.latent_image, ['11', 0])
  assert.equal(result['8'].inputs.denoise, 1)
  assert.equal(result['6'].inputs.text, 'A fictional adult character in cinematic lighting.')
  assert.equal(workflow['4'].inputs.image, 'example.png')
})

test('Workflow Setup tracks the exact Civitai model and official Krea 2 support files', () => {
  assert.match(dependencySource, /darkBeastH3Director_darkBeastKREA2FP8_2958418\.safetensors/)
  assert.match(dependencySource, /darkBeastH3Director_darkBeastKREA2FP8_fp8\.safetensors/)
  assert.match(dependencySource, /qwen3vl_4b_fp8_scaled\.safetensors/)
  assert.match(installSource, /modelVersionId=3078453/)
  assert.match(installSource, /0C005BB2DA4AA249CEB4E9A90C3914DA9280660CF480F780C7386B92A8CFFC1B/i)
  assert.match(installSource, /Comfy-Org\/Krea-2/)
  assert.match(comfySource, /model_aliases/)
})

test('Workflow Setup accepts the Dark Beast filename exposed by Stability Matrix and ComfyUI', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
  const pack = getWorkflowDependencyPack('dark-beast-krea2-i2i')
  const objectInfo = Object.fromEntries(pack.requiredNodes.map((node) => [node.classType, { input: { required: {} } }]))
  for (const model of pack.requiredModels) {
    const choices = model.classType === 'UNETLoader'
      ? ['darkBeastH3Director_darkBeastKREA2FP8_fp8.safetensors']
      : [model.filename]
    objectInfo[model.classType].input.required[model.inputKey] = [choices]
  }

  const result = await dependencies.checkWorkflowDependencies('dark-beast-krea2-i2i', { objectInfo })
  assert.equal(result.status, 'ready')
  assert.equal(result.hasBlockingIssues, false)
  assert.deepEqual(result.missingModels, [])
})
