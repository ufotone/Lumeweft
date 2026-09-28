# Fast MiniMax H3 T2VA (Anime)

Anime-oriented text to video/audio with optional image and voice references, fused INT8 Turbo/Mystic and SageAttention

- **Workflow ID:** `fast-minimax-h3-t2va`
- **Category:** `video`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_fast_minimax_h3_t2va.json`
- **Starter Pack Setup Workflow:** `workflows/local/fast-minimax-h3-t2va.comfyui.json`
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
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `DiffusionModelLoaderKJ` - Auto-install supported
  - Provides image helpers and PathchSageAttentionKJ for H3 acceleration. SageAttention also needs a working sageattention Python package matching the ComfyUI GPU/PyTorch environment; KJNodes requirements do not install it.
  - Repo: https://github.com/kijai/ComfyUI-KJNodes
- `KSamplerSelect` - Built into newer ComfyUI builds
  - Core sampler selection node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `LoadAudio` - Built into newer ComfyUI builds
  - Core audio input node. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `LoadImage` - Built into newer ComfyUI builds
  - Core image input node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `ManualSigmas` - Built into newer ComfyUI builds
  - Core sigma schedule node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `MiniMaxH3ReferenceToVideo` - Built into newer ComfyUI builds
  - MiniMax H3 reference-to-video support ships with current ComfyUI builds. Update ComfyUI if this node is missing.
  - Docs: https://huggingface.co/PoopMan333/H3_Character_Sheet_Generator
- `MiniMaxH3SigmaShift` - Built into newer ComfyUI builds
  - MiniMax H3 audio/video sigma scheduling ships with current ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/MiniMaxH3SigmaShift
- `RandomNoise` - Built into newer ComfyUI builds
  - Core sampler noise node. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `SamplerCustomAdvanced` - Built into newer ComfyUI builds
  - Core advanced sampler node. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `SaveVideo` - Built into newer ComfyUI builds
  - Core video output support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
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
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_audio_vae_fp32.safetensors) |
| `minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors` | `models/diffusion_models` | `DiffusionModelLoaderKJ` | `model_name` | [Download](https://huggingface.co/MATLOWAI/minimax-h3-fused-turbo-int8-convrot/resolve/main/diffusion_models/minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors) |
| `minimax_h3_video_vae_int8_convrot.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Kijai/MiniMax-H3-experimental/resolve/main/minimax_h3_video_vae_int8_convrot.safetensors) |
| `qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/text_encoders/qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/fast-minimax-h3-t2va.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
