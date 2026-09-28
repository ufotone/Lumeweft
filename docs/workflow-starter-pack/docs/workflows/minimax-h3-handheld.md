# H3ハンドヘルドカメラ

Experimental documentary handheld shake with an optional start image and native audio

- **Workflow ID:** `minimax-h3-handheld`
- **Category:** `video`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_minimax_h3_handheld.json`
- **Starter Pack Setup Workflow:** `workflows/local/minimax-h3-handheld.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
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
- `LoadImage` - Built into newer ComfyUI builds
  - Core image input node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `LoraLoaderModelOnly` - Built into newer ComfyUI builds
  - Core LoRA loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
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
| `handheld_h3_100.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/neph1/minimax_h3_handheld_shaky_camera/resolve/c089b7833cbdffc05bdf17b188e7d7a4aa9e3d88/handheld_h3_100.safetensors) |
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_audio_vae_fp32.safetensors) |
| `minimax_h3_fl2va_pruned_int8_convrot.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors) |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Kijai/MiniMax-H3-experimental/resolve/main/minimax_h3_video_vae_int8_convrot.safetensors) |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/minimax-h3-handheld.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
