import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'

import { modifyAnimaLoraUpscaleWorkflow } from '../src/services/animaLoraUpscaleWorkflow.js'

const workflowUrl = new URL('../public/workflows/image_anima_lora_upscale.json', import.meta.url)

async function loadWorkflow() {
  return JSON.parse(await fs.readFile(workflowUrl, 'utf8'))
}

test('ANIMA compatibility workflow expands enabled LoRAs into a core LoraLoader chain', async () => {
  const original = await loadWorkflow()
  const modified = modifyAnimaLoraUpscaleWorkflow(original, {
    checkpointName: 'models\\anima-base-v1.0.safetensors',
    prompt: 'test prompt',
    negativePrompt: 'test negative',
    width: 769,
    height: 1279,
    seed: 42,
    steps: 15,
    cfg: 5,
    eta: 0.65,
    denoise: 0.9,
    samplerName: 'exponential/res_2s',
    scheduler: 'karras',
    samplerMode: 'standard',
    bongmath: true,
    loras: [
      { enabled: true, name: 'first.safetensors', strength: 0.8 },
      { enabled: false, name: 'disabled.safetensors', strength: 1 },
      { enabled: true, name: 'second.safetensors', strength: 1.2 },
    ],
    upscaleEnabled: false,
    filenamePrefix: 'image/test',
  })

  assert.equal(modified['1'].inputs.ckpt_name, 'models\\anima-base-v1.0.safetensors')
  assert.equal(modified['7'].inputs.width, 768)
  assert.equal(modified['7'].inputs.height, 1280)
  assert.equal(modified['20'].class_type, 'LoraLoader')
  assert.equal(modified['20'].inputs.lora_name, 'first.safetensors')
  assert.deepEqual(modified['21'].inputs.model, ['20', 0])
  assert.equal(modified['21'].inputs.lora_name, 'second.safetensors')
  assert.equal(modified['22'], undefined)
  assert.deepEqual(modified['13'].inputs.model, ['21', 0])
  assert.equal(modified['13'].class_type, 'ClownsharKSampler_Beta')
  assert.equal(modified['13'].inputs.sampler_name, 'exponential/res_2s')
  assert.equal(modified['13'].inputs.eta, 0.65)
  assert.equal(modified['13'].inputs.denoise, 0.9)
  assert.equal(modified['13'].inputs.scheduler, 'karras')
  assert.equal(modified['13'].inputs.bongmath, true)
  assert.deepEqual(modified['5'].inputs.clip, ['21', 1])
  assert.equal(modified['15'], undefined)
  assert.equal(modified['16'], undefined)
  assert.deepEqual(modified['17'].inputs.images, ['14', 0])
  assert.notStrictEqual(modified, original)
})

test('ANIMA compatibility workflow enables the core upscaler branch', async () => {
  const modified = modifyAnimaLoraUpscaleWorkflow(await loadWorkflow(), {
    checkpointName: 'anima.safetensors',
    upscaleEnabled: true,
    upscaleModel: 'RealESRGAN\\RealESRGAN_x4plus.pth',
  })
  assert.equal(modified['15'].inputs.model_name, 'RealESRGAN\\RealESRGAN_x4plus.pth')
  assert.deepEqual(modified['17'].inputs.images, ['16', 0])
})

test('CANVAS registers the ANIMA flow with RES4LYF as its only workflow-specific node pack', async () => {
  const [schema, runtime, registry, dependencies, installCatalog] = await Promise.all([
    fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/services/flowAiRuntime.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/config/workflowRegistry.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/config/workflowDependencyPacks.js', import.meta.url), 'utf8'),
    fs.readFile(new URL('../src/config/workflowInstallCatalog.js', import.meta.url), 'utf8'),
  ])
  assert.match(schema, /id: 'anima-lora-upscale'/)
  assert.match(schema, /buildAnimaLoraUpscaleTemplate/)
  assert.match(schema, /workflowControl: 'workflow-control'/)
  assert.match(schema, /controlKind: 'lora-stack'/)
  assert.match(schema, /targetHandle: 'in:negative-text'/)
  assert.match(schema, /targetHandle: 'in:control'/)
  assert.match(runtime, /'anima-lora-upscale': modifyAnimaLoraUpscaleWorkflow/)
  assert.match(runtime, /resolveWorkflowControlData/)
  assert.match(runtime, /connectedNegativePrompt/)
  assert.match(registry, /image_anima_lora_upscale\.json/)
  assert.match(dependencies, /classType: 'LoraLoader'/)
  const pack = dependencies.match(/'anima-lora-upscale':[\s\S]*?docsUrl:/)?.[0] || ''
  assert.match(pack, /ClownsharKSampler_Beta/)
  assert.doesNotMatch(pack, /Power Lora Loader|Fast Bypasser|SetImageSize|mxSlider2D/)
  assert.match(installCatalog, /id: 'res4lyf'[\s\S]*?ClownsharKSampler_Beta/)
})
