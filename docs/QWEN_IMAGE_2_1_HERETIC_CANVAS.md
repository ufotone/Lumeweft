# Qwen Image 2.1 Heretic CANVAS integration

Lumeweft CANVAS includes **Qwen Image 2.1 Heretic GGUF** presets for both text-to-image generation and image editing.

## Runtime stack

- Official Qwen Image 2.1 INT8 ConvRot diffusion model
- `pottokao/Qwen-Image-2.1-Text-Encoder-Heretic-GGUF` Q4_K_M text encoder
- Matching F16 `mmproj` vision tower, kept beside the encoder without renaming
- Official Qwen Image 2.1 BF16 VAE
- ComfyUI 0.36.0 or newer, ComfyUI-GGUF, and `ComfyUI-GGUF-Qwen3VL-TE`

The temporary Qwen3-VL add-on exposes no node class. Workflow Setup therefore verifies its `custom_nodes/ComfyUI-GGUF-Qwen3VL-TE` directory separately and offers the curated Git install when missing.

## Transparent PNG behavior

The CANVAS preset contains an **Output Note** control with a persistent **Transparent PNG** switch. The user's saved prompt remains unchanged. When the switch is on, the runtime wraps it with:

```text
This is an RGBA format image with transparency. [prompt]. The image has an alpha channel and a transparent background.
```

The graph always uses `SaveImage`, so Qwen Image 2.1's real alpha channel remains in the PNG and is copied into project Assets without background removal or format conversion.

## Image edit flow

Choose **Qwen Image 2.1 Heretic Edit** in CANVAS, connect one project image as the edit target, and write the requested change in the prompt node. The target is passed to `TextEncodeQwenImage21` as `images.image_1`, together with the same Heretic encoder, matching mmproj vision tower, and RGBA VAE used by the generation preset. The encoder's latent output is sent directly to `KSampler`, matching the official Qwen Image 2.1 edit path and preserving the source canvas and aspect ratio.

The edit node exposes a resolution budget rather than independent width and height. `1024` is the official default, `2048` is the supported maximum, and `0` keeps the source canvas except for the required multiple-of-32 alignment. Prompts may refer to the target as `<image1>`.

The edit preset has its own persistent transparent-PNG switch. When enabled, Lumeweft adds the same RGBA prompt wrapper at execution time; it does not rewrite the saved edit instruction. Workflow Setup shares the four pinned model downloads with the text-to-image preset, so installing one stack satisfies both flows.

## Defaults and boundary

- 1024×1024, editable in multiples of 32; native 2048×2048 is supported.
- 25 steps, CFG 1, Euler, Simple scheduler.
- Negative prompt is unused at CFG 1.
- The Heretic encoder is a refusal-ablated community derivative. The encoder repository states Apache-2.0; the Qwen Image 2.1 diffusion model and VAE retain the Qwen Research License. Lumeweft surfaces this boundary and does not promise commercial eligibility.

## Verification

`tests/qwenImage21Heretic.test.mjs` covers the API graph, prompt wrapper, runtime modifier, exact filenames/checksums, CANVAS registration, and setup planning. Renderer build verifies the UI integration. GPU generation still requires the local models, ComfyUI 0.36.0+, and a restart after installing custom nodes/models.
