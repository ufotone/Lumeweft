# First/Last Frame to Video (Seedance 2.0)

Cloud first-frame/last-frame video with ByteDance Seedance 2.0

- **Workflow ID:** `seedance2-flf2v`
- **Category:** `video`
- **Tier:** `cloud`
- **Runtime:** `cloud`
- **App Workflow JSON:** `/workflows/api_seedance2_0_flf2v.json`
- **Starter Pack Setup Workflow:** `workflows/cloud/seedance2-flf2v.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is still a cloud workflow: local model weights are usually not required, but the partner node and API key still are.

## Required Custom Nodes
- `ByteDance2FirstLastFrameNode` - Manual setup
  - This Seedance 2.0 cloud partner node is not mapped to a stable unattended install recipe yet. Use the registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `LoadImage` - Built into newer ComfyUI builds
  - Core image input node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `SaveVideo` - Built into newer ComfyUI builds
  - Core video output support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo

## Required Models
- None declared

## API Key
- Requires a Comfy account API key in `Settings > ComfyUI Connection > Comfy Account API Key`.

## Setup Steps
1. Import `workflows/cloud/seedance2-flf2v.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Re-open the workflow in ComfyUI and confirm the required partner/custom nodes load cleanly.
4. Add your Comfy account API key in Velorn Settings before queueing.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

