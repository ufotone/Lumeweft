# Irodori-TTS v3

Generate local Japanese dialogue clips with Irodori-TTS v3. Used by Short Film Creation.

- **Workflow ID:** `irodori-tts`
- **Category:** `audio`
- **Tier:** `lite`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/irodori_tts.json`
- **Starter Pack Setup Workflow:** `workflows/local/irodori-tts.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `jupo.IrodoriTTS.ModelLoader` - Auto-install supported
  - Provides the local Irodori-TTS nodes used by Short Film Creation.
  - Repo: https://github.com/jupo-ai/comfy-Irodori-TTS
- `jupo.IrodoriTTS.Sampler` - Auto-install supported
  - Provides the local Irodori-TTS nodes used by Short Film Creation.
  - Repo: https://github.com/jupo-ai/comfy-Irodori-TTS
- `SaveAudioMP3` - Built into newer ComfyUI builds
  - Ace-Step audio save nodes are included in newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `irodori-tts-500m-v3.safetensors` | `models/checkpoints` | `jupo.IrodoriTTS.ModelLoader` | `model` | [Download](https://huggingface.co/Aratako/Irodori-TTS-500M-v3/resolve/main/model.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/irodori-tts.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

