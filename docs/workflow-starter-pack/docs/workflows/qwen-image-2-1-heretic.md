# Qwen Image 2.1 Heretic GGUF

Generate locally with Qwen Image 2.1, the Heretic Q4_K_M text encoder, and optional native RGBA transparency

- **Workflow ID:** `qwen-image-2-1-heretic`
- **Category:** `image`
- **Tier:** `unknown`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_qwen_image_2_1_heretic.json`
- **Starter Pack Setup Workflow:** `workflows/local/qwen-image-2-1-heretic.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CLIPLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
- `EmptyLatentImage` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `KSampler` - Built into newer ComfyUI builds
  - Core sampler node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `SaveImage` - Built into newer ComfyUI builds
  - Core image output node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `TextEncodeQwenImage21` - Built into newer ComfyUI builds
  - Qwen Image 2.1 support requires ComfyUI 0.36.0 or newer. Update ComfyUI if this node is missing.
  - Docs: https://blog.comfy.org/p/qwen-image-21-in-comfyui-open-weight
- `UNETLoader` - Built into newer ComfyUI builds
  - Core diffusion model loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `VAEDecode` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `mmproj-qwen3vl_8b_heretic-f16.gguf` | `models/text_encoders` | `CLIPLoaderGGUF` | `clip_name` | [Download](https://huggingface.co/pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF/resolve/main/mmproj-qwen3vl_8b_heretic-f16.gguf) |
| `qwen_image_2.1_int8_convrot.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | [Download](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/diffusion_models/qwen_image_2.1_int8_convrot.safetensors) |
| `qwen_image_2.1_vae_bf16.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/Qwen-Image-2.1/resolve/main/vae/qwen_image_2.1_vae_bf16.safetensors) |
| `qwen3vl_8b_heretic-Q4_K_M.gguf` | `models/text_encoders` | `CLIPLoaderGGUF` | `clip_name` | [Download](https://huggingface.co/pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF/resolve/main/qwen3vl_8b_heretic-Q4_K_M.gguf) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/qwen-image-2-1-heretic.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
