# VDN-H3 8step

MiniMax H3 hybrid attention, native audio and a dedicated 8-step VDN adapter

- **Workflow ID:** `vdn-h3-t2va`
- **Category:** `video`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_vdn_h3_t2va.json`
- **Starter Pack Setup Workflow:** `workflows/local/vdn-h3-t2va.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `ApplyVDNH3` - Auto-install supported
  - VDN hybrid attention for the plain MiniMax H3 base. Includes its own 8-step adapter; do not stack community Turbo or Scheduled SOL attention. Standard grouped mode needs no new Python dependencies.
  - Repo: https://github.com/Saganaki22/ComfyUI-VDN-H3
- `BasicGuider` - Built into newer ComfyUI builds
  - Core guider node used by modern sampler graphs. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `BasicScheduler` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `CLIPLoader` - Built into newer ComfyUI builds
  - Core text-encoder loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `KSamplerSelect` - Built into newer ComfyUI builds
  - Core sampler selection node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `MiniMaxH3ImageToVideo` - Built into newer ComfyUI builds
  - MiniMax H3 support requires ComfyUI 0.30.0 or newer. Update ComfyUI if this node is missing.
  - Docs: https://docs.comfy.org/built-in-nodes/MiniMaxH3ImageToVideo
- `RandomNoise` - Built into newer ComfyUI builds
  - Core sampler noise node. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `SamplerCustomAdvanced` - Built into newer ComfyUI builds
  - Core advanced sampler node. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `SaveVideo` - Built into newer ComfyUI builds
  - Core video output support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `UNETLoader` - Built into newer ComfyUI builds
  - Core diffusion model loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `VAEDecode` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `VAEDecodeAudio` - Built into newer ComfyUI builds
  - Ace-Step audio decode support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `adapter_config.json` | `models/vdn/stage-dmd-step-250/adapters/default` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/adapters/default/adapter_config.json) |
| `adapter_config.json` | `models/vdn/stage-dmd-step-250/adapters/turbo` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/adapters/turbo/adapter_config.json) |
| `adapter_model.safetensors` | `models/vdn/stage-dmd-step-250/adapters/default` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/adapters/default/adapter_model.safetensors) |
| `adapter_model.safetensors` | `models/vdn/stage-dmd-step-250/adapters/turbo` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/adapters/turbo/adapter_model.safetensors) |
| `config.json` | `models/vdn/stage-dmd-step-250/linear_branch` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/linear_branch/config.json) |
| `metadata.json` | `models/vdn/stage-dmd-step-250` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/metadata.json) |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_audio_vae_fp32.safetensors) |
| `minimax_h3_fl2va_int8_convrot.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_fl2va_int8_convrot.safetensors) |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Kijai/MiniMax-H3-experimental/resolve/main/minimax_h3_video_vae_int8_convrot.safetensors) |
| `model_spec.json` | `models/vdn/stage-dmd-step-250` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/model_spec.json) |
| `model.safetensors` | `models/vdn/stage-dmd-step-250/linear_branch` | `ApplyVDNH3` | `vdn_checkpoint` | [Download](https://huggingface.co/OpenVDN/vdn-minimax-h3/resolve/main/stage-dmd-step-250/linear_branch/model.safetensors) |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/vdn-h3-t2va.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
