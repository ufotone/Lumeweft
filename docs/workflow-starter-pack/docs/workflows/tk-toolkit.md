# TK Toolkit

Optional ComfyUI toolbox for LoRA, prompts, Danbooru references, outputs, and batch utilities

- **Workflow ID:** `tk-toolkit`
- **Category:** `text`
- **Tier:** `unknown`
- **Runtime:** `local`
- **App Workflow JSON:** `unknown`
- **Starter Pack Setup Workflow:** `not available`
- **Setup Workflow Status:** `pending`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `TK Batch LoRA Loader` - Auto-install supported
  - Optional MIT-licensed ComfyUI toolbox for visual LoRA management, Civitai metadata and downloads, prompt cards, Danbooru search, output browsing, and batch utilities. Models, previews, and remote service content keep their own licenses and terms.
  - Repo: https://github.com/Ararararararaki/comfyui-anima-toolkit

## Required Models
- None declared

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `the packaged workflow JSON` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Re-open the workflow in ComfyUI and confirm the required partner/custom nodes load cleanly.
4. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`
