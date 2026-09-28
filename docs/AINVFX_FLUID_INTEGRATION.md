# AInVFX Fluid in Lumeweft

Implemented 2026-09-14. Velorn port is deferred until local generation quality is verified.

## User flow

CANVAS → new-document template **AInVFX Fluid — Paint to VFX** (Japanese: **描画からVFX**).
Select the first frame node and paint flat grey, white or orange/yellow shapes on black in the Inspector. Save the keyframe. Select the last frame, optionally copy the saved first frame, repaint and save. Existing images can also be assigned and repainted.

The shared layered Paint dialog now replaces the original inline painter. Each save imports a new PNG under `assets/images/Paint` and an editable sidecar under `assets/paint`; earlier assets remain intact. See `LAYERED_PAINT.md`.

Run the VFX node with a smoke, steam or fire prompt. The runtime inserts `ainvfxfluid` when absent. Defaults: 512×512, 121 frames, 25 fps (4.84 s), seed 42, LoRA strength 1, Euler ancestral, the source's eight-step sigma schedule, CFG 1. Supported FPS: 24/25/50. Dimensions must be multiples of 64, 64–2048. Images are resized without cropping to the selected dimensions, so prepare a matching aspect ratio to avoid distortion. Generated takes use the existing CANVAS import, history/workflow provenance and output-folder path (`CANVAS/AInVFX Fluid`). No automatic timeline mutation occurs.

## Implementation boundary

- `src/services/ainvfxFluidWorkflow.mjs`: validates/configures the executable graph.
- `public/workflows/video_ainvfx_fluid.json`: flat API graph authored from the published recipe.
- `src/components/LayerPaintDialog.jsx`: shared layered painter with masks, undo/redo, first-frame image layer and project-asset save.
- `src/config/ainvfxFluidConfig.js`: pinned five-file model manifest with sizes and SHA-256 hashes; shared by dependency packs and Workflow Setup download recipes.
- Registry, CANVAS schema/runtime, Inspector, Japanese/English locale and Workflow Setup gallery additions.
- `tests/ainvfxFluidWorkflow.test.mjs`: graph invariants, validation, dependency coverage and actual CANVAS runtime integration with mocked external IO.

Core `ImageBatch` nodes compose [first, 119 black frames, last]. The first frame is a painted guide, not an image-to-video identity constraint. IC-LoRA's downscale factor is connected from the loader metadata output (the installed file reports 2). The video latent is conditioned with the entire control batch. Silent audio is encoded/frozen as in the source recipe; AV latents are sampled jointly and guide latents are cropped before video decode. The current SaveVideo dynamic format input is included.

The only custom-node pack is official **Lightricks/ComfyUI-LTXVideo** for `LTXICLoRALoaderModelOnly`, `LTXAddVideoICLoRAGuide`, and `LTXVSetAudioRefTokens`. The upstream Painter, UI subgraphs, switches, prompt enhancer and optional API encoder are replaced/omitted. No extra enhancer model, third-party convenience nodes or paid API is required. Intermediate painted keyframes/control-video input are not exposed in this initial two-keyframe preset.

## Installation and validation status

- Renderer production build and 24 focused/regression tests passed.
- Browser UI checked using the actual CANVAS component and an isolated in-memory project: paint, undo, save two distinct PNG assets, copy first frame, change FPS with fixed frame count.
- Existing local ComfyUI 0.34.0 / frontend 1.49.6 was started on a temporary isolated CPU validation endpoint with only LTXVideo enabled. All graph node classes, required inputs and link types matched its object schema. Prompt preflight reported only the four absent base files and two unassigned test image filenames; no prompt was queued. This is schema validation, not GPU inference or a quality test.
- `ainvfx-fluid.safetensors` (654,446,312 bytes) was installed into the configured ComfyUI `models/loras` folder, SHA-256 verified, and detected by ComfyUI.
- **Actual generation remains unverified.** LTX 2.5 transformer, Gemma 4 text encoder and two VAEs are absent locally. The base download returned HTTP 401. The user must obtain Hugging Face access approval and the four files through their authorized account; source/target links are in Workflow Setup. No access gate was bypassed. Model stack totals 39,368,539,796 bytes. No guessed GPU-memory minimum is advertised.

## Provenance and port checklist

Source: https://huggingface.co/AInVFX/ainvfx-fluid

Recipe: https://huggingface.co/AInVFX/ainvfx-fluid/blob/6b6d96562d5ef6f3bd4a1dd1846504dd4285fdf3/workflow/ainvfx-fluid_painted_smoke_plume.json

Base: https://huggingface.co/Lightricks/LTX-2.5/tree/5e6e71018ee1756ed329b697a7b4aedc934dfce9

Node implementation: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/master/iclora.py

Author: Adrien Toupet / AInVFX. Model weights retain LTX-2.x Community License terms; download links/checksums are bundled, not model weights or upstream example images. Preserve the information card and source/license links when porting. Smoke/steam/fire are the trained effects; a painted photo is reinterpreted, not preserved pixel-for-pixel. Output is ordinary video without alpha. Composite a black-background take over a locked plate in Edit as needed.

Before a Velorn port: obtain the missing stack, generate a 512×512 take and a landscape take, verify temporal control and final import/history/reopening in Electron, inspect GPU memory and timing, then extract only this integration's changes from the intentionally dirty Lumeweft checkout. Do not copy unrelated accumulated local work.
