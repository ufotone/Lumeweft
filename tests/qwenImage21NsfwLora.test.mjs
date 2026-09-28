import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

import { modifyQwenImage21HereticWorkflow } from '../src/services/qwenImage21HereticWorkflow.mjs'

const repoUrl = new URL('../', import.meta.url)
const workflow = JSON.parse(await fs.readFile(new URL('public/workflows/image_qwen_image_2_1_nsfw_lora.json', repoUrl), 'utf8'))
const schemaSource = await fs.readFile(new URL('src/services/flowAiSchema.js', repoUrl), 'utf8')
const runtimeSource = await fs.readFile(new URL('src/services/flowAiRuntime.js', repoUrl), 'utf8')
const dependencySource = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installSource = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')

test('Qwen Image 2.1 NSFW graph reuses the Heretic base and applies the exact Civitai LoRA', () => {
  assert.equal(workflow['1'].inputs.unet_name, 'qwen_image_2.1_int8_convrot.safetensors')
  assert.equal(workflow['2'].inputs.clip_name, 'qwen3vl_8b_heretic-Q4_K_M.gguf')
  assert.equal(workflow['4'].class_type, 'LoraLoaderModelOnly')
  assert.equal(workflow['4'].inputs.lora_name, 'NSFW Qwen Lora.safetensors')
  assert.equal(workflow['4'].inputs.strength_model, 1)
  assert.deepEqual(workflow['7'].inputs.model, ['4', 0])
  assert.equal(workflow['7'].inputs.sampler_name, 'er_sde')
  assert.equal(workflow['7'].inputs.scheduler, 'beta')
  assert.equal(workflow['7'].inputs.cfg, 1)
  assert.equal(workflow['7'].inputs.steps, 25)
})

test('shared Qwen modifier preserves the LoRA while applying CANVAS settings', () => {
  const result = modifyQwenImage21HereticWorkflow(workflow, {
    prompt: 'A cinematic portrait of consenting adults.', width: 1024, height: 1024,
    seed: 42, steps: 20, cfg: 1, samplerName: 'er_sde', scheduler: 'beta', variantCount: 2,
  })
  assert.equal(result['4'].inputs.lora_name, 'NSFW Qwen Lora.safetensors')
  assert.equal(result['4'].inputs.strength_model, 1)
  assert.equal(result['5'].inputs.prompt, 'A cinematic portrait of consenting adults.')
  assert.equal(result['6'].inputs.batch_size, 2)
  assert.equal(result['7'].inputs.steps, 20)
  assert.equal(workflow['7'].inputs.steps, 25)
})

test('CANVAS runtime and setup expose the dedicated NSFW template and pinned LoRA identity', () => {
  assert.match(schemaSource, /id: 'nsfw-qwen-image-2-1-lora'/)
  assert.match(schemaSource, /section: 'nsfw'/)
  assert.match(schemaSource, /workflowId: 'qwen-image-2-1-nsfw-lora'/)
  assert.match(runtimeSource, /'qwen-image-2-1-nsfw-lora': modifyQwenImage21HereticWorkflow/)
  assert.match(dependencySource, /filename: 'NSFW Qwen Lora\.safetensors'/)
  assert.match(installSource, /c29f503f3515877882fd6b10f6849c78a4f2337c09021f4bd4b93d060c311aea/)
  assert.match(installSource, /Install through Generate > Community/)
})
