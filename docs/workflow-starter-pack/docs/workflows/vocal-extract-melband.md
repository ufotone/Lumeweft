# Vocal Extract (Mel-Band RoFormer)

Isolate vocals from a mixed song using Mel-Band RoFormer. Used as a one-time preprocessing step for music-video projects.

- **Workflow ID:** `vocal-extract-melband`
- **Category:** `audio`
- **Tier:** `standard`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/vocal_extract_melband.json`
- **Starter Pack Setup Workflow:** `workflows/local/vocal-extract-melband.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `LoadAudio` - Built into newer ComfyUI builds
  - Core audio input node. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `MelBandRoFormerModelLoader` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `MelBandRoFormerSampler` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `SaveAudioMP3` - Built into newer ComfyUI builds
  - Ace-Step audio save nodes are included in newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `MelBandRoformer_fp16.safetensors` | `models/audio_checkpoints` | `MelBandRoFormerModelLoader` | `model_name` | Manual |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/vocal-extract-melband.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

