# Text to Video (LTX 2.3)

Generate video from text with local LTX 2.3

- **Workflow ID:** `ltx23-t2v`
- **Category:** `video`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_ltx2_3_t2v.json`
- **Starter Pack Setup Workflow:** `workflows/local/ltx23-t2v.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CFGGuider` - Built into newer ComfyUI builds
  - Core guider node used by advanced sampler graphs. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `CheckpointLoaderSimple` - Built into newer ComfyUI builds
  - Core checkpoint loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `EmptyLTXVLatentVideo` - Built into newer ComfyUI builds
  - LTX 2.3 workflow support is built into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/EmptyLTXVLatentVideo
- `KSamplerSelect` - Built into newer ComfyUI builds
  - Core sampler selection node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `LatentUpscaleModelLoader` - Built into newer ComfyUI builds
  - This loader is built into ComfyUI. Missing it usually means the install is outdated.
  - Docs: https://docs.comfy.org/built-in-nodes/LatentUpscaleModelLoader
- `LoraLoaderModelOnly` - Built into newer ComfyUI builds
  - Core LoRA loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `LTXAVTextEncoderLoader` - Built into newer ComfyUI builds
  - Update ComfyUI to a build with LTX 2.3 support. If that still does not expose the node, install or update ComfyUI-LTXVideo manually.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVAudioVAEDecode` - Built into newer ComfyUI builds
  - Update ComfyUI to a build with LTX 2.3 support. If that still does not expose the node, install or update ComfyUI-LTXVideo manually.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVAudioVAELoader` - Built into newer ComfyUI builds
  - Update ComfyUI to a build with LTX 2.3 support. If that still does not expose the node, install or update ComfyUI-LTXVideo manually.
  - Docs: https://docs.comfy.org/built-in-nodes/LTXVAudioVAELoader
- `LTXVConcatAVLatent` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVConditioning` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVCropGuides` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVEmptyLatentAudio` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVImgToVideoInplace` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVLatentUpsampler` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVPreprocess` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVSeparateAVLatent` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `ManualSigmas` - Built into newer ComfyUI builds
  - Core sigma schedule node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `RandomNoise` - Built into newer ComfyUI builds
  - Core sampler noise node. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `ResizeImageMaskNode` - Built into newer ComfyUI builds
  - Part of current ComfyUI core image utilities.
  - Docs: https://registry.comfy.org
- `ResizeImagesByLongerEdge` - Built into newer ComfyUI builds
  - Part of current ComfyUI core image utilities.
  - Docs: https://docs.comfy.org/built-in-nodes/ResizeImagesByLongerEdge
- `SamplerCustomAdvanced` - Built into newer ComfyUI builds
  - Core advanced sampler node. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `SaveVideo` - Built into newer ComfyUI builds
  - Core video output support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `VAEDecodeTiled` - Built into newer ComfyUI builds
  - Tiled VAE decode is part of current ComfyUI core.
  - Docs: https://docs.comfy.org/built-in-nodes/VAEDecodeTiled

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `gemma_3_12B_it_fp4_mixed.safetensors` | `models/text_encoders` | `LTXAVTextEncoderLoader` | `text_encoder` | [Download](https://huggingface.co/Comfy-Org/ltx-2/resolve/main/split_files/text_encoders/gemma_3_12B_it_fp4_mixed.safetensors) |
| `ltx-2.3-22b-dev-fp8.safetensors` | `models/checkpoints` | `CheckpointLoaderSimple` | `ckpt_name` | [Download](https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors) |
| `ltx-2.3-22b-dev-fp8.safetensors` | `models/checkpoints` | `LTXVAudioVAELoader` | `ckpt_name` | [Download](https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors) |
| `ltx-2.3-22b-dev-fp8.safetensors` | `models/checkpoints` | `LTXAVTextEncoderLoader` | `ckpt_name` | [Download](https://huggingface.co/Lightricks/LTX-2.3-fp8/resolve/main/ltx-2.3-22b-dev-fp8.safetensors) |
| `ltx-2.3-22b-distilled-lora-384.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-22b-distilled-lora-384-1.1.safetensors) |
| `ltx-2.3-spatial-upscaler-x2-1.1.safetensors` | `models/latent_upscale_models` | `LatentUpscaleModelLoader` | `model_name` | [Download](https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-spatial-upscaler-x2-1.1.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/ltx23-t2v.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

