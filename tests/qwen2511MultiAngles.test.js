import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

const repoUrl = new URL('../', import.meta.url)
const workflowFiles = [
  'public/workflows/1_click_multiple_angles.json',
  'public/workflows/1_click_multiple_scene_angles-v1.0.json',
]

const workflows = await Promise.all(workflowFiles.map(async (relativePath) => ({
  relativePath,
  workflow: JSON.parse(await fs.readFile(new URL(relativePath, repoUrl), 'utf8')),
})))

const dependencySource = await fs.readFile(new URL('src/config/workflowDependencyPacks.js', repoUrl), 'utf8')
const installSource = await fs.readFile(new URL('src/config/workflowInstallCatalog.js', repoUrl), 'utf8')
const comfySource = await fs.readFile(new URL('src/services/comfyui.js', repoUrl), 'utf8')
const runtimeSource = await fs.readFile(new URL('src/services/flowAiRuntime.js', repoUrl), 'utf8')

for (const { relativePath, workflow } of workflows) {
  test(`${relativePath} uses the Qwen 2511 GGUF and matching LoRAs`, () => {
    assert.equal(workflow['48:12']?.class_type, 'UnetLoaderGGUF')
    assert.deepEqual(workflow['48:12']?.inputs, {
      unet_name: 'qwen-image-edit-2511-Q5_K_M.gguf',
    })
    assert.equal(
      workflow['48:26']?.inputs?.lora_name,
      'Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors',
    )
    assert.equal(
      workflow['48:20']?.inputs?.lora_name,
      'qwen-image-edit-2511-multiple-angles-lora.safetensors',
    )
  })

  test(`${relativePath} uses all eight 2511 camera-control prompts`, () => {
    const promptValues = ['66', '67', '68', '69', '70', '71', '72', '73']
      .map((nodeId) => String(workflow[nodeId]?.inputs?.value || '').trim())

    assert.equal(promptValues.length, 8)
    assert.ok(promptValues.every((prompt) => prompt.startsWith('<sks> ')))
    assert.ok(promptValues.some((prompt) => prompt.includes('front-right quarter view')))
    assert.ok(promptValues.some((prompt) => prompt.includes('front-left quarter view')))
    assert.ok(promptValues.some((prompt) => prompt.includes('high-angle shot')))
    assert.ok(promptValues.some((prompt) => prompt.includes('low-angle shot')))
  })
}

test('dependency setup can install every Qwen 2511 multi-angle requirement', () => {
  assert.match(dependencySource, /classType: 'UnetLoaderGGUF'/)
  assert.match(dependencySource, /filename: 'qwen-image-edit-2511-Q5_K_M\.gguf'/)
  assert.match(dependencySource, /filename: 'Qwen-Image-Edit-2511-Lightning-4steps-V1\.0-bf16\.safetensors'/)
  assert.match(dependencySource, /filename: 'qwen-image-edit-2511-multiple-angles-lora\.safetensors'/)

  assert.match(installSource, /unsloth\/Qwen-Image-Edit-2511-GGUF/)
  assert.match(installSource, /lightx2v\/Qwen-Image-Edit-2511-Lightning/)
  assert.match(installSource, /fal\/Qwen-Image-Edit-2511-Multiple-Angles-LoRA/)
})

test('runtime prompt overrides default to the 2511 LoRA syntax', () => {
  assert.match(comfySource, /closeUp:\s+'<sks> front view eye-level shot close-up'/)
  assert.match(comfySource, /right90:\s+'<sks> right side view eye-level shot medium shot'/)
  assert.match(comfySource, /left90:\s+'<sks> left side view eye-level shot medium shot'/)
})

test('multiple-angle SaveImage outputs use the CANVAS run prefix', () => {
  assert.match(comfySource, /filenamePrefix = ''/)
  assert.match(comfySource, /`\$\{filenamePrefix\}_\$\{suffix\}`/)
  assert.match(runtimeSource, /filenamePrefix: context\.outputPrefix/)
})

test('multiple-angle execution removes duplicate PreviewImage outputs', () => {
  assert.match(comfySource, /node\?\.class_type === 'PreviewImage'/)
  assert.match(comfySource, /delete modified\[nodeId\]/)
  assert.match(comfySource, /only[\s\S]*eight persistent training images are produced/)
})

test('multiple-angle generation prepares a non-cropped 1024 square source', () => {
  assert.match(runtimeSource, /async function fitImageFileToSquare\(file, size = 1024\)/)
  assert.match(runtimeSource, /context\.fillStyle = '#ffffff'/)
  assert.match(runtimeSource, /Math\.min\(targetSize \/ Math\.max\(1, bitmap\.width\), targetSize \/ Math\.max\(1, bitmap\.height\)\)/)
  assert.match(runtimeSource, /\['multi-angles', 'multi-angles-scene'\]\.includes\(workflowId\)/)
  assert.match(runtimeSource, /fitImageFileToSquare\(fileToUpload, 1024\)/)
})
