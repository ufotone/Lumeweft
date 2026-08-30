# Text to Image (Z Image Turbo GGUF)

Generate images locally with Z Image Turbo Q4_K_M GGUF

- **Workflow ID:** `z-image-turbo`
- **Category:** `image`
- **Tier:** `lite`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_z_image_turbo.json`
- **Starter Pack Setup Workflow:** `workflows/local/z-image-turbo.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CLIPLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
- `KSampler` - Built into newer ComfyUI builds
  - Core sampler node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `ModelSamplingAuraFlow` - Built into newer ComfyUI builds
  - This sampler ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/ModelSamplingAuraFlow
- `SaveImage` - Built into newer ComfyUI builds
  - Core image output node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `UnetLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `ae.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/z_image_turbo/resolve/main/split_files/vae/ae.safetensors) |
| `Qwen3-4B-Q4_K_M.gguf` | `models/text_encoders` | `CLIPLoaderGGUF` | `clip_name` | [Download](https://huggingface.co/unsloth/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf) |
| `z_image_turbo-Q4_K_M.gguf` | `models/diffusion_models` | `UnetLoaderGGUF` | `unet_name` | [Download](https://huggingface.co/jayn7/Z-Image-Turbo-GGUF/resolve/main/z_image_turbo-Q4_K_M.gguf) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/z-image-turbo.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

