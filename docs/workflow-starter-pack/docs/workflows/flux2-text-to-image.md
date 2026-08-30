# Text to Image (Flux 2)

Generate image with local Flux 2

- **Workflow ID:** `flux2-text-to-image`
- **Category:** `image`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_flux2_text_to_image.json`
- **Starter Pack Setup Workflow:** `workflows/local/flux2-text-to-image.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `BasicGuider` - Built into newer ComfyUI builds
  - Core guider node used by modern sampler graphs. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `CLIPLoader` - Built into newer ComfyUI builds
  - Core text-encoder loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CLIPTextEncode` - Built into newer ComfyUI builds
  - Core text encoding node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `ComfySwitchNode` - Manual setup
  - Install the helper/custom-node pack that provides ComfySwitchNode through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `EmptyFlux2LatentImage` - Built into newer ComfyUI builds
  - Flux 2 latent support ships with newer ComfyUI builds.
  - Docs: https://registry.comfy.org
- `Flux2Scheduler` - Built into newer ComfyUI builds
  - Flux 2 scheduler support ships with newer ComfyUI builds.
  - Docs: https://registry.comfy.org
- `FluxGuidance` - Built into newer ComfyUI builds
  - Flux guidance support ships with newer ComfyUI builds.
  - Docs: https://registry.comfy.org
- `KSamplerSelect` - Built into newer ComfyUI builds
  - Core sampler selection node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `LoraLoaderModelOnly` - Built into newer ComfyUI builds
  - Core LoRA loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `RandomNoise` - Built into newer ComfyUI builds
  - Core sampler noise node. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `SamplerCustomAdvanced` - Built into newer ComfyUI builds
  - Core advanced sampler node. Missing this usually means ComfyUI is outdated.
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
| `Flux_2-Turbo-LoRA_comfyui.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/loras/Flux_2-Turbo-LoRA_comfyui.safetensors) |
| `flux2_dev_fp8mixed.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | [Download](https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/diffusion_models/flux2_dev_fp8mixed.safetensors) |
| `full_encoder_small_decoder.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/black-forest-labs/FLUX.2-small-decoder/resolve/main/full_encoder_small_decoder.safetensors) |
| `mistral_3_small_flux2_bf16.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Comfy-Org/flux2-dev/resolve/main/split_files/text_encoders/mistral_3_small_flux2_bf16.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/flux2-text-to-image.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

