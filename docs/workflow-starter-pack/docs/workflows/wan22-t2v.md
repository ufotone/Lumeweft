# Text to Video (WAN 2.2 GGUF)

Generate video locally with WAN 2.2 Q4_K_M GGUF + Lightning

- **Workflow ID:** `wan22-t2v`
- **Category:** `video`
- **Tier:** `standard`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_wan2_2_14B_t2v.json`
- **Starter Pack Setup Workflow:** `workflows/local/wan22-t2v.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CLIPLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
- `ComfyMathExpression` - Manual setup
  - Install the helper/custom-node pack that provides ComfyMathExpression through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `ComfySwitchNode` - Manual setup
  - Install the helper/custom-node pack that provides ComfySwitchNode through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `EmptyHunyuanLatentVideo` - Built into newer ComfyUI builds
  - Core latent-video node used by WAN text-to-video graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `KSamplerAdvanced` - Built into newer ComfyUI builds
  - Core advanced sampler node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `LoraLoaderModelOnly` - Built into newer ComfyUI builds
  - Core LoRA loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `ModelSamplingSD3` - Built into newer ComfyUI builds
  - Core SD3-style model sampling node used by WAN text-to-video. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `SaveVideo` - Built into newer ComfyUI builds
  - Core video output support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `UnetLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `umt5-xxl-encoder-Q4_K_M.gguf` | `models/text_encoders` | `CLIPLoaderGGUF` | `clip_name` | [Download](https://huggingface.co/city96/umt5-xxl-encoder-gguf/resolve/main/umt5-xxl-encoder-Q4_K_M.gguf) |
| `wan_2.1_vae.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors) |
| `wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_high_noise.safetensors) |
| `wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files/loras/wan2.2_t2v_lightx2v_4steps_lora_v1.1_low_noise.safetensors) |
| `Wan2.2-T2V-A14B-HighNoise-Q4_K_M.gguf` | `models/diffusion_models` | `UnetLoaderGGUF` | `unet_name` | [Download](https://huggingface.co/QuantStack/Wan2.2-T2V-A14B-GGUF/resolve/main/HighNoise/Wan2.2-T2V-A14B-HighNoise-Q4_K_M.gguf) |
| `Wan2.2-T2V-A14B-LowNoise-Q4_K_M.gguf` | `models/diffusion_models` | `UnetLoaderGGUF` | `unet_name` | [Download](https://huggingface.co/QuantStack/Wan2.2-T2V-A14B-GGUF/resolve/main/LowNoise/Wan2.2-T2V-A14B-LowNoise-Q4_K_M.gguf) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/wan22-t2v.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

