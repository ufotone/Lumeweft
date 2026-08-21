import test from 'node:test'
import assert from 'node:assert/strict'

import { repairApiWorkflowModels } from './workflowAutoRepair.js'

const combo = (values) => [values, {}]

test('repairs a model moved into a local subfolder by exact basename', () => {
  const result = repairApiWorkflowModels({
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'wan_model.safetensors' } },
  }, {
    UNETLoader: { input: { required: { unet_name: combo(['WAN/wan_model.safetensors']) } } },
  })
  assert.equal(result.changed, true)
  assert.equal(result.repairedWorkflow[1].inputs.unet_name, 'WAN/wan_model.safetensors')
  assert.equal(result.replacements[0].confidence, 'basename')
})

test('does not guess when multiple similar local candidates are ambiguous', () => {
  const result = repairApiWorkflowModels({
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'wan2.2_i2v_high_noise.safetensors' } },
  }, {
    UNETLoader: { input: { required: { unet_name: combo([
      'wan2.2_i2v_high_noise_fp8.safetensors',
      'wan2.2_i2v_high_noise_bf16.safetensors',
    ]) } } },
  })
  assert.equal(result.changed, false)
  assert.equal(result.unresolved.length, 1)
})

test('never replaces a high-noise reference with a low-noise model', () => {
  const result = repairApiWorkflowModels({
    1: { class_type: 'UNETLoader', inputs: { unet_name: 'wan_i2v_high_noise_missing.safetensors' } },
  }, {
    UNETLoader: { input: { required: { unet_name: combo(['wan_i2v_low_noise.safetensors']) } } },
  })
  assert.equal(result.changed, false)
})
