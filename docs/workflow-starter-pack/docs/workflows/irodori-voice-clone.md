# Irodori Voice Studio

Design a Japanese voice without a reference or clone one from reference audio, with emoji delivery cues.

- **Workflow ID:** `irodori-voice-clone`
- **Category:** `audio`
- **Tier:** `lite`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/irodori_tts_voice_clone.json`
- **Starter Pack Setup Workflow:** `workflows/local/irodori-voice-clone.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `jupo.IrodoriTTS.CFGConfig` - Auto-install supported
  - Provides the local Irodori-TTS nodes used by Short Film Creation.
  - Repo: https://github.com/jupo-ai/comfy-Irodori-TTS
- `jupo.IrodoriTTS.ModelLoader` - Auto-install supported
  - Provides the local Irodori-TTS nodes used by Short Film Creation.
  - Repo: https://github.com/jupo-ai/comfy-Irodori-TTS
- `jupo.IrodoriTTS.ReferenceAudio` - Auto-install supported
  - Provides the local Irodori-TTS nodes used by Short Film Creation.
  - Repo: https://github.com/jupo-ai/comfy-Irodori-TTS
- `jupo.IrodoriTTS.Sampler` - Auto-install supported
  - Provides the local Irodori-TTS nodes used by Short Film Creation.
  - Repo: https://github.com/jupo-ai/comfy-Irodori-TTS
- `jupo.IrodoriTTS.VoiceDesignConfig` - Auto-install supported
  - Provides the local Irodori-TTS nodes used by Short Film Creation.
  - Repo: https://github.com/jupo-ai/comfy-Irodori-TTS
- `SaveAudioAdvanced` - Built into newer ComfyUI builds
  - Advanced audio output is included in newer ComfyUI builds. Update ComfyUI if this node is missing.
  - Docs: https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `irodori-tts-500m-v2-VoiceDesign.safetensors` | `models/checkpoints` | `jupo.IrodoriTTS.ModelLoader` | `model` | [Download](https://huggingface.co/Aratako/Irodori-TTS-500M-v2-VoiceDesign/resolve/main/model.safetensors) |
| `irodori-tts-500m-v3.safetensors` | `models/checkpoints` | `jupo.IrodoriTTS.ModelLoader` | `model` | [Download](https://huggingface.co/Aratako/Irodori-TTS-500M-v3/resolve/main/model.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/irodori-voice-clone.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

