# Frame Interpolation

Add in-between frames to smooth video motion

- **Workflow ID:** `frame-interpolation`
- **Category:** `video`
- **Tier:** `standard`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/video_frame_interpolation.json`
- **Starter Pack Setup Workflow:** `workflows/local/frame-interpolation.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `ComfyMathExpression` - Manual setup
  - Install the helper/custom-node pack that provides ComfyMathExpression through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `ComfySwitchNode` - Manual setup
  - Install the helper/custom-node pack that provides ComfySwitchNode through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `CreateVideo` - Built into newer ComfyUI builds
  - CreateVideo is part of newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo
- `FrameInterpolate` - Manual setup
  - Install ComfyUI-Frame-Interpolation or an equivalent frame interpolation node pack.
  - Docs: https://github.com/Fannovel16/ComfyUI-Frame-Interpolation
- `FrameInterpolationModelLoader` - Manual setup
  - Install ComfyUI-Frame-Interpolation or an equivalent frame interpolation node pack.
  - Docs: https://github.com/Fannovel16/ComfyUI-Frame-Interpolation
- `GetVideoComponents` - Manual setup
  - Install the video helper/custom-node pack that provides GetVideoComponents through the Comfy Registry or ComfyUI Manager.
  - Docs: https://registry.comfy.org
- `LoadVideo` - Built into newer ComfyUI builds
  - Core video input node. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `SaveVideo` - Built into newer ComfyUI builds
  - Core video output support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/CreateVideo

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `film_net_fp16.safetensors` | `models/frame_interpolation` | `FrameInterpolationModelLoader` | `model_name` | [Download](https://huggingface.co/Comfy-Org/frame_interpolation/resolve/main/frame_interpolation/film_net_fp16.safetensors) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/frame-interpolation.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

