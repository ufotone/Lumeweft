import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const repoUrl = new URL('../', import.meta.url)

async function readWorkflow(relativePath) {
  return JSON.parse(await fs.readFile(new URL(relativePath, repoUrl), 'utf8'))
}

const zImage = await readWorkflow('public/workflows/image_z_image_turbo.json')
const wanI2v = await readWorkflow('public/workflows/video_wan2_2_14B_i2v.json')
const wanT2v = await readWorkflow('public/workflows/video_wan2_2_14B_t2v.json')
const dependencySource = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installSource = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')
const communityBrowserSource = await fs.readFile(new URL('src/components/generate/CommunityModelBrowser.jsx', repoUrl), 'utf8')
const h3Fused = await readWorkflow('public/workflows/video_minimax_h3_fused_sla_i2v.json')

test('Z Image Turbo uses Q4_K_M GGUF model and encoder', () => {
  assert.equal(zImage['57:30']?.class_type, 'CLIPLoaderGGUF')
  assert.deepEqual(zImage['57:30']?.inputs, {
    clip_name: 'Qwen3-4B-Q4_K_M.gguf',
    type: 'lumina2',
  })
  assert.equal(zImage['57:28']?.class_type, 'UnetLoaderGGUF')
  assert.deepEqual(zImage['57:28']?.inputs, {
    unet_name: 'z_image_turbo-Q4_K_M.gguf',
  })
})

for (const [label, workflow, prefix] of [
  ['I2V', wanI2v, 'Wan2.2-I2V-A14B'],
  ['T2V', wanT2v, 'Wan2.2-T2V-A14B'],
]) {
  test(`WAN 2.2 ${label} uses the shared GGUF encoder and both Q4_K_M experts`, () => {
    const nodes = Object.values(workflow)
    const clip = nodes.find((node) => node?.class_type === 'CLIPLoaderGGUF')
    const models = nodes
      .filter((node) => node?.class_type === 'UnetLoaderGGUF')
      .map((node) => node.inputs.unet_name)

    assert.deepEqual(clip?.inputs, {
      clip_name: 'umt5-xxl-encoder-Q4_K_M.gguf',
      type: 'wan',
    })
    assert.deepEqual(models.sort(), [
      `${prefix}-HighNoise-Q4_K_M.gguf`,
      `${prefix}-LowNoise-Q4_K_M.gguf`,
    ].sort())
  })

  test(`WAN 2.2 ${label} retains both four-step Lightning LoRAs`, () => {
    const loras = Object.values(workflow)
      .filter((node) => node?.class_type === 'LoraLoaderModelOnly')
      .map((node) => node.inputs.lora_name)

    assert.equal(loras.length, 2)
    assert.ok(loras.every((filename) => filename.includes('lightx2v_4steps_lora')))
  })
}

test('Workflow Setup requires and can install the local GGUF stacks', () => {
  for (const filename of [
    'Qwen3-4B-Q4_K_M.gguf',
    'z_image_turbo-Q4_K_M.gguf',
    'umt5-xxl-encoder-Q4_K_M.gguf',
    'Wan2.2-I2V-A14B-HighNoise-Q4_K_M.gguf',
    'Wan2.2-I2V-A14B-LowNoise-Q4_K_M.gguf',
    'Wan2.2-T2V-A14B-HighNoise-Q4_K_M.gguf',
    'Wan2.2-T2V-A14B-LowNoise-Q4_K_M.gguf',
  ]) {
    assert.match(dependencySource, new RegExp(filename.replaceAll('.', '\\.')))
    assert.match(installSource, new RegExp(filename.replaceAll('.', '\\.')))
  }

  assert.match(installSource, /jayn7\/Z-Image-Turbo-GGUF/)
  assert.match(installSource, /QuantStack\/Wan2\.2-I2V-A14B-GGUF/)
  assert.match(installSource, /QuantStack\/Wan2\.2-T2V-A14B-GGUF/)
  assert.match(installSource, /city96\/umt5-xxl-encoder-gguf/)
})

test('community WAN reconstruction defaults to GGUF but preserves published safetensors compatibility', () => {
  assert.match(communityBrowserSource, /filename: 'umt5-xxl-encoder-Q4_K_M\.gguf'/)
  assert.match(communityBrowserSource, /filename: 'Wan2\.2-I2V-A14B-HighNoise-Q4_K_M\.gguf'/)
  assert.match(communityBrowserSource, /filename: 'Wan2\.2-I2V-A14B-LowNoise-Q4_K_M\.gguf'/)
  assert.match(communityBrowserSource, /node\.class_type = isGguf \? 'UnetLoaderGGUF' : 'UNETLoader'/)
})

test('default MiniMax H3 I2V follows the published fused Turbo SLA low-VRAM recipe', () => {
  assert.equal(h3Fused['2'].class_type, 'UNETLoader')
  assert.equal(h3Fused['2'].inputs.unet_name, 'minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors')
  assert.deepEqual(h3Fused['3'].inputs, { model: ['2', 0], chunks: 4, seq_threshold: 4096 })
  assert.deepEqual(h3Fused['4'].inputs, {
    model: ['3', 0], sparsity_ratio: 0.9, block_size: '64', min_seq_len: 8192,
    dense_last_steps: 0, protect_audio: true, enabled: true,
  })
  assert.equal(h3Fused['11'].inputs.sampler_name, 'res_multistep')
  assert.deepEqual(h3Fused['12'].inputs, { model: ['10', 0], scheduler: 'simple', steps: 4, denoise: 1 })
  assert.equal(h3Fused['6'].inputs.vae_name, 'minimax_h3_video_vae_int8_convrot.safetensors')
})
