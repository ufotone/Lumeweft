# LTX 2.3 Music Video (Image + Audio)

Per-shot LTX 2.3 music-video workflow with audio conditioning and lip-sync for Director Mode music videos

- **Workflow ID:** `music-video-shot-ltx23`
- **Category:** `video`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/music_video_shot_ltx2_3_i2v_audio.json`
- **Starter Pack Setup Workflow:** `workflows/local/music-video-shot-ltx23.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `ComfySwitchNode` - Manual setup
  - Install the helper/custom-node pack that provides ComfySwitchNode through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `DualCLIPLoader` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `GetImageSizeAndCount` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `ImageResizeKJv2` - Auto-install supported
  - Provides ImageResizeKJv2 and GetImagesFromBatchIndexed for bundled helper workflows.
  - Repo: https://github.com/kijai/ComfyUI-KJNodes
- `LatentUpscaleModelLoader` - Built into newer ComfyUI builds
  - This loader is built into ComfyUI. Missing it usually means the install is outdated.
  - Docs: https://docs.comfy.org/built-in-nodes/LatentUpscaleModelLoader
- `LazySwitchKJ` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `LoadAudio` - Built into newer ComfyUI builds
  - Core audio input node. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `LTX2_NAG` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `LTX2AttentionTunerPatch` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `LTX2SamplingPreviewOverride` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `LTXVAudioVAEEncode` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `LTXVChunkFeedForward` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `LTXVConcatAVLatent` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVConditioning` - Built into newer ComfyUI builds
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
- `MelBandRoFormerModelLoader` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `MelBandRoFormerSampler` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `PathchSageAttentionKJ` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `Power Lora Loader (rgthree)` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `ResizeImageMaskNode` - Built into newer ComfyUI builds
  - Part of current ComfyUI core image utilities.
  - Docs: https://registry.comfy.org
- `ResizeImagesByLongerEdge` - Built into newer ComfyUI builds
  - Part of current ComfyUI core image utilities.
  - Docs: https://docs.comfy.org/built-in-nodes/ResizeImagesByLongerEdge
- `SaveVideo` - Built into newer ComfyUI builds
  - Core video output support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `SimpleCalculatorKJ` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `TextGenerateLTX2Prompt` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `TrimAudioDuration` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `UNETLoader` - Built into newer ComfyUI builds
  - Core diffusion model loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `VAELoaderKJ` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `gemma_3_12B_it_fp8_scaled.safetensors` | `models/text_encoders` | `DualCLIPLoader` | `clip_name1` | Manual |
| `ltx-2-19b-lora-camera-control-dolly-out.safetensors` | `models/loras` | `Power Lora Loader (rgthree)` | `lora` | Manual |
| `LTX-2-Image2Vid-Adapter.safetensors` | `models/loras` | `Power Lora Loader (rgthree)` | `lora` | Manual |
| `ltx-2.3_text_projection_bf16.safetensors` | `models/text_encoders` | `DualCLIPLoader` | `clip_name2` | Manual |
| `LTX-2.3-22b-AV-LoRA-talking-head-v1.safetensors` | `models/loras` | `Power Lora Loader (rgthree)` | `lora` | Manual |
| `ltx-2.3-22b-distilled_transformer_only_fp8_scaled.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | Manual |
| `ltx-2.3-spatial-upscaler-x2-1.1.safetensors` | `models/latent_upscale_models` | `LatentUpscaleModelLoader` | `model_name` | [Download](https://huggingface.co/Lightricks/LTX-2.3/resolve/main/ltx-2.3-spatial-upscaler-x2-1.1.safetensors) |
| `Ltx2.3-Licon-VBVR-I2V-96000-R32.safetensors` | `models/loras` | `Power Lora Loader (rgthree)` | `lora` | Manual |
| `LTX23_audio_vae_bf16.safetensors` | `models/vae` | `VAELoaderKJ` | `vae_name` | Manual |
| `LTX23_video_vae_bf16.safetensors` | `models/vae` | `VAELoader` | `vae_name` | Manual |
| `MelBandRoformer_fp16.safetensors` | `models/audio_checkpoints` | `MelBandRoFormerModelLoader` | `model_name` | Manual |
| `taeltx2_3.safetensors` | `models/vae` | `VAELoader` | `vae_name` | Manual |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/music-video-shot-ltx23.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

