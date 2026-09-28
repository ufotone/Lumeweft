# NSFW T2I / I2I — Dark Beast KREA 2

Generate from text or optionally edit an adult source image with Civitai version 3078453 Krea 2 FP8

- **Workflow ID:** `dark-beast-krea2-i2i`
- **Category:** `image`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_dark_beast_krea2_i2i.json`
- **Starter Pack Setup Workflow:** `workflows/local/dark-beast-krea2-i2i.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CLIPLoader` - Built into newer ComfyUI builds
  - Core text-encoder loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CLIPTextEncode` - Built into newer ComfyUI builds
  - Core text encoding node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `ConditioningZeroOut` - Built into newer ComfyUI builds
  - Core conditioning utility. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `EmptyLatentImage` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `KSampler` - Built into newer ComfyUI builds
  - Core sampler node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `LoadImage` - Built into newer ComfyUI builds
  - Core image input node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `SaveImage` - Built into newer ComfyUI builds
  - Core image output node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `UNETLoader` - Built into newer ComfyUI builds
  - Core diffusion model loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `VAEDecode` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `VAEEncode` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `darkBeastH3Director_darkBeastKREA2FP8_2958418.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | Manual |
| `qwen_image_vae.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors) |
| `qwen3vl_4b_fp8_scaled.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Comfy-Org/Krea-2/resolve/main/text_encoders/qwen3vl_4b_fp8_scaled.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/dark-beast-krea2-i2i.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
