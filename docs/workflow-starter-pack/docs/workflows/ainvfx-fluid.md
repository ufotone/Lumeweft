# AInVFX Fluid (LTX 2.5)

Paint two keyframes and generate smoke, steam or fire in CANVAS

- **Workflow ID:** `ainvfx-fluid`
- **Category:** `video`
- **Tier:** `pro`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_ainvfx_fluid.json`
- **Starter Pack Setup Workflow:** `workflows/local/ainvfx-fluid.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CFGGuider` - Built into newer ComfyUI builds
  - Core guider node used by advanced sampler graphs. Missing this usually means ComfyUI is outdated.
  - Docs: https://registry.comfy.org
- `CLIPLoader` - Built into newer ComfyUI builds
  - Core text-encoder loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CLIPTextEncode` - Built into newer ComfyUI builds
  - Core text encoding node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `EmptyAudio` - Built into newer ComfyUI builds
  - Update ComfyUI for the AInVFX Fluid silent audio input.
- `EmptyImage` - Built into newer ComfyUI builds
  - ComfyUI core solid-color image batches.
- `EmptyLTXVLatentVideo` - Built into newer ComfyUI builds
  - LTX 2.3 workflow support is built into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/EmptyLTXVLatentVideo
- `ImageBatch` - Built into newer ComfyUI builds
  - ComfyUI core image batch concatenation.
- `ImageScale` - Built into newer ComfyUI builds
  - ComfyUI core image resizing.
- `KSamplerSelect` - Built into newer ComfyUI builds
  - Core sampler selection node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `LoadImage` - Built into newer ComfyUI builds
  - Core image input node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `LTXAddVideoICLoRAGuide` - Auto-install supported
  - Provides native LTX audio-reference conditioning used by the Exact Audio talking-video route.
  - Repo: https://github.com/Lightricks/ComfyUI-LTXVideo
- `LTXICLoRALoaderModelOnly` - Auto-install supported
  - Provides native LTX audio-reference conditioning used by the Exact Audio talking-video route.
  - Repo: https://github.com/Lightricks/ComfyUI-LTXVideo
- `LTXVAudioVAEDecode` - Built into newer ComfyUI builds
  - Update ComfyUI to a build with LTX 2.3 support. If that still does not expose the node, install or update ComfyUI-LTXVideo manually.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVConcatAVLatent` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVConditioning` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVCropGuides` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVSeparateAVLatent` - Built into newer ComfyUI builds
  - LTX workflow nodes are bundled into newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/video/ltx/ltx-2-3
- `LTXVSetAudioRefTokens` - Auto-install supported
  - Provides native LTX audio-reference conditioning used by the Exact Audio talking-video route.
  - Repo: https://github.com/Lightricks/ComfyUI-LTXVideo
- `ManualSigmas` - Built into newer ComfyUI builds
  - Core sigma schedule node used by advanced sampler graphs. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
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
- `VAEDecodeTiled` - Built into newer ComfyUI builds
  - Tiled VAE decode is part of current ComfyUI core.
  - Docs: https://docs.comfy.org/built-in-nodes/VAEDecodeTiled
- `VAEEncodeAudio` - Built into newer ComfyUI builds
  - Requires current ComfyUI with LTX 2.5 audio VAE support.
- `VAELoader` - Built into newer ComfyUI builds
  - Core VAE loader. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `ainvfx-fluid.safetensors` | `models/loras` | `LTXICLoRALoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/AInVFX/ainvfx-fluid/resolve/6b6d96562d5ef6f3bd4a1dd1846504dd4285fdf3/ltx-2.5/ainvfx-fluid.safetensors) |
| `gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors` | `models/text_encoders` | `CLIPLoader` | `clip_name` | [Download](https://huggingface.co/Lightricks/LTX-2.5/resolve/5e6e71018ee1756ed329b697a7b4aedc934dfce9/text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors) |
| `ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors` | `models/diffusion_models` | `UNETLoader` | `unet_name` | [Download](https://huggingface.co/Lightricks/LTX-2.5/resolve/5e6e71018ee1756ed329b697a7b4aedc934dfce9/diffusion_models/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors) |
| `ltx-2.5-audio-vae-bf16.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Lightricks/LTX-2.5/resolve/5e6e71018ee1756ed329b697a7b4aedc934dfce9/vae/ltx-2.5-audio-vae-bf16.safetensors) |
| `ltx-2.5-video-vae-bf16.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Lightricks/LTX-2.5/resolve/5e6e71018ee1756ed329b697a7b4aedc934dfce9/vae/ltx-2.5-video-vae-bf16.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/ainvfx-fluid.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
