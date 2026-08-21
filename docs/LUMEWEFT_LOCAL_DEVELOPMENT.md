# Lumeweft Local Development Memory

Last updated: 2026-08-19

This is the durable first-read handoff for the user's local Lumeweft development. It records decisions and implemented behavior from the long Codex collaboration that produced the current dirty worktree. When a future request mentions **Lumeweft**, **Velorn**, or **velron**, read this file before relying on upstream Velorn documentation.

The repository-level `AGENTS.md` contains the keyword-routing instruction used by development agents.

## Identity and scope

- Lumeweft is a separately named fork of the open-source Velorn video editor. The separate name avoids confusion with the upstream author/project.
- The active Lumeweft branch includes the official Velorn `v0.3.28` changes as of 2026-08-21. This includes Qwen ASR compatibility with both the newer `model_variant` and legacy `model_size` TTS-Audio-Suite schemas, while retaining the local Lumeweft features below.
- Upstream Velorn should remain the safer/general product. Lumeweft explores broader external-model workflows without advertising the fork with blunt wording such as “adult-content support.”
- External models and their outputs are used entirely at the user's own risk. Lumeweft makes no guarantee about legality, licenses, commercial use, safety, correctness, or availability.
- The External Models feature has an adult/own-risk/third-party-rules consent gate. Preserve this boundary.
- The editor/timeline is the long-term master. Generation records/history should be recoverable and linked to assets, timelines, and ComfyUI workflows rather than becoming an unstructured pile of outputs.

## Local paths and startup

- The active checkout and optional desktop launcher paths are developer-specific and are intentionally not recorded in the public repository.
- The observed ComfyUI installation path is developer-specific; configure it through Lumeweft Settings.
- Typical ComfyUI endpoint: `http://127.0.0.1:8188`
- The launcher is intended to close its PowerShell host when Lumeweft exits.
- The checkout is intentionally dirty and contains the user's accumulated work. Never reset or discard it.

## External model catalog

- Generate includes a **Community** source tab with the internal route ID `community`. Legacy saved `external` route values migrate on load. Civitai is active; other providers are currently disabled placeholders.
- Placeholder providers include Hugging Face, Tensor.Art, LiblibAI, and Shakker AI. Keep the architecture provider-neutral even while Civitai is the implementation focus.
- Both `civitai.com` and `civitai.red` model URLs are accepted. They use the same Civitai model/download API family for this integration.
- URL search history is persisted so failed or previous models can be retried.
- Civitai example thumbnails are shown at no more than roughly 200×200.

## Civitai install behavior

- Model metadata is fetched through Electron main-process IPC to avoid renderer CORS differences.
- A Civitai API key is stored in app settings and used for login-only downloads and example generation data.
- Downloads follow Civitai's authenticated redirect manually and remove Authorization before the signed object-store request. This fixed redirect cancellation/400 failures.
- Download cancellation is available.
- Download progress/state remains visible when switching Generate sub-tabs.
- For duplicate-looking alternatives (for example checkpoint versus diffusion model), select/install only the preferred primary file by default. Do not automatically download every same-named alternative.
- Installed detection is filename-based because hashing 10–30 GB files on every view is too expensive. Reserve SHA-256 verification for new downloads or explicit diagnosis after a load/generation failure.
- Existing matching filenames display **このモデルで生成** instead of Review download.

## “Generate with this model” Krea 2 path

- The current Civitai-focused model-to-workflow path supports Krea 2-compatible diffusion models.
- `src/components/generate/CommunityModelBrowser.jsx` builds a flat core-node API workflow using UNETLoader, CLIPLoader, VAELoader, CLIPTextEncode, ConditioningZeroOut, EmptyLatentImage, KSampler, VAEDecode, and SaveImage.
- The installed Civitai diffusion-model filename is injected into UNETLoader.
- Default supporting files currently referenced are `qwen3vl_4b_fp8_scaled.safetensors` and `qwen_image_vae.safetensors`. ComfyUI reports them if missing.
- API-format prompts are converted to ComfyUI UI graphs by `src/services/comfyWorkflowGraph.js`, then loaded into embedded ComfyUI through `src/services/workflowSetupManager.js` and Electron IPC.
- ComfyUI 0.33.1 / frontend 1.48.7 was observed locally. Loading must prefer the official `/scripts/app.js` singleton and wait for `loadGraphData`, `rootGraph`, `canvas`, and `canvasEl` before opening a graph.
- Workflow loading currently allows about 45 seconds. The previous `Cannot read properties of undefined (reading 'getGraph')` failure was fixed by waiting for the real initialized ComfyUI app/graph/canvas.
- The user successfully generated an image with this path.

## “Generate with this model” LoRA path

- Installed Civitai LoRA/LyCORIS files also expose **Generate with this model** and the example-thumbnail right-click action.
- A LoRA cannot generate alone. `CommunityModelBrowser.jsx` reads `CheckpointLoaderSimple.ckpt_name` choices from the connected ComfyUI `/object_info`, suggests a checkpoint using the Civitai base-model family, and keeps the checkpoint selectable in the UI.
- The opened core-node workflow uses CheckpointLoaderSimple, LoraLoader, CLIPTextEncode, EmptyLatentImage, KSampler, VAEDecode, and SaveImage. The default prompt includes published trigger words.
- ANIMA LoRAs are a separate split-model path. Do not feed an ANIMA diffusion-only file through `CheckpointLoaderSimple`: use `UNETLoader`, `CLIPLoader` with `qwen_3_06b_base.safetensors`, `VAELoader` with `qwen_image_vae.safetensors`, and `LoraLoaderModelOnly`. A diffusion-only ANIMA file otherwise returns `CLIP: None` and `VAE: None`.
- Before opening a LoRA workflow, use the exact relative name reported by `LoraLoader.lora_name`, not only the downloaded basename. Remount the embedded ComfyUI iframe so frontend combo choices cached before the download are refreshed; otherwise ComfyUI can label an on-disk/API-visible LoRA as missing.
- The remount must be acknowledged by the replacement iframe's `load` event before Electron looks up its frame. After that, wait for ComfyUI's own canvas to remain connected and visible across several checks before calling `loadGraphData`; a fixed short delay can hit the old frame or ComfyUI's transient `getCanvas: canvas is null` startup state.
- Example reuse applies the published prompt and common generation parameters, plus a published LoRA resource weight when Civitai exposes one. The user-selected/local compatible checkpoint remains authoritative; do not silently download or substitute an author-specific base model.

## Civitai example parameter reuse

- Civitai model-version thumbnail responses expose numeric image IDs in their image URLs.
- Right-clicking a thumbnail now shows **この画像のパラメータで生成**; left-click still opens the original image.
- Electron fetches `image.getGenerationData` from Civitai's tRPC API with the saved API key.
- Published Prompt, Seed, Steps, CFG, Sampler, Scheduler, Denoise, width, and height are applied to the local compatible Krea 2 workflow.
- Preserve the published prompt language (often Chinese) as-is. Do not translate implicitly.
- Use the locally installed model rather than blindly copying the author's model filename.
- Do not load the author's entire workflow by default: examples may contain creator-specific VAE/upscaler/custom-node dependencies. The fetched original Comfy workflow may be retained as provenance, while the executable path uses the local compatible core graph.
- Confirmed example `135141930` published a Chinese prompt with seed `264721047582143`, 16 steps, CFG 1, Euler, simple, denoise 1, and 960×1440 generation size.

## ComfyUI output auto-import

- Outputs executed directly from the embedded ComfyUI tab must return to Lumeweft assets automatically.
- `src/services/comfyAutoImport.js` monitors newly completed unmanaged prompts from the connected ComfyUI instance, independent of the currently selected Lumeweft tab.
- Startup history is baselined so old ComfyUI outputs are not imported on launch.
- Managed Generate jobs retain their own import path and prompt guard.
- Imported direct-Comfy outputs go to virtual folders:
  - `Imported from ComfyUI/Images`
  - `Imported from ComfyUI/Videos`
  - `Imported from ComfyUI/Audio`
- Files are copied into the active project and registered in the asset store. Workflow sidecars are written when possible.
- Animation-like numbered image sequences can be stitched to MP4; ordinary batches remain separate image assets.
- The user confirmed direct ComfyUI generation now appears in Lumeweft assets.

## Generate UI and prompt decisions

- Music Video output settings keep visible 720p/1080p and 24/25/30 FPS buttons, with expandable custom width/height and FPS inputs. Custom dimensions are normalized to 64-4096 in multiples of 8; custom FPS is limited to 1-120.
- Music Video keyframe/video cards can be switched between 2, 3, or 4 columns and their prompt previews can be expanded. These display preferences persist per project.
- Music Video shot cards can individually cancel Lumeweft jobs that are still waiting (`queued` or `paused`). Cancelling removes the job from the queue instead of retaining a cancelled entry. Do not use the ComfyUI global interrupt for this control; once a job starts, the waiting-job X is no longer offered.
- The Generate queue panel should provide local reference-image picking and prompt entry rather than failing with “Please select reference image...” after queueing.
- Inputs should also synchronize into the Edit/timeline context.
- Prompt translation must not require a local LLM. Local LLM is optional.
- The application UI language is the source-language assumption. Translate to English or Simplified Chinese only when target differs from the active source language. Do not translate English→English or Chinese→Chinese.
- Provide a way to restore the original source text.
- Generation messages should be localized; raw English validation errors are not adequate UX.

## Image/video to prompt (MiniMax H3 Promptor)

- CANVAS includes an **Image / Video -> Prompt** template backed by `1038lab/ComfyUI-MiniMax-H3-Promptor`.
- Project images are sent at their native media dimensions. Project videos are uploaded as videos and sampled across time by the H3 Vision Analyzer; they are not reduced to a single Lumeweft frame.
- The Prompt Assist inspector exposes optional creative direction, 4-15 second target duration, English/Chinese output, and separate image/video analysis presets.
- Workflow Setup can install the H3 Promptor custom node and requirements. The user must configure vision and prompt LLM providers in the custom node's ComfyUI settings; Lumeweft reads each node's configured default provider from `/object_info` at execution time.
- The final `PreviewAny` text is returned to the CANVAS node and can be connected to Text Viewer or downstream generation nodes.

## Short Film Irodori-TTS

- Short Film Creation supports a TTS engine choice between the existing ElevenLabs partner workflow and local Irodori-TTS v3.
- The Irodori path creates one editable audio asset per dialogue line, preserving the same downstream LTX dialogue-shot routing as ElevenLabs.
- The bundled minimal graph uses `jupo.IrodoriTTS.ModelLoader`, `jupo.IrodoriTTS.Sampler`, and the core `SaveAudioMP3` node. It uses v3 automatic duration estimation (`seconds = 0`).
- Workflow Setup has curated installation recipes for `jupo-ai/comfy-Irodori-TTS`, its `requirements.txt`, and `Aratako/Irodori-TTS-500M-v3` as `irodori-tts-500m-v3.safetensors` under `models/checkpoints`.
- Existing copies inside checkpoint subfolders (for example `models/checkpoints/irodori_tts/`) are detected by basename and reused. Missing requirements open Workflow Setup from the Short Film voice queue; after installing custom nodes, ComfyUI must be restarted before re-checking.

## Dependencies and assets

- Missing workflow dependencies should be detected and automatically downloaded when a curated safe recipe is available; automatic installs do not require a redundant confirmation dialog.
- Missing/manual/core-update cases should remain explicit.
- Generated virtual asset folders must be deletable through project-only deletion even when disk deletion is inappropriate or the folder was created automatically.

## Product direction

- Preserve Velorn/Lumeweft's differentiator: a commercial-grade multi-track timeline plus GLSL effects combined with guided AI generation.
- Treat the timeline as master and link generation records, assets, and ComfyUI provenance back to it.
- A generation/history record should retain enough information to reconstruct or reopen the workflow and parameters.
- Keep common generation paths guided. Do not force ordinary users to edit node graphs, while still allowing advanced ComfyUI access and custom workflows.

## Verification and known benign logs

- After renderer changes run `npm run build`.
- After Electron changes run `node --check electron/main.js` and `node --check electron/preload.js`.
- Existing Vite large-chunk and mixed dynamic/static import warnings are known and are not build failures.
- ComfyUI legacy-API deprecation warnings (`/scripts/ui.js`, `clipspace.js`, `widgetInputs.js`, button.js) currently come from outdated custom-node extensions and did not prevent generation.
- `ComfyRegistry cache update is still in progress` followed by `[DONE]` is informational.

## Important files changed in this local effort

- `AGENTS.md`
- `electron/main.js`
- `electron/preload.js`
- `src/App.jsx`
- `src/components/GenerateWorkspace.jsx`
- `src/components/SettingsModal.jsx`
- `src/components/generate/CommunityModelBrowser.jsx`
- `src/components/generate/WorkflowBrowser.jsx`
- `src/components/panels/AssetsPanel.jsx`
- `src/config/brand.js`
- `src/config/generateWorkflowCatalog.js`
- `src/config/workflowInstallCatalog.js`
- `src/services/civitai.js`
- `src/services/comfyAutoImport.js`
- `src/services/comfyWorkflowGraph.js`
- `src/services/externalModelConsent.js`
- `src/services/promptTranslation.js`
- `src/services/workflowSetupManager.js`
- `src/stores/generationHistoryStore.js`

## First action in a future chat

1. Read this file and `AGENTS.md`.
2. Inspect `git status`; do not assume uncommitted changes are disposable.
3. Read only the task-relevant source and newer handoff notes.
4. Treat `docs/AI_CURRENT_HANDOFF.md` as upstream historical context where it conflicts with this 2026-08-15 local fork memory.
5. Continue from the current implementation instead of recreating completed work.
