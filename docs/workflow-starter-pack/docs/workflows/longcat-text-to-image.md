# Text to Image (LongCat)

Generate image with local LongCat

- **Workflow ID:** `longcat-text-to-image`
- **Category:** `image`
- **Tier:** `standard`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_longcat_text_to_image.json`
- **Starter Pack Setup Workflow:** `workflows/local/longcat-text-to-image.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CFGNorm` - Manual setup
  - Install the LongCat/Flux helper nodes through the Comfy Registry or ComfyUI Manager if this is missing.
  - Docs: https://registry.comfy.org
- `CLIPLoader` - Built into newer ComfyUI builds
  - Core text-encoder loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CLIPTextEncode` - Built into newer ComfyUI builds
  - Core text encoding node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `EmptySD3LatentImage` - Built into newer ComfyUI builds
  - Core SD3-style latent node used by Flux/LongCat graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `FluxGuidance` - Built into newer ComfyUI builds
  - Flux guidance support ships with newer ComfyUI builds.
  - Docs: https://registry.comfy.org
- `KSampler` - Built into newer ComfyUI builds
  - Core sampler node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `ResolutionSelector` - Manual setup
  - Install the helper/custom-node pack that provides ResolutionSelector through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `SaveImage` - Built into newer ComfyUI builds
  - Core image output node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `UNETLoader` - Built into newer ComfyUI builds
  - Core diffusion model loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `ae.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors) |
| `longcat_image_bf16.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | [Download](https://huggingface.co/Comfy-Org/LongCat-Image/resolve/main/split_files/diffusion_models/longcat_image_bf16.safetensors) |
| `qwen_2.5_vl_7b_fp8_scaled.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/longcat-text-to-image.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

