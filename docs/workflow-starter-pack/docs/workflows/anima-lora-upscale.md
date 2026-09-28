# ANIMA Multi-LoRA + Upscale

Core-node ANIMA image generation with up to five LoRAs and optional model upscaling

- **Workflow ID:** `anima-lora-upscale`
- **Category:** `image`
- **Tier:** `unknown`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_anima_lora_upscale.json`
- **Starter Pack Setup Workflow:** `workflows/local/anima-lora-upscale.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CheckpointLoaderSimple` - Built into newer ComfyUI builds
  - Core checkpoint loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CLIPTextEncode` - Built into newer ComfyUI builds
  - Core text encoding node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `ClownsharKSampler_Beta` - Auto-install supported
  - Approved CANVAS exception for advanced sampling. Provides the source workflow's Clownshar sampler and RES exponential/res_2s behavior.
  - Repo: https://github.com/ClownsharkBatwing/RES4LYF
- `EmptyLatentImage` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `Flux2Scheduler` - Built into newer ComfyUI builds
  - Flux 2 scheduler support ships with newer ComfyUI builds.
  - Docs: https://registry.comfy.org
- `ImageUpscaleWithModel` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `LoraLoader` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `SaveImage` - Built into newer ComfyUI builds
  - Core image output node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `UpscaleModelLoader` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `VAEDecode` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org

## Required Models
- None declared

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/anima-lora-upscale.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Re-open the workflow in ComfyUI and confirm the required partner/custom nodes load cleanly.
4. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
