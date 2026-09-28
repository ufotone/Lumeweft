# Reference Video to Video (MiniMax H3 GGUF)

Local Ref2VA GGUF with matched Kijai PDD 8-step acceleration, up to eight optional images, and native audio

- **Workflow ID:** `minimax-h3-gguf-r2v`
- **Category:** `video`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_minimax_h3_gguf_r2v.json`
- **Starter Pack Setup Workflow:** `workflows/local/minimax-h3-gguf-r2v.comfyui.json`
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
- `LoadImage` - Built into newer ComfyUI builds
  - Core image input node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `LoraLoaderModelOnly` - Built into newer ComfyUI builds
  - Core LoRA loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `MiniMaxH3ReferenceToVideo` - Built into newer ComfyUI builds
  - MiniMax H3 reference-to-video support ships with current ComfyUI builds. Update ComfyUI if this node is missing.
  - Docs: https://huggingface.co/PoopMan333/H3_Character_Sheet_Generator
- `MiniMaxH3SigmaShift` - Built into newer ComfyUI builds
  - MiniMax H3 audio/video sigma scheduling ships with current ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/MiniMaxH3SigmaShift
- `PathchSageAttentionKJ` - Auto-install supported
  - Provides image helpers and PathchSageAttentionKJ for H3 acceleration. SageAttention also needs a working sageattention Python package matching the ComfyUI GPU/PyTorch environment; KJNodes requirements do not install it.
  - Repo: https://github.com/kijai/ComfyUI-KJNodes
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
- `VHS_LoadVideo` - Auto-install supported
  - Used by some advanced/hidden video workflows such as workflow import helpers and caption tooling.
  - Repo: https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `minimax_h3_audio_vae_fp32.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_audio_vae_fp32.safetensors) |
| `minimax_h3_video_vae_fp16.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/MiniMax-H3/resolve/main/vae/minimax_h3_video_vae_fp16.safetensors) |
| `MiniMax-H3-encoder-mmproj-F16.gguf` | `models/text_encoders` | `H3ClipLoaderAny` | `mmproj_name` | [Download](https://huggingface.co/joeygambino/MiniMax-H3-encoder-GGUF/resolve/main/MiniMax-H3-encoder-mmproj-F16.gguf) |
| `MiniMax-H3-encoder-Q4_K_M.gguf` | `models/text_encoders` | `H3ClipLoaderAny` | `clip_name` | [Download](https://huggingface.co/joeygambino/MiniMax-H3-encoder-GGUF/resolve/main/MiniMax-H3-encoder-Q4_K_M.gguf) |
| `MiniMax-H3-Ref2VA-Acc-8Step_pruned_comfy.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/Kijai/MiniMax-H3-experimental/resolve/main/loras/MiniMax-H3-Ref2VA-Acc-8Step_pruned_comfy.safetensors) |
| `minimax-h3-ref2va-Q4_0.gguf` | `models/diffusion_models` | `H3ModelLoaderAny` | `model_name` | [Download](https://huggingface.co/molbal/MiniMax-H3-GGUF/resolve/main/minimax-h3-ref2va-Q4_0.gguf) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/minimax-h3-gguf-r2v.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
