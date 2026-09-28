# Qwen Image Edit 2509 GGUF (Model + Product)

Local image-edit workflow used by Director Mode for combined model and product keyframes.

- **Workflow ID:** `image-edit-model-product`
- **Category:** `image`
- **Tier:** `standard`
- **Runtime:** `local`
- **App Workflow JSON:** `/workflows/image_qwen_image_edit_2509_Model_and_Product.json`
- **Starter Pack Setup Workflow:** `workflows/local/image-edit-model-product.comfyui.json`
- **Setup Workflow Status:** `available`

## What This Setup Workflow Is
- A ComfyUI-importable copy of the workflow graph bundled with Velorn.
- Use it to inspect missing nodes, model loaders, and expected filenames directly inside ComfyUI.
- This is a local workflow: expect to install the listed custom nodes and local model files before it runs successfully.

## Required Custom Nodes
- `CLIPLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF
- `FluxKontextImageScale` - Built into newer ComfyUI builds
  - Qwen/Flux edit support ships with current ComfyUI releases.
  - Docs: https://registry.comfy.org
- `ImageCompositeMasked` - Built into newer ComfyUI builds
  - Core masked image compositing node. Update ComfyUI if this is missing.
  - Docs: https://registry.comfy.org
- `ImageResizeKJv2` - Auto-install supported
  - Provides image helpers and PathchSageAttentionKJ for H3 acceleration. SageAttention also needs a working sageattention Python package matching the ComfyUI GPU/PyTorch environment; KJNodes requirements do not install it.
  - Repo: https://github.com/kijai/ComfyUI-KJNodes
- `ImageToMask` - Built into newer ComfyUI builds
  - Core mask conversion node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `KSampler` - Built into newer ComfyUI builds
  - Core sampler node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `SaveImage` - Built into newer ComfyUI builds
  - Core image output node. Missing this usually means the ComfyUI install is incomplete or very outdated.
  - Docs: https://registry.comfy.org
- `TextEncodeQwenImageEditPlus` - Built into newer ComfyUI builds
  - Native Qwen image edit support ships with newer ComfyUI builds.
  - Docs: https://docs.comfy.org/built-in-nodes/TextEncodeQwenImageEditPlus
- `UnetLoaderGGUF` - Auto-install supported
  - Loads supported diffusion models and text encoders in GGUF format.
  - Repo: https://github.com/city96/ComfyUI-GGUF

## Required Models
| Filename | ComfyUI Folder | Loader | Input Key | Download |
|---|---|---|---|---|
| `qwen_image_vae.safetensors` | `models/vae` | `VAELoader` | `vae_name` | [Download](https://huggingface.co/Comfy-Org/Qwen-Image_ComfyUI/resolve/main/split_files/vae/qwen_image_vae.safetensors) |
| `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors` | `models/loras` | `LoraLoaderModelOnly` | `lora_name` | [Download](https://huggingface.co/lightx2v/Qwen-Image-Lightning/resolve/main/Qwen-Image-Edit-2509/Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors) |
| `Qwen-Image-Edit-2509-Q4_K_M.gguf` | `models/diffusion_models` | `UnetLoaderGGUF` | `unet_name` | [Download](https://huggingface.co/QuantStack/Qwen-Image-Edit-2509-GGUF/resolve/main/Qwen-Image-Edit-2509-Q4_K_M.gguf) |
| `Qwen2.5-VL-7B-Instruct-mmproj-BF16.gguf` | `models/text_encoders` | `CLIPLoaderGGUF` | `clip_name` | [Download](https://huggingface.co/QuantStack/Qwen-Image-Edit-GGUF/resolve/main/mmproj/Qwen2.5-VL-7B-Instruct-mmproj-BF16.gguf) |
| `Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf` | `models/text_encoders` | `CLIPLoaderGGUF` | `clip_name` | [Download](https://huggingface.co/ggml-org/Qwen2.5-VL-7B-Instruct-GGUF/resolve/main/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf) |

## API Key
- Not required for this workflow.

## Setup Steps
1. Import `workflows/local/image-edit-model-product.comfyui.json` into ComfyUI.
2. Let ComfyUI show any missing custom nodes, then install them in ComfyUI Manager.
3. Place the required model files into the folders listed above.
4. Re-open the workflow in ComfyUI and confirm all loaders resolve.
5. Return to Velorn Generate and click `Re-check` before queueing.

## Related Guides
- `../WHERE_FILES_GO.md`
- `../API_KEYS.md`
- `../TROUBLESHOOTING.md`

