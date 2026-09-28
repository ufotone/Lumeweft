// Preserve the official stage directory: the two adapters share filenames.
export const VDN_H3_WORKFLOW_ID = 'vdn-h3-t2va'
export const VDN_H3_CHECKPOINT = 'stage-dmd-step-250'
export const VDN_H3_STAGE_FILES = Object.freeze([
  {
    "filename": "adapter_config.json",
    "targetSubdir": "vdn/stage-dmd-step-250/adapters/default",
    "relativePath": "stage-dmd-step-250/adapters/default/adapter_config.json",
    "sizeBytes": 415,
    "sha256": "89e0ff8920b9629b826eb99ab6150cce6924a53aa445186d1b493225fd091b96"
  },
  {
    "filename": "adapter_model.safetensors",
    "targetSubdir": "vdn/stage-dmd-step-250/adapters/default",
    "relativePath": "stage-dmd-step-250/adapters/default/adapter_model.safetensors",
    "sizeBytes": 334026912,
    "sha256": "58558fef506f88bb41649242de9b9b3a365da806b51b2e96afbbe1625222058a"
  },
  {
    "filename": "adapter_config.json",
    "targetSubdir": "vdn/stage-dmd-step-250/adapters/turbo",
    "relativePath": "stage-dmd-step-250/adapters/turbo/adapter_config.json",
    "sizeBytes": 22264,
    "sha256": "627968f670747c29cd7a0d3f8c75166e501d70f9e829b5cd3242a8f14cefbc18"
  },
  {
    "filename": "adapter_model.safetensors",
    "targetSubdir": "vdn/stage-dmd-step-250/adapters/turbo",
    "relativePath": "stage-dmd-step-250/adapters/turbo/adapter_model.safetensors",
    "sizeBytes": 851452696,
    "sha256": "24fc93c82fe84dc45d0627f4e72c637bc387d282ba18f60ed3b7f8c81089392c"
  },
  {
    "filename": "config.json",
    "targetSubdir": "vdn/stage-dmd-step-250/linear_branch",
    "relativePath": "stage-dmd-step-250/linear_branch/config.json",
    "sizeBytes": 465,
    "sha256": "decb06ac7e664610f677fb445318502b3c51f9c1b8603a2cdd00b16042be5bc8"
  },
  {
    "filename": "model.safetensors",
    "targetSubdir": "vdn/stage-dmd-step-250/linear_branch",
    "relativePath": "stage-dmd-step-250/linear_branch/model.safetensors",
    "sizeBytes": 4279428112,
    "sha256": "dec6981c7874f5b3bc92d1a02e256b673a3b3499dc1a124714bb3b19da602855"
  },
  {
    "filename": "metadata.json",
    "targetSubdir": "vdn/stage-dmd-step-250",
    "relativePath": "stage-dmd-step-250/metadata.json",
    "sizeBytes": 463,
    "sha256": "54054ceb1c91b3fdf7fa0278e4a8841c127e8cf666b5e240d69613661f9d3e9e"
  },
  {
    "filename": "model_spec.json",
    "targetSubdir": "vdn/stage-dmd-step-250",
    "relativePath": "stage-dmd-step-250/model_spec.json",
    "sizeBytes": 25705,
    "sha256": "4171f4384e952f1f73467981a893440c03298af4956b947e2c8a857ba9f5a62b"
  }
].map(file => Object.freeze(file)))
