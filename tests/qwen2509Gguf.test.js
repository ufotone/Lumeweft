import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const repoUrl = new URL('../', import.meta.url)
const workflowFiles = [
  'public/workflows/image_qwen_image_edit_2509.json',
  'public/workflows/image_qwen_image_edit_2509_Model_and_Product.json',
]

const workflows = await Promise.all(workflowFiles.map(async (relativePath) => ({
  relativePath,
  workflow: JSON.parse(await fs.readFile(new URL(relativePath, repoUrl), 'utf8')),
})))
const dependencySource = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installSource = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')

for (const { relativePath, workflow } of workflows) {
  test(`${relativePath} uses the requested Qwen 2509 GGUF stack`, () => {
    assert.equal(workflow['433:37']?.class_type, 'UnetLoaderGGUF')
    assert.deepEqual(workflow['433:37']?.inputs, {
      unet_name: 'Qwen-Image-Edit-2509-Q4_K_M.gguf',
    })
    assert.equal(workflow['433:38']?.class_type, 'CLIPLoaderGGUF')
    assert.deepEqual(workflow['433:38']?.inputs, {
      clip_name: 'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
      type: 'qwen_image',
    })
  })

  test(`${relativePath} retains the 4-step Lightning LoRA`, () => {
    const loraNode = Object.values(workflow).find((node) => (
      node?.class_type === 'LoraLoaderModelOnly'
      && node?.inputs?.lora_name === 'Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors'
    ))
    const samplerNode = Object.values(workflow).find((node) => node?.class_type === 'KSampler')

    assert.ok(loraNode)
    assert.equal(samplerNode?.inputs?.steps, 4)
    assert.equal(samplerNode?.inputs?.cfg, 1)
  })
}

test('dependency setup requires the complete GGUF stack and Lightning', () => {
  assert.match(dependencySource, /classType: 'UnetLoaderGGUF'/)
  assert.match(dependencySource, /classType: 'CLIPLoaderGGUF'/)
  assert.match(dependencySource, /filename: 'Qwen-Image-Edit-2509-Q4_K_M\.gguf'/)
  assert.match(dependencySource, /filename: 'Qwen2\.5-VL-7B-Instruct-Q4_K_M\.gguf'/)
  assert.match(dependencySource, /filename: 'Qwen2\.5-VL-7B-Instruct-mmproj-BF16\.gguf'/)
  assert.match(dependencySource, /filename: 'Qwen-Image-Edit-2509-Lightning-4steps-V1\.0-bf16\.safetensors'/)
})

test('Workflow Setup has curated downloads for every requested file', () => {
  assert.match(installSource, /QuantStack\/Qwen-Image-Edit-2509-GGUF/)
  assert.match(installSource, /ggml-org\/Qwen2\.5-VL-7B-Instruct-GGUF/)
  assert.match(installSource, /mmproj\/Qwen2\.5-VL-7B-Instruct-mmproj-BF16\.gguf/)
  assert.match(installSource, /lightx2v\/Qwen-Image-Lightning/)
})
