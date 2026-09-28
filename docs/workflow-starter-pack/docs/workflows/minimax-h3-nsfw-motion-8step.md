# NSFW MiniMax H3 Motion 8-step

Local GGUF image-to-video with the dedicated 8-step NSFW motion enhancer

- **Workflow ID:** `minimax-h3-nsfw-motion-8step`
- **Category:** `video`
- **Tier:** `standard`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_minimax_h3_gguf_i2v.json`
- **Starter Pack Setup Workflow:** `workflows/local/minimax-h3-nsfw-motion-8step.comfyui.json`
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
- `CLIPLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `H3ClipLoaderAny` - Auto-install supported
  - Provides MiniMax H3 GGUF-aware model/encoder loaders and the in-memory architecture compatibility patch.
  - Repo: https://github.com/jlucasmcrell/ComfyUI-H3-Multishot
- `H3ModelLoaderAny` - Auto-install supported
  - Provides MiniMax H3 GGUF-aware model/encoder loaders and the in-memory architecture compatibility patch.
  - Repo: https://github.com/jlucasmcrell/ComfyUI-H3-Multishot
- `KSamplerSelect` - Built into newer ComfyUI builds
  - Core sampler selection node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `LoraLoaderModelOnly` - Built into newer ComfyUI builds
  - Core LoRA loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `MiniMaxH3ImageToVideo` - Built into newer ComfyUI builds
  - MiniMax H3 support requires ComfyUI 0.30.0 or newer. Update ComfyUI if this node is missing.
  - Docs: https://docs.comfy.org/built-in-nodes/MiniMaxH3ImageToVideo
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
- `UnetLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
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
| `minimax_h3_fl2va_pruned_fp8_Q4_0.gguf` | `models/diffusion_models` | `H3ModelLoaderAny` | `model_name` | [Download](https://huggingface.co/molbal/MiniMax-H3-GGUF/resolve/main/minimax_h3_fl2va_pruned_fp8_Q4_0.gguf) |
| `minimax_h3_video_vae_fp16.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_video_vae_fp16.safetensors) |
| `minimax-h3_fl2v_8Step_motion_enhancer.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/rzgar/minimax-h3_fl2v_8Step_motion_enhancer/resolve/main/minimax-h3_fl2v_8Step_motion_enhancer.safetensors) |
| `MiniMax-H3-encoder-mmproj-F16.gguf` | `models/text_encoders` | `H3ClipLoaderAny` | `mmproj_name` | [Download](https://huggingface.co/joeygambino/MiniMax-H3-encoder-GGUF/resolve/main/MiniMax-H3-encoder-mmproj-F16.gguf) |
| `MiniMax-H3-encoder-Q4_K_M.gguf` | `models/text_encoders` | `H3ClipLoaderAny` | `clip_name` | [Download](https://huggingface.co/joeygambino/MiniMax-H3-encoder-GGUF/resolve/main/MiniMax-H3-encoder-Q4_K_M.gguf) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/minimax-h3-nsfw-motion-8step.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
