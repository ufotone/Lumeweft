import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

import { modifyHarukiMixKrea2Workflow } from '../src/services/harukiMixKrea2Workflow.mjs'

const repoUrl = new URL('../', import.meta.url)
const workflow = JSON.parse(await fs.readFile(new URL('public/workflows/image_haruki_mix_krea2_t2i.json', repoUrl), 'utf8'))
const schemaSource = await fs.readFile(new URL('src/services/flowAiSchema.js', repoUrl), 'utf8')
const runtimeSource = await fs.readFile(new URL('src/services/flowAiRuntime.js', repoUrl), 'utf8')
const dependencySource = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installSource = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')
const registrySource = await fs.readFile(new URL('src/config/workflowRegistry.js', repoUrl), 'utf8')

test('HARUKI_MIX graph reuses the existing Krea 2 support stack', () => {
  assert.equal(workflow['1'].inputs.unet_name, 'harukiMIX_kr2V20Int8Convrot.safetensors')
  assert.equal(workflow['2'].inputs.clip_name, 'qwen3vl_4b_fp8_scaled.safetensors')
  assert.equal(workflow['2'].inputs.type, 'krea2')
  assert.equal(workflow['3'].inputs.vae_name, 'qwen_image_vae.safetensors')
  assert.equal(workflow['6'].inputs.width, 816)
  assert.equal(workflow['6'].inputs.height, 1104)
  assert.equal(workflow['7'].inputs.steps, 8)
  assert.equal(workflow['7'].inputs.cfg, 1)
  assert.equal(workflow['7'].inputs.sampler_name, 'euler')
  assert.equal(workflow['7'].inputs.scheduler, 'simple')
})

test('HARUKI_MIX modifier applies CANVAS settings without mutating the bundled graph', () => {
  const result = modifyHarukiMixKrea2Workflow(workflow, {
    prompt: 'A fictional adult character portrait.', width: 1024, height: 1024,
    seed: 42, steps: 10, cfg: 1, samplerName: 'euler', scheduler: 'beta', variantCount: 3,
    filenamePrefix: 'image/test_haruki_mix',
  })
  assert.equal(result['4'].inputs.text, 'A fictional adult character portrait.')
  assert.equal(result['6'].inputs.width, 1024)
  assert.equal(result['6'].inputs.batch_size, 3)
  assert.equal(result['7'].inputs.steps, 10)
  assert.equal(result['7'].inputs.scheduler, 'beta')
  assert.equal(result['9'].inputs.filename_prefix, 'image/test_haruki_mix')
  assert.equal(workflow['6'].inputs.width, 816)
})

test('CANVAS and Workflow Setup expose exact HARUKI_MIX version metadata', () => {
  assert.match(schemaSource, /id: 'nsfw-haruki-mix-krea2-t2i'[\s\S]*section: 'nsfw'/)
  assert.match(schemaSource, /workflowId: 'haruki-mix-krea2-t2i'/)
  assert.match(runtimeSource, /'haruki-mix-krea2-t2i': modifyHarukiMixKrea2Workflow/)
  assert.match(dependencySource, /harukiMIX_kr2V20Int8Convrot\.safetensors/)
  assert.match(dependencySource, /qwen3vl_4b_fp8_scaled\.safetensors/)
  assert.match(installSource, /modelVersionId=3188234/)
  assert.match(installSource, /7B903F38BC8A6F9E988A46F373B70BEAF4FB70534A7A94FB94F300D461361BB9/i)
  assert.match(registrySource, /image_haruki_mix_krea2_t2i\.json/)
})
