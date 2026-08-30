# Media to Prompt (MiniMax H3 Promptor)

Analyze an image or video and write a structured MiniMax H3 generation prompt.

- **Workflow ID:** `minimax-h3-media-promptor`
- **Category:** `text`
- **Tier:** `lite`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/minimax_h3_media_promptor.json`
- **Starter Pack Setup Workflow:** `workflows/local/minimax-h3-media-promptor.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `H3_Promptor` - Auto-install supported
  - Analyzes image and video references and generates structured MiniMax H3 prompts for CANVAS.
  - Repo: https://github.com/1038lab/ComfyUI-MiniMax-H3-Promptor
- `H3_Vision_Analyzer` - Auto-install supported
  - Analyzes image and video references and generates structured MiniMax H3 prompts for CANVAS.
  - Repo: https://github.com/1038lab/ComfyUI-MiniMax-H3-Promptor
- `PreviewAny` - Manual setup
  - Install the preview/helper custom-node pack that provides PreviewAny through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org

## Required Models
- None declared

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/minimax-h3-media-promptor.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Re-open the workflow in ComfyUI and confirm the required partner/custom nodes load cleanly.
4. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

