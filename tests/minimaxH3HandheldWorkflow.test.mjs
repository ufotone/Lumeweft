import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import { getWorkflowDependencyPack } from '../src/config/workflowDependencyPacks.js'
import { getModelInstallInfo } from '../src/config/workflowInstallCatalog.js'
import {
  MINIMAX_H3_HANDHELD_LORA,
  MINIMAX_H3_HANDHELD_STRENGTH,
  modifyMinimaxH3HandheldWorkflow,
} from '../src/services/minimaxH3HandheldWorkflow.mjs'

const workflow = JSON.parse(await fs.readFile(new URL('../public/workflows/video_minimax_h3_handheld.json', import.meta.url), 'utf8'))

test('CANVAS exposes H3ハンドヘルドカメラ as a dedicated template', async () => {
  const source = await fs.readFile(new URL('../src/services/flowAiSchema.js', import.meta.url), 'utf8')
  assert.match(source, /id: 'minimax-h3-handheld',[\s\S]*?label: 'H3ハンドヘルドカメラ'/)
  assert.match(source, /function buildMinimaxH3HandheldTemplate\(\)/)
  assert.match(source, /workflowId: 'minimax-h3-handheld'/)
  assert.match(source, /if \(templateId === 'minimax-h3-handheld'\) template = buildMinimaxH3HandheldTemplate\(\)/)
})

test('handheld flow keeps the publisher strength, base sampling and native audio', () => {
  const configured = modifyMinimaxH3HandheldWorkflow(workflow, {
    inputImage: 'start.png', prompt: 'A runner crosses a wet street.',
    width: 653, height: 489, duration: 3.75, seed: 9,
  })
  assert.equal(configured['1'].inputs.image, 'start.png')
  assert.deepEqual(configured['7'].inputs.first_frame, ['1', 0])
  assert.equal(configured['7'].inputs.prompt, 'A runner crosses a wet street.')
  assert.deepEqual(
    {width: configured['7'].inputs.width, height: configured['7'].inputs.height, length: configured['7'].inputs.length},
    {width: 640, height: 480, length: 90},
  )
  assert.equal(configured['6'].inputs.lora_name, MINIMAX_H3_HANDHELD_LORA)
  assert.equal(configured['6'].inputs.strength_model, MINIMAX_H3_HANDHELD_STRENGTH)
  assert.equal(configured['10'].inputs.sampler_name, 'res_multistep')
  assert.deepEqual(
    {scheduler: configured['11'].inputs.scheduler, steps: configured['11'].inputs.steps, denoise: configured['11'].inputs.denoise},
    {scheduler: 'simple', steps: 20, denoise: 1},
  )
  assert.deepEqual(configured['15'].inputs.audio, ['14', 0])
  assert.equal(configured['15'].inputs.fps, 24)
  assert.equal(workflow['1'].inputs.image, 'input.png', 'bundled graph is not mutated')
})

test('handheld flow also runs text-only without a stale image binding', () => {
  const configured = modifyMinimaxH3HandheldWorkflow(workflow, {prompt: 'A quiet documentary street scene.'})
  assert.equal(configured['1'], undefined)
  assert.equal(configured['7'].inputs.first_frame, undefined)
  assert.equal(configured['7'].inputs.last_frame, undefined)
  assert.equal(configured['7'].inputs.length % 17, 5)
})

test('Workflow Setup covers the handheld graph and pins the mirrored LoRA', () => {
  const pack = getWorkflowDependencyPack('minimax-h3-handheld')
  for (const node of Object.values(workflow)) {
    assert.ok(pack.requiredNodes.some(entry => entry.classType === node.class_type), node.class_type)
    for (const key of ['unet_name', 'clip_name', 'vae_name', 'lora_name']) {
      if (node.inputs[key]) assert.ok(pack.requiredModels.some(entry => entry.filename === node.inputs[key]), node.inputs[key])
    }
  }
  for (const model of pack.requiredModels) assert.ok(getModelInstallInfo(model)?.downloadUrl, model.filename)
  const lora = getModelInstallInfo({targetSubdir: 'loras', filename: MINIMAX_H3_HANDHELD_LORA})
  assert.equal(lora.sizeBytes, 77580048)
  assert.equal(lora.sha256, 'd56360bc9de18abec4298518ed630167ee4a3f64a7dbbc8bc0c2259d33f74069')
  assert.match(lora.downloadUrl, /c089b7833cbdffc05bdf17b188e7d7a4aa9e3d88/)
})
