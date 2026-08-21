import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildCivitaiInstallTasks,
  chooseCivitaiAnimaDiffusionModel,
  chooseCivitaiLoraBaseCheckpoint,
  extractComfyInputChoices,
  getDefaultCivitaiFileIds,
  inferComfyModelSubdir,
  normalizeCivitaiModel,
  parseCivitaiModelReference,
  parseCivitaiReference,
  resolveComfyModelChoice,
} from '../src/services/civitai.js'

test('selects only primary Civitai files by default and falls back to one file', () => {
  const files = [
    { id: 1, name: 'same.safetensors', type: 'Diffusion Model', downloadUrl: 'https://civitai.com/api/download/models/10', primary: true },
    { id: 2, name: 'same.safetensors', type: 'Model', downloadUrl: 'https://civitai.com/api/download/models/10', primary: false },
  ]
  assert.deepEqual(getDefaultCivitaiFileIds('Checkpoint', { files }), [1])
  assert.deepEqual(getDefaultCivitaiFileIds('Checkpoint', { files: files.map((file) => ({ ...file, primary: false })) }), [1])
})

test('extracts ComfyUI checkpoint choices and prefers a matching LoRA base family', () => {
  const objectInfo = {
    CheckpointLoaderSimple: {
      input: { required: { ckpt_name: [['models/plain.safetensors', 'pony/ponyXL.safetensors', 'sdxl/base.safetensors']] } },
    },
  }
  const choices = extractComfyInputChoices(objectInfo, 'CheckpointLoaderSimple', 'ckpt_name')
  assert.deepEqual(choices, ['models/plain.safetensors', 'pony/ponyXL.safetensors', 'sdxl/base.safetensors'])
  assert.equal(chooseCivitaiLoraBaseCheckpoint(choices, 'Pony', ''), 'pony/ponyXL.safetensors')
  assert.equal(chooseCivitaiLoraBaseCheckpoint(choices, 'SDXL 1.0', ''), 'sdxl/base.safetensors')
  assert.equal(chooseCivitaiLoraBaseCheckpoint(choices, '', 'plain'), 'models/plain.safetensors')
  assert.equal(resolveComfyModelChoice(['nested/example.safetensors'], 'example.safetensors'), 'nested/example.safetensors')
  assert.equal(resolveComfyModelChoice(['a/example.safetensors', 'b/example.safetensors'], 'example.safetensors'), '')
})

test('selects a split Anima diffusion model without treating it as a full checkpoint', () => {
  const choices = ['anima-preview3-base.safetensors', 'waiANIMA_v10.safetensors', 'flux1-dev.safetensors']
  assert.equal(chooseCivitaiAnimaDiffusionModel(choices), 'waiANIMA_v10.safetensors')
  assert.equal(chooseCivitaiAnimaDiffusionModel(choices, 'anima-preview3-base'), 'anima-preview3-base.safetensors')
  assert.equal(chooseCivitaiAnimaDiffusionModel(['flux1-dev.safetensors']), '')
})

test('parses civitai.com, civitai.red, and numeric model references', () => {
  assert.equal(parseCivitaiModelReference('https://civitai.com/models/1353314/animij')?.modelId, 1353314)
  assert.equal(parseCivitaiModelReference('https://civitai.red/models/1353314/animij?modelVersionId=1')?.modelId, 1353314)
  assert.equal(parseCivitaiModelReference('1353314')?.modelId, 1353314)
  assert.equal(parseCivitaiModelReference('https://example.com/models/1353314'), null)
})

test('classifies Civitai image and video post references', () => {
  assert.deepEqual(parseCivitaiReference('https://civitai.red/images/139174790'), {
    kind: 'media', mediaId: 139174790, sourceUrl: 'https://civitai.com/images/139174790',
  })
  assert.equal(parseCivitaiReference('https://civitai.com/videos/123')?.mediaId, 123)
  assert.equal(parseCivitaiReference('https://civitai.com/models/1353314')?.kind, 'model')
  assert.equal(parseCivitaiReference('https://civitai.com/models/1353314?modelVersionId=77')?.modelVersionId, 77)
  assert.equal(parseCivitaiModelReference('https://civitai.red/images/139174790'), null)
})

test('maps Civitai file types to constrained ComfyUI model folders', () => {
  assert.equal(inferComfyModelSubdir('LORA', 'Model'), 'loras')
  assert.equal(inferComfyModelSubdir('Checkpoint', 'Diffusion Model'), 'diffusion_models')
  assert.equal(inferComfyModelSubdir('Checkpoint', 'VAE'), 'vae')
  assert.equal(inferComfyModelSubdir('Checkpoint', 'Text Encoder'), 'text_encoders')
  assert.equal(inferComfyModelSubdir('Checkpoint', 'Unknown'), '')
})

test('builds install tasks only for selected safe Civitai files', () => {
  const tasks = buildCivitaiInstallTasks({ name: 'Example', type: 'LORA' }, {
    files: [
      { id: 1, name: 'ok.safetensors', type: 'Model', downloadUrl: 'https://civitai.com/api/download/models/42', sha256: 'a'.repeat(64), sizeBytes: 123 },
      { id: 2, name: '../escape.safetensors', type: 'Model', downloadUrl: 'https://civitai.com/api/download/models/42' },
      { id: 3, name: 'foreign.safetensors', type: 'Model', downloadUrl: 'https://example.com/file' },
    ],
  }, [1, 2, 3])
  assert.deepEqual(tasks, [{
    filename: 'ok.safetensors',
    displayName: 'Example · Model',
    targetSubdir: 'loras',
    downloadUrl: 'https://civitai.com/api/download/models/42',
    sizeBytes: 123,
    sha256: 'a'.repeat(64),
  }])
})

test('normalizes versions, files, hashes, and author-provided permissions', () => {
  const model = normalizeCivitaiModel({
    id: 7,
    name: 'Example',
    type: 'LORA',
    creator: { username: 'artist' },
    allowCommercialUse: ['Image'],
    modelVersions: [{
      id: 11,
      name: 'v1',
      baseModel: 'SDXL 1.0',
      trainedWords: ['trigger'],
      files: [{ id: 12, name: 'example.safetensors', sizeKB: 1024, hashes: { SHA256: 'ABC' } }],
    }],
  })
  assert.equal(model.creator, 'artist')
  assert.deepEqual(model.permissions.allowCommercialUse, ['Image'])
  assert.equal(model.versions[0].files[0].sizeBytes, 1024 * 1024)
  assert.equal(model.versions[0].files[0].sha256, 'ABC')
})
