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
- CANVAS also includes **NSFW T2I / I2I — Dark Beast KREA 2** for Civitai model version `3078453`. Although the parent page is named “Dark Beast H3 Director Edition,” that exact version is `Dark Beast KREA 2 FP8`; the graph therefore uses Krea 2 core nodes. With no source image it samples an `EmptyLatentImage` for T2I; connecting the optional source switches to conventional latent I2I (`LoadImage` -> `VAEEncode` -> `KSampler`) rather than MiniMax H3 or Qwen multi-reference editing.
- The Dark Beast CANVAS preset uses the published Euler / Simple / CFG 1 operating point, 16 steps, and an editable default denoise of 0.55. Lower denoise preserves more source identity; higher values permit stronger changes. The exact Civitai model is installed through Generate > Community because Civitai authentication may be required, while Workflow Setup can install the official Comfy-Org Krea 2 text encoder and VAE.

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
- Completed and failed items in the Generate queue expose a per-result delete action. Failed items are removed from the visible queue; completed items also remove their owned project assets, fully-owned Generation History version, and project-local output/cache files after confirmation. Input and reference assets are never included.
- Generation History uses the same destructive cleanup policy for Version, whole-record, and multi-record deletion: related generated assets and project-local output/cache files are deleted together with the selected history. Outputs still referenced by an unselected Version are protected.
- Generation History renders image and video outputs from their own media URLs. Audio, music, and other non-visual outputs use the shared generated eighth-note thumbnail at `public/generated-thumbnails/audio-eighth-note.webp`, avoiding broken image previews for audio URLs.
- Generation Recipes can be marked for image, video, or audio/music use. Audio/music recipes without a manually registered thumbnail reuse the same generated eighth-note art, and the saved-recipe list includes an audio/music filter and badge.

## Image/video to prompt (MiniMax H3 Promptor)

- CANVAS includes an **Image / Video -> Prompt** template backed by `1038lab/ComfyUI-MiniMax-H3-Promptor`.
- Project images are sent at their native media dimensions. Project videos are uploaded as videos and sampled across time by the H3 Vision Analyzer; they are not reduced to a single Lumeweft frame.
- The Prompt Assist inspector exposes optional creative direction, 4-15 second target duration, English/Chinese output, and separate image/video analysis presets.
- Workflow Setup can install the H3 Promptor custom node and requirements. The user must configure vision and prompt LLM providers in the custom node's ComfyUI settings; Lumeweft reads each node's configured default provider from `/object_info` at execution time.
- H3 Promptor v1.4+ uses `H3_Vision` and the Promptor direction input `scene_direction`. Workflow Setup and CANVAS target this current schema and must not keep offering Install missing after the node pack loads successfully.
- The final `PreviewAny` text is returned to the CANVAS node and can be connected to Text Viewer or downstream generation nodes.

## Reference-video Cut workspace

- The editor bottom bar includes **Cut** between Timeline and Dope Sheet. It follows the selected timeline video clip and deliberately shows only that source clip.
- The Cut surface follows Clipchamp-style direct manipulation: thumbnails live inside the selected purple clip body, its head/tail handles trim by dragging, and the white playhead supports a **set split marker** action. The filmstrip extracts a reliable set of local JPEG frames through Electron/FFmpeg and uses the regular sprite or playable-frame capture as fallbacks; it does not depend on a local-video Canvas read succeeding. Numeric In/Out fields are not the primary editing control; time values are readouts only.
- Preview playback holds on the selected range's final frame. It rewinds to In only when the user presses Play again; never rewind inside the end-of-range event, because that visibly flashes the first frame and resembles an unintended loop.
- Cut-specific In/Out, cut markers, maximum segment duration, output aspect preset, and fit mode are stored in the clip's `metadata.referenceCut`; the normal timeline remains the editing master and the state participates in timeline undo/history. The transport row keeps a fixed-width trash icon beside the split-marker button so bulk clear remains visible in narrow layouts; that clear is undoable through the same history path.
- Marker boundaries create separate outputs. Each marker-defined span is capped at the selected 5/10/15-second maximum; overflow is excluded instead of creating extra assets, and every excluded range is shown with a strong black filmstrip overlay. The UI warns when an included result is under H3's documented two-second minimum or when the batch exceeds three videos / 15 seconds total.
- Electron renders project-owned H.264 MP4 outputs through `media:renderReferenceCuts`. Presets are 1344x768, 768x1344, 768x768, or source dimensions, with crop-to-fill or fit-with-bars behavior.
- Rendered files are added as normal project video assets beside the project-owned source file and inherit the source asset's Assets-panel `folderId`, preserving both disk and virtual-folder hierarchy. External sources fall back to the portable project `assets/video` directory while retaining their virtual-folder placement. The source timeline clip is not changed unless the user explicitly applies the Cut In/Out back to it. Applying the range updates the selected video and every explicitly linked audio clip in one undoable trim operation, using identical source In/Out and timeline duration; unrelated audio is never matched only by asset ID.

## Short Film Irodori-TTS

- Short Film Creation supports a TTS engine choice between the existing ElevenLabs partner workflow and local Irodori-TTS v3.
- The Irodori path creates one editable audio asset per dialogue line, preserving the same downstream LTX dialogue-shot routing as ElevenLabs.
- The bundled minimal graph uses `jupo.IrodoriTTS.ModelLoader`, `jupo.IrodoriTTS.Sampler`, and the core `SaveAudioMP3` node. It uses v3 automatic duration estimation (`seconds = 0`).
- Workflow Setup has curated installation recipes for `jupo-ai/comfy-Irodori-TTS`, its `requirements.txt`, and `Aratako/Irodori-TTS-500M-v3` as `irodori-tts-500m-v3.safetensors` under `models/checkpoints`.

## Backstage and Irodori Voice Studio

- **Backstage** sits inside Generate, between Director and History, separating preparation work from production work while reusing the same launcher-card presentation and shared generation queue/runtime.
- Backstage initially contains **Irodori Voice Studio**, **ANIMA (SDXL) LoRA Factory**, and **SDXL LoRA Factory**. These cards no longer appear in Director; Director remains focused on ads, short films, and music-video production.
- **Irodori Voice Studio** keeps one guided surface for three mutually exclusive Irodori modes. With no reference, the default standard-TTS mode reads the dialogue directly through the already-supported v3 checkpoint. Selecting VoiceDesign routes to the v2 VoiceDesign checkpoint and caption input; selecting reference audio routes to v3 voice cloning. The VoiceDesign checkpoint does not accept reference audio, so the runtime never sends both conditions together.
- Reference-free mode includes Japanese presets such as calm female and articulate male, plus clickable speaker, pitch, delivery, pace, mood, and sound-quality parts. The selected parts rebuild an editable Japanese VoiceDesign caption that is passed to `VoiceDesignConfig`; dialogue Emoji cues remain separate sampler-text controls.
- The prompt-part interaction was informed by the referenced Irodori v4 script-formatting article, but Lumeweft does not pretend to run the article's LLM-only script transformation modes locally. It applies the interaction to the actual VoiceDesign caption supported by the custom node.
- The guided UI accepts Japanese dialogue, inserts Irodori-supported delivery Emoji at the caret, browses existing project audio and the configured ComfyUI `input` tree, or imports a new reference-audio asset. ComfyUI-input selections are copied into the active project before use so project history remains portable. The UI also exposes reference normalization, maximum reference length, seed, step count, and speaker CFG controls.
- Generated FLAC takes are imported into `Generated/Audio/Irodori Voice Studio`, shown in the same workspace with an audio player and previous-take list, and retained in Generation History. Voice-clone jobs retain the reference audio as an input asset; VoiceDesign jobs retain the final caption in their generation settings.
- The ComfyUI Emoji Picker is a graph-editor helper rather than an execution node. Lumeweft therefore writes the selected Emoji directly into the sampler text while preserving the executable API graph.
- Workflow Setup validates and installs the Irodori custom nodes plus the v3 clone and v2 VoiceDesign checkpoints as required by the selected mode; `SaveAudioAdvanced` is a ComfyUI core node.
- VoiceDesign is registered as its own dependency-only Workflow Setup entry. If a VoiceDesign queue attempt finds the dedicated checkpoint or nodes missing, Lumeweft opens Settings directly to that expanded setup item instead of leaving only a generic queue error.
- Existing copies inside checkpoint subfolders (for example `models/checkpoints/irodori_tts/`) are detected by basename and reused. Missing requirements open Workflow Setup from the Short Film voice queue; after installing custom nodes, ComfyUI must be restarted before re-checking.
- Irodori Voice Studio also exposes **Anime voice** as a peer of Standard voice and VoiceDesign. It uses the full-precision `phasefield-audio/Irodori-TTS-v4.1-Anime` checkpoint saved locally as `irodori-tts-v4.1-anime.safetensors`; the same selection can be combined with reference-audio cloning. Workflow Setup owns the download, size, and SHA-256 metadata. The model keeps the v4.1 inference interface, but its independently annotated fine-tune can respond differently to captions and Emoji controls.

## UGC Creator editable speech production

- UGC Creator includes an **Editable shots** production mode alongside the existing one-shot path.
- The one-shot Generate step includes a persistent **Generated results** panel. Completed UGC one-shot video assets appear there automatically with an audio-enabled player; up to eight completed takes are selectable from video thumbnails. The right-hand social preview mirrors the selected take, and the same files remain available in Project Assets.
- The editable route restores the per-shot stages: script review, voice generation, keyframes, videos, and timeline assembly.
- Dialogue language is selectable between Japanese and English. TTS is independently selectable: Japanese supports local Irodori-TTS v3 or ElevenLabs; English uses ElevenLabs because the bundled Irodori checkpoint is Japanese-focused.
- Japanese dialogue defaults to Irodori-TTS. A normal Irodori batch reuses one seed across all lines so the creator voice stays consistent; an explicit per-line retake may vary the seed. UGC voice jobs retain the same per-variant asset metadata and now record their language.
- Changing the dialogue language after a plan exists returns the user to script review so stale-language voice clips are not queued accidentally.
- The UGC setup hook suggestions, random hook, placeholder, preview fallback, and prompt fallback follow the selected dialogue language. Switching Japanese/English translates only the built-in hook presets by their matching index; a custom user-written hook is preserved verbatim. The selected hook continues into the director script and external-LLM prompt.
- UGC Creator now defaults to `ltx23-latentsync` (shown as **Exact Audio**). LTX 2.3 generates the shot frames, then the runtime inserts `LatentSyncNode` before the final `CreateVideo`; the completed Irodori/ElevenLabs clip is passed through as the output audio and drives mouth correction. Silent shots fall back to plain `ltx23-i2v`.
- The lighter **LTX TalkVid** option remains available. When a completed voice clip exists, `ltx23-i2v` resolves to `ltx23-id-lora`: the clip conditions voice identity/performance while `[SPEECH]` supplies the line, so TalkVid regenerates rather than preserves the original waveform.
- Exact Audio dependency preflight includes `LatentSyncNode`. Workflow Setup can clone `ComfyUI-LatentSyncWrapper` and install its requirements; restart ComfyUI afterward. Its LatentSync 1.6 and Whisper checkpoints are downloaded by the node on first use.
- Editable-shots mode defaults keyframes to the local Qwen Image Edit model/product workflow rather than Nano Banana 2.
- The local MiniMax H3 GGUF image-to-video workflow generates native audio jointly and does not currently accept Irodori audio as an external performance guide. Keep H3 separate from the Irodori lip-sync route. Its existing local character-sheet workflow is the preferred basis for a later UGC preproduction stage that prepares creator sheets/storyboard references.

## MiniMax H3 GGUF reference video (2026-09-03)

- CANVAS includes **Reference Video -> Video (H3 GGUF)** (`reference-video-to-video`, workflow `minimax-h3-gguf-r2v`), adapted from TheAiBlueprint's Civitai model 2838553. Its information card retains the source attribution and separate model license notice.
- The input accepts an existing project video or imports a local video into the project. The complete video file is uploaded; VHS_LoadVideo samples the chosen 2-15 second segment at 24 fps, preserving aspect ratio. The default segment is the first five seconds. Output defaults to 608x352, approximately five seconds, with H3's 17n+5 frame grid and native audio.
- Optional Style Reference inputs support up to eight images in connection order, using `<Picture 1>` through `<Picture 8>`; the motion reference uses `<Video 1>`. Reference soundtrack conditioning is an explicit opt-in for videos containing audio. Generated asset metadata retains the reference asset IDs and segment/audio settings.
- The graph reuses the installed Ref2VA Q4 model, H3 GGUF encoder/mmproj, and video/audio VAEs. Workflow Setup also includes VideoHelperSuite, KJNodes, and the H3 GGUF loader dependencies.
- **Speed Boost (SageAttention)** is enabled by default, including saved documents that lack the new `useSageAttention` field. The GGUF model goes through `PathchSageAttentionKJ` (`sage_attention: auto`, `allow_compile: false`) before both BasicGuider and BasicScheduler. Turning the switch off removes the patch and restores the base model links without reducing steps, duration, or resolution. Generated asset metadata retains the setting.
- This matches the active acceleration in TheAiBlueprint's downloaded v1.0 workflow: SageAttention is active; SolAttn is bypassed and EasyCache and the separate memory-efficient patch are disconnected/bypassed. Do not blindly enable every optimization node present in the source file. The ComfyUI environment must have a compatible SageAttention Python package in addition to KJNodes; KJNodes requirements alone do not install it.
- The user's existing SageAttention 2.2.0 CUDA 13 wheel was verified on RTX 5070 Ti with the installed KJ patch and ComfyUI H3's AttentionTensorContainer dispatch (56 heads, head dimension 128, BF16). Attention-only tests at 4096 and 8192 tokens measured about 2.09x and 2.49x versus the running server's PyTorch attention, with finite outputs and cosine similarity above 0.999. These are kernel-level measurements, not an end-to-end video generation speed guarantee.

## Default MiniMax H3 Fused Turbo + SLA I2V (2026-09-05)

- The ordinary CANVAS **Image -> Video** template now defaults to MATLOWAI's published low-VRAM I2V recipe rather than the former GGUF + standalone Turbo graph. It uses `minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors`, which already contains the RefDelta, LightX2V Turbo and Mystic blend; do not add those LoRAs again.
- The graph follows the upstream API workflow: `UNETLoader` -> KJNodes `MiniMaxChunkFeedForward` (chunks 4, threshold 4096) -> `H3SLAAttention` (0.90, block 64, minimum sequence 8192, audio protected) -> Sigma Shift 12/3 -> `res_multistep` / `simple` / 4 steps. It uses the NVFP4 AWQ Qwen3-VL encoder and INT8 ConvRot video VAE with the FP32 audio VAE.
- Workflow Setup installs the CUDA/Triton SLA node from `ethanfel/ComfyUI-PlagueKind-Nodes-only-sparse` and KJNodes, and owns the existing curated model recipes. The original API graph and model card are authoritative if upstream changes its contract.
- The model file is about 21 GB. Its low-VRAM graph reduces peak VRAM through exact FFN chunking and normal ComfyUI offload, but host RAM usage remains substantial. The separate Q4 GGUF NSFW presets remain the smaller-memory option.
- Reference memo retained for future H3 integrations and comparisons: https://note.com/mayu_hiraizumi/n/nd6568825d69a . Treat it as an evolving personal memo containing some unverified information, as the author states.
- Verification: the dedicated regression suite covers full-video uploads, eight-image routing, optional audio, duration/segment normalization, dependency coverage, and preserving the existing I2V preset. Live ComfyUI node/model lists were checked; video generation itself was not run without a user-selected reference clip.

## Fast MiniMax H3 T2VA for CANVAS (2026-09-03)

- CANVAS has a separate **Fast MiniMax H3 T2VA (Anime)** flow, ID `fast-minimax-h3-t2va`. It starts from an anime-oriented text prompt with native audio; two image references and two standalone audio references are optional. The shared Generate form does not expose this CANVAS-specific flow.
- Source: aziib's Civitai model 2906467, version 3291309, and the supplied `fastMinimaxH3_referenceToVideo.json` (SHA-256 `72f684048f5b8105e6eca2788ac5b67b55fa8eaa214bd49b8a61208f8a280e19`). Uses MATLOWAI's `minimax_h3_fused_refdelta_r1024_turbo8_mystic07_int8_convrot.safetensors`, the INT8 ConvRot video VAE, NVFP4 AWQ Qwen3-VL encoder and FP32 audio VAE. It is an anime-oriented preset, not a claim that these weights are exclusively anime-trained.
- Keep the source's Euler sampler, ManualSigmas schedules (4 default, 6 or 8 selectable), and MiniMaxH3SigmaShift (12 video / 3 audio). The Reddit example uses different Kijai experimental weights with er_sde/beta; its recipe must not be mixed with this model.
- Defaults: 864x480, 24 fps, approximately 5 seconds (124 frames). Duration supports 5–15 seconds on H3's 17n+5 frame grid. Prompt references use `<Picture 1>`, `<Picture 2>`, `<Audio 1>`, `<Audio 2>`; only populated inputs count, in connection order.
- DiffusionModelLoaderKJ uses `sage_attention: auto` and FP16 accumulation. SageAttention and Triton are mandatory; this machine already has SageAttention 2.2.0 and triton-windows 3.7.0. The linked DazzleML installer is a setup helper, not an extra runtime node; it was not rerun over the working environment.
- Workflow Setup has checksum/size-verified download recipes for all four model dependencies. At implementation time, the fused model and INT8 video VAE were missing (24,151,849,888 bytes total); the encoder and audio VAE were already installed in MiniMaxH3 subfolders and are reused by basename resolution. No multi-GB download or generation was performed for the preset addition.
- Reference audio imports to the project's assets/audio directory and uploads the complete file with its original extension. CANVAS shows audio previews and supports two connections to its dedicated audio-reference port. Generation metadata retains reference asset IDs, steps and SageAttention.
- Verification: 15 related tests passed, including actual CANVAS context/modifier execution with mocked uploads for text-only and 2-image/2-audio cases, published sigma schedules, stale-reference cleanup and curated dependency coverage. Renderer production build passed. End-to-end rendering and total speed remain unmeasured until the missing weights are installed.

## VDN-H3 CANVAS preset (2026-09-03)

- CANVAS includes a separate **VDN-H3 8step** template/workflow (`vdn-h3-t2va`). It contains a prompt, video generator and output; the shared Generate form does not expose it. Text-to-video with native audio is the initial supported path. Defaults are 608x352, 24 fps, about five seconds (124 frames), with 5–15 second duration controls on H3's 17n+5 grid.
- Source: `Saganaki22/ComfyUI-VDN-H3`, inspected at commit `9d037fab19bcf398937743fc4371c98229b283ad`. The supplied example graph contains comparison branches; only the VDN route is adapted. Preserve its plain `minimax_h3_fl2va_int8_convrot.safetensors` base, dedicated `stage-dmd-step-250` checkpoint, er_sde / beta sampler at eight steps, shared NVFP4 AWQ encoder, INT8 video VAE and FP32 audio VAE.
- `ApplyVDNH3` is configured with its own Turbo adapter enabled, strength 1, `lora_mode: merge`, `branch_weights: stream` and `attention_backend: grouped`. Merge/stream reduce VRAM usage for the user's 16GB GPU; quantized adapter merging can soften results. This configuration has not yet been rendered on this PC. Do not replace the plain base with the Fast H3 Turbo/Mystic fused checkpoint or stack community Turbo, Scheduled SOL attention, or the separate GGUF acceleration graph.
- Workflow Setup registers the VDN custom-node repository with no new Python requirements for the standard grouped path. Installing the custom node requires a ComfyUI restart. The eight VDN stage files (including both adapters and their JSON configs) retain the original directory tree below `models/vdn/stage-dmd-step-250`. All new download recipes have verified file sizes and SHA-256 hashes.
- VDN's checkpoint selector lists a stage as soon as its branch weights exist, even if adapters are absent. The dependency manifest therefore marks every stage member `exactPath`. The Electron file checker checks those specific paths, including external VDN/LoRA-derived model roots; a sibling adapter with the same basename does not satisfy a missing member. An unverified bundle blocks CANVAS execution and gives a Workflow Setup message. Ordinary single-file models keep their existing basename discovery behavior.
- At implementation time, the plain base (34,038,892,334 bytes), VDN stage (5,464,957,032 bytes), and INT8 video VAE (3,171,670,912 bytes) were missing: 42,675,520,278 bytes total. The encoder and audio VAE are already installed and reused. No large model download, node installation, server restart or generation was performed merely to add the preset; Workflow Setup performs first-use installation.
- Verification: 18 related tests passed, covering the actual CANVAS context/modifier route, native audio, bounded duration, absence of conflicting patches, model recipes, partially installed VDN bundles, same-named adapter isolation, external bundle roots and unavailable filesystem checks. Renderer build and Electron main/preload/helper syntax checks passed. Rendering speed, quality and VRAM use remain unmeasured on the user's GPU.

## MiniMax H3 character sheet

- CANVAS includes an **H3 Character Sheet** template adapted from `PoopMan333/H3_Character_Sheet_Generator`'s four-panel workflow.
- The local graph uses the Ref2VA Q4 GGUF denoiser (`minimax-h3-ref2va-Q4_0.gguf`) and reuses the encoder, mmproj, video VAE, and audio VAE already required by the MiniMax H3 GGUF image-to-video flow.
- The template accepts one primary image plus up to two optional references. References are described with H3's required `<Picture 1>`, `<Picture 2>`, and `<Picture 3>` prompt tags.
- It runs H3's supported 124-frame duration at a lower 480×864 default, extracts four representative frames, stitches a 2×2 sheet, and saves only the final sheet rather than an intermediate video.
- The Ref2VA GGUF model and underlying H3 weights use the MiniMax H3 Community License. The extra Ref2VA Q4 download is about 11.4 GB.

## CANVAS LoRA training-set preparation

### Qwen Image Edit 2511 multiple-angle runtime

- The bundled `multi-angles` and `multi-angles-scene` workflows use Qwen Image Edit 2511 instead of the former 2509 stack.
- The diffusion model is Unsloth's `qwen-image-edit-2511-Q5_K_M.gguf`, loaded through `ComfyUI-GGUF`'s `UnetLoaderGGUF` node.
- Camera control uses fal's `qwen-image-edit-2511-multiple-angles-lora.safetensors`; 4-step inference uses the matching `Qwen-Image-Edit-2511-Lightning-4steps-V1.0-bf16.safetensors` LoRA.
- The eight guided prompts use the LoRA's required `<sks> [azimuth] [elevation] [distance]` syntax. Do not restore the older natural-language 2509 camera prompts.
- Before either multiple-angle workflow uploads its character source, CANVAS fits the complete image onto a white 1024×1024 canvas without cropping or changing the subject's aspect ratio. The workflow's one-megapixel preprocessing therefore remains square and all eight generated training views are 1024×1024.
- Workflow Setup owns curated automatic installation entries for the GGUF model, both 2511 LoRAs, and `ComfyUI-GGUF`. The existing Qwen 2.5 VL text encoder and Qwen image VAE remain shared.

### Qwen Image Edit 2509 GGUF runtime

- The bundled `image-edit` and `image-edit-model-product` workflows use `Qwen-Image-Edit-2509-Q4_K_M.gguf` through `ComfyUI-GGUF` instead of the former FP8 diffusion model.
- Their text encoder is `Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf`. `Qwen2.5-VL-7B-Instruct-mmproj-BF16.gguf` must be installed beside it under `models/text_encoders`; ComfyUI-GGUF discovers the mmproj automatically by filename.
- Both workflows retain `Qwen-Image-Edit-2509-Lightning-4steps-V1.0-bf16.safetensors`, four sampling steps, and CFG 1. Workflow Setup owns curated downloads for all three GGUF files, the Lightning LoRA, and the ComfyUI-GGUF custom node.

- New projects open CANVAS with a zero-node **Blank Canvas** document. The former automatic text-to-image-to-video starter remains available from the document template dropdown as **Story Flow**; existing saved CANVAS documents are preserved.
- CANVAS includes **Anima LoRA Factory** and **SDXL LoRA Factory** document templates. Each takes one project character image, runs the existing Qwen `Multiple Angles (Characters)` workflow, and returns eight 45-degree character views to an Assets folder dedicated to that factory.
- Both LoRA templates include an optional **Masked Inpaint Edit** immediately before multiple-angle generation. It accepts the character source, a black-and-white mask (white = replace), an edit prompt, and an optional logo/prop/clothing reference. The Qwen image-edit result is composited over the original with core `ImageToMask` and `ImageCompositeMasked` nodes so unmasked pixels remain unchanged. The stage defaults off; while off it does not check or run the image-edit workflow and passes the original asset ID directly to the multiple-angle node. Legacy untouched LoRA template documents are upgraded with the optional stage during normalization.
- LoRA results automatically create `Assets / CANVAS / LoRA Training Sets - Anima / 001` or the SDXL equivalent. Every run scans the direct numeric children, adds one to the highest number, zero-pads it to three digits (`001`, `002`, ...), and assigns all images generated in that run—including an enabled Inpaint correction and its following angle views—to the same lazily created folder. The runtime must call `assetsStore.addFolder` with its current object argument (`{ name, parentId }`) so nested folders receive valid names.
- Image Input and Style Reference nodes include an inline **Choose image file…** loader as well as the Inspector's project-asset selector. A picked local image is copied into the active project's `assets/images` directory, registered in the Assets store, previewed, and connected to the node automatically.
- Assigned media can be cleared without deleting the underlying project asset. Both the CANVAS node card and Inspector expose **Clear assigned image** for Character Source Image, Inpaint Mask, Inpaint Reference, and other Image Input/Style Reference nodes; clearing restores the node's empty state and closes the matching Assets preview.
- Clicking an Image Input or Style Reference node's preview/empty-placeholder opens an inline existing-asset picker. Image Input accepts project images and videos; Style Reference accepts images. Selecting one updates the node and Assets preview without re-importing the file.
- The CANVAS Inspector contains a collapsible compact **Asset Browser** backed by the shared Assets store. It supports folder navigation with breadcrumbs, project-wide name search, image/video/audio thumbnails, and preview selection. Clicking a compatible asset automatically assigns it to the selected Image Input or Style Reference node (including the LoRA templates' **Character Source Image**); incompatible media remains preview-only. A **Use in selected node** status/action remains visible on compatible cards.
- The CANVAS Asset Browser header has a manual refresh button for media deleted outside Lumeweft. In the desktop build it checks both recorded absolute paths and project-relative paths, removes only records whose local files are all missing, clears matching CANVAS input/output references, and leaves URL-only assets or records affected by a transient filesystem-probe failure untouched.
- Template document cards with third-party provenance show an `i` button at the lower-right. Its click-open modal identifies the author, original source, software license, and separate model/data license caveat; clicking the backdrop or close button dismisses it.
- The LoRA information modal exports the original input plus generated image assets to a user-selected local dataset folder with stable numeric prefixes. The official Factory GUI can then use that folder for tagging and training.
- The modal can launch an already downloaded/extracted official Factory package by selecting the folder that contains `start.bat`. This launcher is Windows-only, matching the referenced Factory packages, and does not silently download or redistribute them.
- LoRA documents expose a visible **Create LoRA…** button in the CANVAS toolbar, and successful multi-angle generation opens the same guided follow-up automatically. The guide presents the external Factory workflow in order: review views, export the numbered dataset, then download/launch the official Factory and select that dataset before caption/tag review, model-path setup, and training. A successful export keeps the guide open and shows the chosen dataset path so the user can continue directly to Factory launch.
- Launching an installed Anima or SDXL Factory after dataset export now hands the selected absolute dataset path to its browser GUI automatically. Since the official v4.7 packages expose no launch argument for this field and persist it in different browser `localStorage` keys, Lumeweft installs an idempotent small frontend handoff script plus JSON in the selected Factory's `frontend` folder, backs up the original `index.html` once as `index.html.lumeweft-backup`, and fills the correct Anima/SDXL key on page load. If the dataset or frontend is unavailable, Factory launch still proceeds with an explicit manual-selection fallback message.
- The same Factory handoff fills `output-dir` with ComfyUI's LoRA model directory. A writable `loras` path from `extra_model_paths.yaml` is preferred (for example a Stability Matrix shared-model directory); otherwise Lumeweft creates/reuses `<ComfyUI>/models/loras`. Trained LoRAs therefore appear directly in ComfyUI's model search path.
- The extracted Anima and SDXL Factory roots are configured separately under **Settings → File Paths** and validated by the presence of `start.bat`. CANVAS launches the saved root without showing a directory picker every time; a missing or stale setting closes the guide and opens File Paths for repair.
- Both Factory repositories identify their software as Apache-2.0 and the displayed author as `UNfukashigi`. Do not imply that this software license also covers Anima/SDXL model weights, checkpoints, training images, generated images, or bundled third-party dependencies.

## Dependencies and assets

- The built-in Z Image Turbo workflow is local-first GGUF: `z_image_turbo-Q4_K_M.gguf` plus `Qwen3-4B-Q4_K_M.gguf`, loaded through ComfyUI-GGUF. The VAE and the existing fast generation graph remain unchanged.
- The built-in WAN 2.2 I2V and T2V workflows use separate Q4_K_M GGUF High/Low Noise experts plus the shared `umt5-xxl-encoder-Q4_K_M.gguf`. Their existing four-step LightX2V/Lightning LoRAs, VAE, resolution, frame-count inputs, and sampling logic remain authoritative. Workflow Setup installs ComfyUI-GGUF and these exact model files; do not silently regress these presets to the larger FP8/BF16 stack.
- WAN GGUF is classified as an 8GB-minimum/16GB-recommended local workflow because GGUF can offload model layers. This describes supported memory-aware execution, not guaranteed full-GPU residency; the planned 8/12/16GB hardware profiles and green/blue/red compatibility UI remain future work.
- Director queue errors caused by missing workflow dependencies retain the exact blocked workflow IDs and show an **Open missing dependencies in Workflow Setup** action in the visible error report. The action opens Settings and focuses the corresponding workflow cards and missing dependency sections.
- When CANVAS or Generate opens Workflow Setup because a workflow is blocked by missing dependencies, it passes the relevant workflow ID. Workflow Setup clears gallery filters, expands and scrolls to that workflow, and marks both its card and missing dependency sections with a red border.
- Missing workflow dependencies should be detected and automatically downloaded when a curated safe recipe is available; automatic installs do not require a redundant confirmation dialog.
- Workflow Setup model downloads can be cancelled from the progress overlay. Cancellation aborts the active transfer, closes the Windows file handle, removes the unfinished `.download` file, keeps already completed model files, and stops before later tasks. A retry therefore skips completed files and downloads only the remaining dependencies.
- Missing/manual/core-update cases should remain explicit.
- Generated virtual asset folders must be deletable through project-only deletion even when disk deletion is inappropriate or the folder was created automatically.
- Assets grid folder tiles expose rename and trash actions in their top-right hover controls, matching asset tiles. The trash action reuses the existing confirmed recursive folder deletion path; list rows expose the same action with an accessible label and tooltip.

## Product direction

- Preserve Velorn/Lumeweft's differentiator: a commercial-grade multi-track timeline plus GLSL effects combined with guided AI generation.
- Treat the timeline as master and link generation records, assets, and ComfyUI provenance back to it.
- A generation/history record should retain enough information to reconstruct or reopen the workflow and parameters.
- Keep common generation paths guided. Do not force ordinary users to edit node graphs, while still allowing advanced ComfyUI access and custom workflows.

## CANVAS NSFW flows

- **H3プロンプト最適化** (`h3-prompt-optimizer`) is a general CANVAS helper, not an NSFW-only preset. It accepts connected or inline text, uses a local OpenAI-compatible LLM, and emits editable H3 text for video nodes or Text Export. The user selects T2VA/I2VA/FL2VA/L2VA/Ref2VA and duration to match the downstream graph; it does not change media wiring or inspect references. Ref2VA requires reference-role notes. Base modes use three fields plus application-generated frame alignment; Ref2VA uses six fields. English descriptive prose retains original dialogue/visible text. Validation rejects invalid shot/cut timing, malformed dialogue tags, changed spoken text, undeclared media references and truncated responses. Sources: MiniMaxAI/MiniMax-H3 official base/ref prompt guides, with user-supplied note.com/sepiablue/n/nda9ad75b17e7, pixo.video/ja/blog/minimax-h3-prompts and domoai.app/ja/blog/minimax-h3-prompt-guide as context. No LLM weights or custom nodes are installed by this feature.

- CANVAS has **テキスト書き出し** (`text-output`) and **テキスト読み込み** (`text-input`) nodes. Export writes UTF-8 `.txt` files through the normal collision-safe project import path under `assets/text`, registers `type: text` assets in `CANVAS / Texts` by default, and persists `textContent` with the asset for synchronous cross-flow reuse after reopening. Input selects an existing text asset from the inspector or Asset Browser; its text output connects to normal prompt/TTS inputs. The Asset Browser shows text excerpts, full read-only text and Copy. These nodes require neither ComfyUI nor an LLM. Export through a Text Viewer observes upstream executable dependencies even if node insertion order differs.

- **NSFW Scenario → Prompt Drafts** uses Ortenzya Wordsmith 31B through a local OpenAI-compatible LM Studio / llama.cpp server. It contains brief → editable scenario → editable per-shot prompt drafts → Text Viewer. Running only the draft node reuses edited scenario output; Run All regenerates both stages. The inspector exposes the server endpoint, optional exact model ID, output limit, system instructions and editable output. No ComfyUI node or model dependency is introduced. Load the GGUF in the local server first; model discovery does not fall back to an unrelated model. A custom server alias must be entered explicitly. Model weights and end-to-end inference were not installed/tested during the feature addition.

- **MiniMax H3 NaughtyTimes v3** uses `SexGod_NaughtyTimes_v3_rank64_pruned_NOADALN.safetensors` from `SexGod1979/NaughtyTimes-MiniMax-H3`, published at revision `393b40ffc452c6a6f48a45f03defc04d05b5f0c6`. The dedicated I2V graph uses the existing pruned Q4 GGUF FL2VA base, native audio and a local 20-step starting point. Workflow Setup owns the LoRA download. The upstream README still describes unpruned training despite publishing a pruned variant; local quality remains unverified. The unpruned file and Turbo adapter are not used in this preset.

- CANVAS's new-document menu has a separate **NSFW** section. Keep this user-facing section name concise: use the abbreviation `NSFW` without expanding it or adding risk wording. The first preset, **Anime Image -> Talking Video**, accepts an ANIMA or other anime-style character image and Japanese dialogue, generates the finished voice with local Irodori-TTS v4.1-Anime, then runs the established LTX 2.3 native Exact Audio route so the supplied waveform is retained in the talking-video output. Existing saved CANVAS documents keep their recorded v3 workflow choice; newly created documents use the anime checkpoint.
- MiniMax H3 Ref2VA remains available as a separate motion-reference flow. It generates native audio and is not silently presented as accepting Irodori audio directly; a future R2V-to-standalone-lip-sync stage should use a verified video-input LatentSync graph.
- The NSFW section also contains two distinct MiniMax H3 GGUF image-to-video presets. **PinkFluffyBunny (Quality)** uses the existing local rank-128 v2 LoRA, disables the stock Turbo LoRA, and runs 20 steps. **Motion Enhancer (8-step)** replaces the stock LightX2V adapter with rzgar's dedicated eight-step motion LoRA. Do not stack either preset with the stock Turbo adapter.
- Both presets keep the smaller `minimax_h3_fl2va_pruned_fp8_Q4_0.gguf` runtime and the shared Q4 encoder. PinkFluffyBunny v2 was trained against unpruned FL2VA, so the preset's information card explicitly marks the pruned Q4 base as a low-memory compatibility tradeoff rather than claiming exact base-model fidelity.
- **PinkFluffyBunny Reference Video** is a third, independent CANVAS preset. It uses the Ref2VA Q4 base, the local v2 rank-128 Pink LoRA, optional SageAttention, Sigma Shift 12/3, and 20-step `res_multistep` / `simple` sampling without Turbo. One reference video is required; its audio is optional, and up to eight identity or style images can be connected. Connected images use `ref_image_size: max` and explicit `<Picture i>` labels. This is a compatibility adaptation because the LoRA was trained on FL2VA while the simultaneous image/video conditioning requires Ref2VA.
- **AfterMidnightR2V** is a separate NSFW Ref2VA preset using `AfterMidnight_ref2va_h3_sexytime_rank64-v1.2.safetensors` at strength 1.0. Preserve the author's required Euler sampler and beta scheduler; other scheduler combinations are documented upstream as causing audio problems. It shares the Ref2VA Q4 base, native audio, optional SageAttention, one required reference video, optional soundtrack, and up to eight high-resolution `<Picture i>` references. Do not stack the softer AfterMidnight flavor or Turbo.
- **MiniMax H3 NSFW — Scene + Character + Props** is the image-only AfterMidnight Ref2VA preset. It fixes `<Picture 1>` as the required scene/composition reference, `<Picture 2>` as the required character-sheet/identity reference, and `<Picture 3>` as an optional prop or additional-stage reference. Those role instructions stay inside the node's hidden base prompt; the visible prompt is reserved for content, action, camera, and sound direction. The graph has no reference-video input and preserves the AfterMidnight Euler/beta/20-step recipe.
- CANVAS also includes two endpoint-animation recipes. **Reference Video -> Anime First/Last -> Video** extracts the source video's first and last frames in the renderer, anime-stylizes both through two single-result image-edit stages, and sends them to the real `first_frame` / `last_frame` inputs of the PinkFluffyBunny FL2VA-compatible graph. **Reference Video -> Anime Endpoints + Motion -> Video** sends the same stylized endpoints as `<Picture 1>` / `<Picture 2>` to AfterMidnight Ref2VA while retaining the original clip as `<Video 1>` for motion, timing and camera guidance. Ref2VA pictures are appearance references rather than strict temporal endpoint slots; the first recipe is the endpoint-accuracy path. The default endpoint renderer is Qwen Image Edit because ANIMA's existing CANVAS graph is text-to-image rather than structure-preserving image edit; users can select another installed image-edit workflow on those nodes.
- The referenced Ai-Hakase best-practices article's Fused Turbo + SLA core is now implemented from MATLOWAI's published API workflow and model card. Optional AudioRefine and latent upscale remain separate future stages rather than being silently added to the base generation graph.

## CANVAS ANIMA Multi-LoRA + Upscale

- CANVAS includes **ANIMA Multi-LoRA + Upscale**, adapted from Yunmiyun_UwU's Civitai workflow `2637356` / version `3306253`.
- Apart from the approved RES4LYF sampler exception, the executable graph installs no workflow-specific convenience nodes. Lumeweft replaces Power Lora Loader with up to five CANVAS-managed slots that expand into a chain of core `LoraLoader` nodes; image sizing and upscale bypass are owned by CANVAS.
- RES4LYF is an approved, near-unavoidable custom-node exception for advanced sampling. This flow preserves the source `ClownsharKSampler_Beta` with `exponential/res_2s`, while `Flux2Scheduler` remains core. Workflow Setup owns the RES4LYF installation and its Python requirements.
- The CANVAS presentation follows the source workflow's visible-versus-collapsed intent without exposing its technical plumbing. It shows separate Checkpoint, Positive Prompt, Negative Prompt, five-slot Multi-LoRA, Image Size, RES4LYF Sampler, Upscale, and Output nodes. The sampler card exposes only Steps, CFG, Seed, Denoise, and sampler choice; scheduler, ETA, sampler mode, bongmath, Empty Latent, VAE Decode, Save Image, and routing remain internal defaults. Connected control nodes are merged into the executable image node at run time, and older three-node ANIMA documents migrate to this layout while preserving their saved values.
- The optional upscale branch uses core `UpscaleModelLoader` and `ImageUpscaleWithModel`. Checkpoint, LoRA, and upscaler names are explicit user-editable ComfyUI-relative choices; third-party model licenses remain separate.

## CANVAS custom-node policy

- For future CANVAS development, avoid installing third-party ComfyUI custom nodes whenever practical. Treat every custom-node dependency in a referenced workflow as something to inspect and replace, not something to install automatically.
- Prefer implementing equivalent behavior inside Lumeweft/CANVAS and emitting workflows composed from ComfyUI core nodes. Examples include expanding convenience loaders into standard node chains, owning bypass and routing logic in CANVAS, normalizing sizes and parameters before queueing, and replacing presentation-only graph helpers with CANVAS controls.
- Install a custom node only when the required model operation cannot reasonably be reproduced with ComfyUI core nodes or Lumeweft-owned workflow composition. Keep such exceptions narrow, documented, visible in Workflow Setup, and separated from optional conveniences.
- Treat RES4LYF as an explicitly approved exception when a source workflow depends materially on its samplers or numerical behavior. Do not replace it merely to achieve a core-only graph; continue replacing unrelated convenience nodes around it.
- Do not claim exact equivalence when a core-node replacement changes sampling or numerical behavior. Record the source behavior, the chosen substitute, and the expected compatibility tradeoff in the template information and tests.

## Generation surface product direction

- The three generation surfaces serve different levels of experience and must remain clearly separated:
  - **CANVAS** is for beginners who find ComfyUI difficult but can understand a small visual flow. It should make the overall generation path visible without exposing ComfyUI's implementation detail or requiring frequent rewiring.
  - **Director** is for people who find node-based interfaces themselves difficult. It should provide a guided, task-oriented production experience without asking the user to understand or manipulate a graph.
  - **Backstage** is dedicated to preparing reusable source material and production assets, such as voices, LoRAs, datasets, characters, and other ingredients consumed by CANVAS or Director. It is not another general generation workspace.
- Keep visible CANVAS graphs as small and readable as possible. Expose only nodes that represent a meaningful creative choice, user-supplied material, a major generation stage, or an explicit destination/result.
- Do not expose ComfyUI-style technical plumbing as intermediate CANVAS nodes. Format conversion, image resizing, dimension normalization, latent preparation, encode/decode steps, routing, compatibility adapters, and other operations required only by the next node belong inside the owning visible node or the runtime-generated workflow.
- A hidden internal operation must inherit sensible defaults from its visible parent and the downstream model's requirements. Add a user-facing control only when changing it is a meaningful creative or quality decision; do not surface it merely because ComfyUI exposes the parameter.
- Prefer extending an existing visible node with a small, plain-language option over adding another technical node. Preserve advanced/internal graph data for execution and compatibility, but do not make beginners manage it.

## CANVAS recipe presentation

- Product taxonomy is now two-layered: a **Skill** is the reusable capability package, while `recipe`, `director`, and `form` describe its presentation. Recipe and Director are not separate execution engines. CANVAS remains the visual authoring/editing environment, and Generation History remains the shared run ledger.
- The provisional **Skills** shortcut/catalog tab was removed. Skills are intended to become self-contained capabilities, not a table of contents pointing at unrelated tabs; defer a dedicated Skills surface until that model is implemented.
- Backstage's thumbnail launcher includes the Anima and SDXL LoRA factories. Selecting either card opens its dedicated Recipe screen and returns to Backstage, while reusing the established Recipe runtime so dataset selection, Asset Browser, refresh, export, Factory handoff, and process output stay intact.

- CANVAS preset recipes are beginner-facing macro surfaces, not ComfyUI-style node editors. A recipe exposes its required and optional inputs, friendly execution phases, destination, and results while retaining the internal graph for persistence and execution.
- Director remains a separate step-by-step production guide. Recipe Canvas is a persistent, directly editable and rerunnable preset workspace; it does not use Next/Back wizard navigation.
- Free node authoring belongs to advanced flow documents. CANVAS's new-document menu lists only advanced flows; LoRA Factory recipes are launched from Generate → Skills. Existing recipe documents remain compatible and continue to hide ports, edges, Node Palette, graph keyboard editing, Run Selection, and node-setting Inspector controls.
- Keep the project Asset Browser visible beside Recipe Canvas. It remains the shared surface for folder navigation, search, previews, original-size inspection, stale local-file refresh, and assigning assets to exposed recipe inputs. Recipe mode replaces node selection with an explicit input target such as Character Source, Mask, or Reference.
- Anima LoRA Factory and SDXL LoRA Factory are the first `presentation: 'recipe'` templates. Their source image, optional masked edit fields, automatic eight-angle stage, Assets destination, result thumbnails, and Create LoRA follow-up appear in one macro card. Their existing internal nodes and runtime remain authoritative for compatibility.
- LoRA recipe cards must also preserve the pre-recipe existing-dataset path: the user can select an already prepared training-image folder without running angle generation, see the selected absolute path, and launch the matching installed Anima or SDXL Factory with that dataset handed to its GUI.
- Normal LoRA recipe generation requires choosing an **Export Design Set folder** in Step 1. After the angle flow completes, CANVAS automatically copies the source image (or enabled Inpaint correction) plus the generated views into that folder with stable numbered filenames, marks the dataset ready, and reuses the same path for Factory handoff. Merely selecting an empty output folder must not enable Factory launch; the separate existing-dataset action explicitly marks a populated folder ready.
- After a normal Design Set export succeeds, CANVAS hands the Step 1 folder to the matching installed LoRA Factory and launches it automatically. Choosing an existing dataset remains available and also launches the Factory with that selected folder. A missing or invalid Factory root remains visible as an inline error with a button that opens File Paths and scrolls to the highlighted LoRA Factory settings card; manual launch/retry remains available.
- Multiple-angle result collection must use the per-run filename prefix assigned to the eight `SaveImage` nodes. Before queueing, the runtime removes the workflow's eight terminal `PreviewImage` nodes because they contain the same pixels; this prevents both temporary preview creation and accidental duplication of the training set from eight views to sixteen files.
- After an Anima or SDXL LoRA recipe produces its angle set, CANVAS also composes the eight generated views into a clean 4×2 PNG character reference sheet. The sheet is registered as a normal project image asset, linked back to the recipe, previewable and rebuildable from the Results section, and intentionally kept out of the Factory Design Set folder so it is not mistaken for an additional training image.
- Every CANVAS node has a persistent mute toggle. Muted source and output nodes disable their branch. Muted executable intermediate nodes are not submitted and pass through a compatible input of the same media kind (`image -> image`, `video -> video`, `audio -> audio`, or `text -> text`) while preserving all graph connections. When no compatible input exists, the branch intentionally produces no output. Saved documents without the field remain unmuted. An outgoing connection from a muted node animates only while that node actually holds passthrough media or text; disabled source nodes and incompatible muted branches remain visually idle.
- Stopping a CANVAS flow aborts the renderer-side result poll and sequential execution immediately, then sends ComfyUI's `/interrupt` request for the active server-side sampler. Do not wait for ComfyUI history to produce an error before releasing the CANVAS running state, and do not queue later nodes or bundled variants after cancellation.
- The CANVAS inspector includes a collapsible **Process Console** below the Asset Browser. It combines CANVAS node/status progress, model-setup progress, and stdout/stderr/exit events from LoRA Factory processes launched by Lumeweft. Factory child processes must keep piped stdio and publish through the narrow `loraFactory:processEvent` preload bridge; do not return to detached `stdio: 'ignore'` launches because long training would become opaque again.

## TK Toolkit optional integration

- Generate -> Backstage includes **TK Toolkit** as an optional ComfyUI toolbox. If its stable `TK Batch LoRA Loader` class is missing, selecting the card opens Workflow Setup focused on `tk-toolkit`; once installed, the card opens the toolkit's ComfyUI-hosted panel inside Lumeweft.
- Workflow Setup installs or updates the official `Ararararararaki/comfyui-anima-toolkit` repository into `custom_nodes/ComfyUI-Anima-Batch-LoRA` and runs its `requirements.txt`. ComfyUI must restart after installation.
- The upstream software is MIT-licensed and remains external, so its own `LICENSE` stays with the clone. Models, LoRAs, preview media, Danbooru content, generated outputs, and remote services retain separate terms.
- Lumeweft-facing Backstage and setup copy is Japanese/English. Do not claim that the upstream toolkit panel itself is fully localized: its TypeScript panel, widget JavaScript, and Python display metadata still contain substantial Chinese UI text. A full edition should add maintainable locale catalogs upstream or in an identified fork, not use DOM text replacement.
- The review basis and localization boundary are recorded in `docs/TK_TOOLKIT_INTEGRATION.md`.

## JP Tag Assistant optional integration

- CANVAS includes **日本語タグ検索 / JP Tag Search**, a Lumeweft-native Japanese/English lookup that outputs prompt-ready English Danbooru tags without ComfyUI.
- The maintainer confirmed direct author permission via social media on 2026-09-14 to bundle dictionary files. Retain the original permission evidence with release records.
- Bundle only `danbooru.csv`, `danbooru-jp.csv`, `danbooru-machine-jp.csv`, and `jp_tag_dictionary.csv`. The 30.5 MB related-tag co-occurrence archive is intentionally omitted, so related recommendation modes are not exposed.
- The upstream Python/JavaScript implementation remains excluded because permission was stated for dictionaries, not code. Lumeweft owns the CSV loading, matching, filtering, ranking, and CANVAS integration logic.
- The integration boundary and data provenance are recorded in `docs/JP_TAG_ASSISTANT_INTEGRATION.md` and `public/data/jp-tag-assistant/NOTICE.md`.

## Verification and known benign logs

- CANVAS includes **AInVFX Fluid — Paint to VFX** (`ainvfx-fluid`): native first/last keyframe painting, project PNG saves, and LTX 2.5 distilled IC-LoRA smoke/steam/fire generation. It uses 121 frames, 24/25/50 fps, dimensions in multiples of 64, eight steps and CFG 1. Workflow Setup owns pinned model downloads and the narrow official LTXVideo dependency. See `docs/AINVFX_FLUID_INTEGRATION.md` for source, implementation, and the Velorn port checklist.
- Fluid LoRA was installed and checksum-verified locally. The four LTX 2.5 base files remain missing behind Hugging Face access approval (HTTP 401). Schema/preflight, CANVAS browser interaction and focused tests passed, but GPU generation/quality remains unverified. Do not describe the integration as generation-tested or port it to Velorn before completing that check.

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

## Layered Paint (2026-09-14)

- Shared `LayerPaintDialog` now serves Assets new/edit and CANVAS image inputs, replacing active use of the inline Fluid painter. Layers, masks, brush/eraser/move, opacity/blends, undo and PNG + editable sidecar persistence work without ComfyUI. See `docs/LAYERED_PAINT.md` for file layout, limitations and verification. Source assets are preserved; each save creates a new asset.

## Shared generation memory management (2026-09-15)

- Generate/CANVAS/Director share serialized ComfyUI submission and cleanup, with pipeline activity leases, model transitions, idle/count/RAM/VRAM triggers, renderer video-cache trimming, and optional owned-process idle sleep/resume. Settings live under ComfyUI Launcher. Deep sleep defaults off; standard cleanup defaults on. See `docs/GENERATION_MEMORY_MANAGEMENT.md` for boundaries and verification. Live GPU memory recovery and process sleep/resume remain unverified; no LLM was bundled.

- 2026-09-16: Added a dedicated **Paint** top tab between CANVAS and Stock. `PaintWorkspace` provides new-image creation and an image gallery, using embedded `LayerPaintDialog`. Keep Paint mounted after first visit so tab switches retain unsaved drawing state. This separate workspace is the extension point for future paint features.

- 2026-09-16: Paint brush opacity is now per pointer gesture (`beginPaintStroke`), with a continuous smoothed path instead of repeated translucent circles. Preserve one-pass coverage compositing for brush, eraser and layer masks; otherwise scalloped strokes/opacity buildup return. Browser pixel regression: `tests/browser/layeredPaintStroke.html`.

- 2026-09-24: CANVAS includes **I2Iキャラクタ編集 / I2I Character Edit**. Reference 1 is the required original character; References 2–6 are optional clothing, accessory, prop, color, material, or design sources that can be named individually in the prompt. Because ComfyUI's Qwen Image Edit Plus encoder accepts only three images, Lumeweft keeps Reference 1 separate and automatically packs References 2–6 into two 1024×1024 sheets with visible numbered labels. The flow preserves the primary resolution and keeps identity/transfer constraints in the hidden base prompt.

- 2026-09-24: CANVAS image previews use contained, non-animated framing so image-input, style-reference, generation, and output nodes show the complete image instead of cropping its edges. Generation and output nodes retain up to six individual result previews in a two-column grid instead of collapsing same-media results into one thumbnail with a count badge.
- 2026-09-24: Director/Backstage template requests are one-shot. Opening a recipe such as AfterMidnightR2V must not keep re-selecting that document on every CANVAS state update. Explicit top-level navigation exits the temporary recipe view, and CANVAS restores the document that was active before the recipe opened; new projects still start on Blank Canvas.

- 2026-09-25: CANVAS includes direct official Google Gemini API templates for Nano Banana 2 Lite image generation/editing and Veo 3.1 Lite text/image-to-video. The API key is stored with Electron safe storage (or read from `GEMINI_API_KEY`), outputs are imported as project assets, and paid requests show a cost estimate. Google Flow consumer credits are separate and cannot be used through the API. See `docs/GOOGLE_GEMINI_API_INTEGRATION.md`.

- 2026-09-24: CANVAS includes **Qwen Image 2.1 Heretic GGUF** text-to-image generation and **Qwen Image 2.1 Heretic Edit**. Both pair the requested Heretic Q4_K_M Qwen3-VL encoder and matching mmproj with the official INT8 ConvRot diffusion model and RGBA VAE. The edit target is passed as `images.image_1` and the encoder-produced latent drives sampling, following the official Qwen Image 2.1 edit path. Each template has a persistent transparent-PNG switch; saved prompts stay untouched and the RGBA wrapper is added only at execution. Workflow Setup shares the four pinned model files between both flows, installs ComfyUI-GGUF, and explicitly verifies the temporary Qwen3-VL patch directory because that add-on exposes no node class. See `docs/QWEN_IMAGE_2_1_HERETIC_CANVAS.md`.

- 2026-09-25: CANVAS NSFW includes **Qwen 2.1 LoRA T2I** for Civitai model version `3351951` (`NSFW Qwen Lora.safetensors`, SHA-256 `c29f503f3515877882fd6b10f6849c78a4f2337c09021f4bd4b93d060c311aea`). It reuses the existing Qwen Image 2.1 Heretic base stack and inserts `LoraLoaderModelOnly` at strength 1.0. Published examples use `er_sde` / `beta`, CFG 1, and 20–25 steps; the preset defaults to 25. Install the LoRA through Generate > Community so the Civitai key and external-model consent gate remain authoritative.

- 2026-09-25: CANVAS NSFW includes **HARUKI_MIX Krea 2 T2I** for exact Civitai version `3188234` (`harukiMIX_kr2V20Int8Convrot.safetensors`, SHA-256 `7b903f38bc8a6f9e988a46f373b70beaf4fb70534a7a94fb94f300d461361bb9`). It reuses the Krea 2 encoder and VAE already required by Dark Beast, defaults to the publisher's Euler/simple, 8-step, CFG 1 recipe, and uses the published 816×1104 portrait size. Install the checkpoint through Generate > Community. The author permits image sale but prohibits paid generation services, merging, redistribution, and derivative checkpoint sharing.

- 2026-09-27: The plain **MiniMax H3 GGUF Reference Video to Video** CANVAS flow uses Kijai's `MiniMax-H3-Ref2VA-Acc-8Step_pruned_comfy.safetensors` PDD acceleration LoRA at strength 1.0 with the matched pruned Ref2VA GGUF base, Euler/simple, eight steps, and MiniMax H3 video/audio sigma shifts 12/3. Workflow Setup installs the exact 1,725,921,392-byte file and verifies SHA-256 `6f18e1c2eccb14b37322607730f26b16bf1169b56cd098ea006cffaec43d1e39`. Do not apply this PDD LoRA across all H3 presets: fused/VDN/Fast/Motion routes are already distilled, Pink/AfterMidnight/NaughtyTimes carry separate creative LoRAs, and Character Sheet remains on its quality-first 25-step recipe. This exclusion is intentional to avoid double-distillation and visually broken output.

- 2026-09-27: CANVAS NSFW includes **Wan 1.3B e10 T2V** using the exact Hugging Face file `NSFW-API/NSFW_Wan_1.3b/wan_1.3B_e10.safetensors` (2,838,095,480 bytes; SHA-256 `b0be4a5dded7594deb7c11bcb808dac86c79619ae73ca9917cd8f0447f203d80`). It is a full legacy Wan 2.1 T2V diffusion checkpoint, not a LoRA, and runs through ComfyUI core nodes with UMT5, the Wan 2.1 VAE, sampling shift 8, 30 steps, CFG 6, uni_pc/simple, 832x480, 16 fps, and 81 frames by default. Workflow Setup installs all three model files. Keep the exact requested e10 file even though the publisher now recommends `wan_1.3B_exp_e14.safetensors` and warns that the original e4-e20 training run degraded after epoch 3; surface that limitation rather than silently substituting another checkpoint.

- 2026-09-27: CANVAS includes **MiniMax H3 Character Swap** using `akatz-ai/MiniMax-H3-Character-Swap-LoRA` (`h3_character_swap_pro4500_1000.safetensors`, 155,110,320 bytes, SHA-256 `4b2a3f420ae804c0aa3422761ff84dbd1bf52eef6900ffab6d2e66df63cb4e79`). The beginner template fixes the published contract to one source video as `<Video 1>`, one replacement-character image as `<Picture 1>`, LoRA strength 1.0, 24 fps, and only 4- or 5-second shots. It reuses the low-memory Ref2VA Q4 runtime as an explicit compatibility adaptation of the author's INT8 training base, does not stack Turbo, and hides the SageAttention and reference-audio expert switches. Hard cuts, expression matching, timing, framing, and audio/lip-sync remain experimental limitations; the information card surfaces the MiniMax H3 Community License and its territory/authorization caveat.

- 2026-09-28: CANVAS separates **H3 Character Builder (.char)** from **H3 Fixed Characte (.char) movie** so a saved actor can be reused across shots like a character-locking LoRA. The Builder writes an OmniChar-compatible `INLINECHAR` v1 `.char` ZIP whose source of truth is the original face/body/clothing PNG references plus a locked description; it does not generate a movie. The Movie flow requires a saved or imported Character File and expands up to nine role-aware references into the existing Q4 Ref2VA + matched PDD 8-step route, avoiding OmniChar's native FP8/32B 24 GB recipe. The initial edition intentionally omits YuNet/SFace/DINOv2 scoring and model payload caches. See `docs/LUMEWEFT_CHARACTER_FILES.md`; GPU quality and peak-VRAM behavior remain unverified.

- 2026-09-28: CANVAS includes **H3バレットタイム** using `pablodawson/MiniMax-H3-360-Orbit-LoRA` (`minimax_h3_flf2v_lora_v1.safetensors`, 155,111,424 bytes, SHA-256 `14f13e3effaf3e729fdc0c97680344aa63f473be0c55963f963d718b3db2a4d4`, pinned to repository commit `5ddbc2dbbe95edbbdaf5017c3e934b1d01791697`). It is deliberately isolated from every other H3 flow and follows the narrow published FL2VA recipe: the same source image for first and last frame, publisher prompt, 768×768, 73 frames at 24 fps, 28 steps, BasicGuider/no CFG, LoRA strength 1.0, and no audio. The training set is only 28 human-centered square clips; non-human subjects, other aspect ratios or durations, and true subject immobility are not guaranteed. GPU output quality remains unverified until ComfyUI and the roughly 21 GB pruned INT8 base are available locally.

- 2026-09-28: CANVAS includes **H3ハンドヘルドカメラ** using the Hugging Face mirror `neph1/minimax_h3_handheld_shaky_camera` (`handheld_h3_100.safetensors`, 77,580,048 bytes, SHA-256 `d56360bc9de18abec4298518ed630167ee4a3f64a7dbbc8bc0c2259d33f74069`, pinned to repository commit `c089b7833cbdffc05bdf17b188e7d7a4aa9e3d88`; mirror of Civitai version `3343481`). It supports text-only generation or one optional first frame, defaults to the 640×480 and 3.75-second showcase shape, keeps native H3 audio, and fixes LoRA strength to the publisher's approximate showcase value 1.7. The LoRA is experimental and isolated from every other H3 flow because the publisher does not guarantee stacking with other LoRAs. The trained phrase is “shaky, handheld camera”, but the guided prompt omits the literal word “camera” to reduce the chance that H3 renders a camera as an object.
