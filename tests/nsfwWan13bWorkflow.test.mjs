import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

import { modifyNsfwWan13bWorkflow } from '../src/services/nsfwWan13bWorkflow.mjs'

const repoUrl = new URL('../', import.meta.url)
const workflow = JSON.parse(await fs.readFile(new URL('public/workflows/video_nsfw_wan_1_3b_e10_t2v.json', repoUrl), 'utf8'))
const schemaSource = await fs.readFile(new URL('src/services/flowAiSchema.js', repoUrl), 'utf8')
const runtimeSource = await fs.readFile(new URL('src/services/flowAiRuntime.js', repoUrl), 'utf8')
const dependencySource = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installSource = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')
const registrySource = await fs.readFile(new URL('src/config/workflowRegistry.js', repoUrl), 'utf8')

test('NSFW Wan e10 graph uses the full 1.3B checkpoint and official Wan 2.1 support stack', () => {
  assert.equal(workflow['1'].inputs.unet_name, 'wan_1.3B_e10.safetensors')
  assert.equal(workflow['2'].inputs.clip_name, 'umt5_xxl_fp8_e4m3fn_scaled.safetensors')
  assert.equal(workflow['2'].inputs.type, 'wan')
  assert.equal(workflow['3'].inputs.vae_name, 'wan_2.1_vae.safetensors')
  assert.equal(workflow['7'].inputs.shift, 8)
  assert.equal(workflow['8'].inputs.steps, 30)
  assert.equal(workflow['8'].inputs.cfg, 6)
  assert.equal(workflow['8'].inputs.sampler_name, 'uni_pc')
})

test('NSFW Wan modifier applies CANVAS settings without mutating the bundled graph', () => {
  const result = modifyNsfwWan13bWorkflow(workflow, {
    prompt: 'Fictional consenting adults.', negativePrompt: 'artifact', width: 721, height: 481,
    frames: 82, fps: 24, seed: 42, steps: 28, cfg: 5.5, samplerName: 'euler',
    scheduler: 'simple', filenamePrefix: 'video/test_wan_e10',
  })
  assert.equal(result['4'].inputs.text, 'Fictional consenting adults.')
  assert.equal(result['5'].inputs.text, 'artifact')
  assert.equal(result['6'].inputs.width, 720)
  assert.equal(result['6'].inputs.height, 480)
  assert.equal(result['6'].inputs.length, 81)
  assert.equal(result['8'].inputs.steps, 28)
  assert.equal(result['10'].inputs.fps, 24)
  assert.equal(result['11'].inputs.filename_prefix, 'video/test_wan_e10')
  assert.equal(workflow['4'].inputs.text.startsWith('A cinematic shot'), true)
})

test('CANVAS and Workflow Setup expose the requested e10 artifact exactly', () => {
  assert.match(schemaSource, /id: 'nsfw-wan-1-3b-e10-t2v'[\s\S]*section: 'nsfw'/)
  assert.match(schemaSource, /workflowId: 'nsfw-wan-1-3b-e10-t2v'/)
  assert.match(runtimeSource, /'nsfw-wan-1-3b-e10-t2v': modifyNsfwWan13bWorkflow/)
  assert.match(dependencySource, /wan_1\.3B_e10\.safetensors/)
  assert.match(installSource, /b0be4a5dded7594deb7c11bcb808dac86c79619ae73ca9917cd8f0447f203d80/i)
  assert.match(registrySource, /video_nsfw_wan_1_3b_e10_t2v\.json/)
})
