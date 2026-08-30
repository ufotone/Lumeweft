# ElevenLabs Text to Speech

Generate one dialogue audio clip from text using an ElevenLabs voice profile. Used by Short Film Creation.

- **Workflow ID:** `elevenlabs-tts`
- **Category:** `audio`
- **Tier:** `cloud`
- **Runtime:** `cloud`
- **App Workflow JSON:** `/workflows/api_elevenlabs_text_to_speech.json`
- **Starter Pack Setup Workflow:** `workflows/cloud/elevenlabs-tts.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is still a cloud workflow: local model weights are usually not required, but the partner node and API key still are.

## Required Custom Nodes
- `ElevenLabsTextToSpeech` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `ElevenLabsVoiceSelector` - Manual setup
  - No curated install recipe is available yet for this node class.
  - Docs: https://registry.comfy.org
- `SaveAudioMP3` - Built into newer ComfyUI builds
  - Ace-Step audio save nodes are included in newer ComfyUI builds.
  - Docs: https://docs.comfy.org/tutorials/audio/ace-step/ace-step-v1

## Required Models
- None declared

## API Key
- Requires a Comfy account API key in `Settings > ComfyUI Connection > Comfy Account API Key`.

## Setup Steps
1. Import `workflows/cloud/elevenlabs-tts.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Re-open the workflow in ComfyUI and confirm the required partner/custom nodes load cleanly.
4. Add your Comfy account API key in Velorn Settings before queueing.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

