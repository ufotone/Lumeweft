import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { getWorkflowDependencyPack } from '../src/config/workflowDependencyPacks.js'
import { getModelInstallInfo } from '../src/config/workflowInstallCatalog.js'
import {
  MINIMAX_H3_360_ORBIT_PROMPT,
  modifyMinimaxH3360OrbitWorkflow,
} from '../src/services/minimaxH3360OrbitWorkflow.mjs'

const workflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_minimax_h3_360_orbit.json', import.meta.url), 'utf8'))

test('CANVAS exposes the dedicated flow as H3バレットタイム', () => {
  return fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8').then(source => {
    assert.match(source, /id: 'minimax-h3-360-orbit',[\s\S]*?label: 'H3バレットタイム'/)
    assert.match(source, /function buildMinimaxH3360OrbitTemplate\(\)/)
    assert.match(source, /workflowId: 'minimax-h3-360-orbit'/)
    assert.match(source, /if \(templateId === 'minimax-h3-360-orbit'\) template = buildMinimaxH3360OrbitTemplate\(\)/)
  })
})

test('H3 bullet-time keeps the publisher recipe and uses one image for both endpoints', () => {
  const configured = modifyMinimaxH3360OrbitWorkflow(workflow, {
    inputImage: 'frozen.png',
    prompt: MINIMAX_H3_360_ORBIT_PROMPT,
    seed: 42,
    filenamePrefix: 'video/test_orbit',
  })

  assert.equal(configured['1'].inputs.image, 'frozen.png')
  assert.deepEqual(configured['6'].inputs.first_frame, ['1', 0])
  assert.deepEqual(configured['6'].inputs.last_frame, ['1', 0])
  assert.equal(configured['6'].inputs.prompt, MINIMAX_H3_360_ORBIT_PROMPT)
  assert.deepEqual(
    {width: configured['6'].inputs.width, height: configured['6'].inputs.height, length: configured['6'].inputs.length},
    {width: 768, height: 768, length: 73},
  )
  assert.equal(configured['5'].inputs.lora_name, 'minimax_h3_flf2v_lora_v1.safetensors')
  assert.equal(configured['5'].inputs.strength_model, 1)
  assert.equal(configured['9'].inputs.sampler_name, 'res_multistep')
  assert.deepEqual(
    {scheduler: configured['10'].inputs.scheduler, steps: configured['10'].inputs.steps, denoise: configured['10'].inputs.denoise},
    {scheduler: 'simple', steps: 28, denoise: 1},
  )
  assert.equal(configured['13'].inputs.fps, 24)
  assert.equal(configured['13'].inputs.audio, undefined)
  assert.equal(configured['14'].inputs.filename_prefix, 'video/test_orbit')
  assert.equal(workflow['1'].inputs.image, 'input.png', 'bundled workflow is not mutated')
})

test('H3 bullet-time rejects a missing source image', () => {
  assert.throws(() => modifyMinimaxH3360OrbitWorkflow(workflow), /source image/)
})

test('Workflow Setup covers every node and exact model file in the orbit graph', () => {
  const pack = getWorkflowDependencyPack('minimax-h3-360-orbit')
  for (const node of Object.values(workflow)) {
    assert.ok(pack.requiredNodes.some(entry => entry.classType === node.class_type), node.class_type)
    for (const key of ['unet_name', 'clip_name', 'vae_name', 'lora_name']) {
      if (node.inputs[key]) assert.ok(pack.requiredModels.some(entry => entry.filename === node.inputs[key]), node.inputs[key])
    }
  }
  for (const model of pack.requiredModels) {
    const recipe = getModelInstallInfo(model)
    assert.ok(recipe.downloadUrl, model.filename)
    if (recipe.sha256) assert.match(recipe.sha256, /^[a-f0-9]{64}$/)
    if (recipe.sizeBytes) assert.ok(recipe.sizeBytes > 0)
  }
  const lora = getModelInstallInfo({targetSubdir: 'loras', filename: 'minimax_h3_flf2v_lora_v1.safetensors'})
  assert.equal(lora.sizeBytes, 155111424)
  assert.equal(lora.sha256, '14f13e3effaf3e729fdc0c97680344aa63f473be0c55963f963d718b3db2a4d4')
  assert.match(lora.downloadUrl, /5ddbc2dbbe95edbbdaf5017c3e934b1d01791697/)
})
