# Caption Transcription (Qwen ASR)

Transcribe timeline audio, video audio, or music-video songs into timed SRT captions using Qwen ASR.

- **Workflow ID:** `caption-qwen-asr`
- **Category:** `audio`
- **Tier:** `unknown`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/caption_qwen_asr_transcription.json`
- **Starter Pack Setup Workflow:** `workflows/local/caption-qwen-asr.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `ASRPunctuationTruecaseNode` - Auto-install supported
  - Provides Qwen ASR transcription, punctuation/truecase cleanup, and SRT builder nodes used by caption generation and Music Video timed lyrics.
  - Repo: https://github.com/diodiogod/TTS-Audio-Suite
- `Qwen3TTSEngineNode` - Auto-install supported
  - Provides Qwen ASR transcription, punctuation/truecase cleanup, and SRT builder nodes used by caption generation and Music Video timed lyrics.
  - Repo: https://github.com/diodiogod/TTS-Audio-Suite
- `ShowText|pysssss` - Auto-install supported
  - Provides Show Text, which the caption workflow uses to expose the generated SRT text back to Velorn.
  - Repo: https://github.com/pythongosssss/ComfyUI-Custom-Scripts
- `SRTAdvancedOptionsNode` - Auto-install supported
  - Provides Qwen ASR transcription, punctuation/truecase cleanup, and SRT builder nodes used by caption generation and Music Video timed lyrics.
  - Repo: https://github.com/diodiogod/TTS-Audio-Suite
- `TextToSRTBuilderNode` - Auto-install supported
  - Provides Qwen ASR transcription, punctuation/truecase cleanup, and SRT builder nodes used by caption generation and Music Video timed lyrics.
  - Repo: https://github.com/diodiogod/TTS-Audio-Suite
- `UnifiedASRTranscribeNode` - Auto-install supported
  - Provides Qwen ASR transcription, punctuation/truecase cleanup, and SRT builder nodes used by caption generation and Music Video timed lyrics.
  - Repo: https://github.com/diodiogod/TTS-Audio-Suite
- `VHS_LoadAudioUpload` - Auto-install supported
  - Used by some advanced/hidden video workflows such as workflow import helpers and caption tooling.
  - Repo: https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite
- `VHS_LoadVideo` - Auto-install supported
  - Used by some advanced/hidden video workflows such as workflow import helpers and caption tooling.
  - Repo: https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite

## Required Models
- None declared

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/caption-qwen-asr.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Re-open the workflow in ComfyUI and confirm the required partner/custom nodes load cleanly.
4. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

