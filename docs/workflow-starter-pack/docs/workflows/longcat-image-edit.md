# LongCat Image Edit

Edit image with the local LongCat workflow

- **Workflow ID:** `longcat-image-edit`
- **Category:** `image`
- **Tier:** `standard`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_longcat_image_edit.json`
- **Starter Pack Setup Workflow:** `workflows/local/longcat-image-edit.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CLIPLoader` - Built into newer ComfyUI builds
  - Core text-encoder loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `FluxGuidance` - Built into newer ComfyUI builds
  - Flux guidance support ships with newer ComfyUI builds.
  - Docs: https://registry.comfy.org
- `FluxKontextMultiReferenceLatentMethod` - Manual setup
  - Install the Flux Kontext/LongCat helper nodes through the Comfy Registry or ComfyUI Manager if this is missing.
  - Docs: https://registry.comfy.org
- `ImageScaleToTotalPixels` - Built into newer ComfyUI builds
  - Core image sizing utility. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `KSampler` - Built into newer ComfyUI builds
  - Core sampler node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `SaveImage` - Built into newer ComfyUI builds
  - Core image output node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `TextEncodeQwenImageEdit` - Built into newer ComfyUI builds
  - Native Qwen/LongCat image edit support ships with newer ComfyUI builds.
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
| `longcat_image_edit_bf16.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | Manual |
| `qwen_2.5_vl_7b_fp8_scaled.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/text_encoders/qwen_2.5_vl_7b_fp8_scaled.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/longcat-image-edit.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

