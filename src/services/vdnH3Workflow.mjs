export function modifyVdnH3Workflow(workflow, options = {}) {
  const { prompt = '', width = 608, height = 352, duration = 5, seed = 0,
    filenamePrefix = 'video/CANVAS_vdn_h3' } = options
  const modified = JSON.parse(JSON.stringify(workflow))
  const size = (value, fallback) => Math.max(32, Math.min(4096, Math.round((Number(value) || fallback) / 32) * 32))
  const frames = Math.round(Math.max(5, Math.min(15, Number(duration) || 5)) * 24)
  Object.assign(modified['6'].inputs, {
    prompt: String(prompt || ''), width: size(width, 608), height: size(height, 352),
    length: frames + ((5 - frames % 17) + 17) % 17,
  })
  // The bundled preset is text-to-video. References were not exercised in VDN training.
  delete modified['6'].inputs.first_frame
  delete modified['6'].inputs.last_frame
  Object.assign(modified['16'].inputs, {
    apply_turbo_adapter: true, strength: 1, lora_mode: 'merge',
    branch_weights: 'stream', attention_backend: 'grouped',
  })
  Object.assign(modified['10'].inputs, { steps: 8, scheduler: 'beta', denoise: 1 })
  modified['9'].inputs.sampler_name = 'er_sde'
  modified['7'].inputs.noise_seed = seed
  modified['14'].inputs.fps = 24
  modified['15'].inputs.filename_prefix = filenamePrefix
  return modified
}
