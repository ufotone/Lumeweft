# Changes from Velorn

Lumeweft is an independent GPL-3.0-only fork derived from [Velorn](https://github.com/VelornLabs/velorn). It preserves the upstream editing foundation and compatibility surfaces while exploring a broader, Windows-first local AI-media workflow.

This document summarizes the material differences in the current Lumeweft development snapshot. It is a functional overview, not a claim that every upstream and fork implementation detail will remain permanently different.

## Upstream foundation retained

The original Velorn codebase provides the core project system, media asset management, multitrack video/audio timeline, preview renderer, effects, captions, stock-media search, export pipeline, guided creation modes, custom ComfyUI workflow support, embedded ComfyUI workspace, local MCP server, and cross-platform Electron packaging configuration.

Lumeweft intentionally retains legacy project, bridge, workflow-marker, and storage identifiers where renaming them would break existing projects or integrations.

## Lumeweft additions and improvements

### Community models

- Added a provider-neutral Community area in Generate, with Civitai implemented as the first provider.
- Supports `civitai.com` model links, authenticated downloads, cancellation, persistent download state, and filename-based installed detection.
- Displays model/version/file metadata and author-provided permission information before use.
- Builds guided local workflows for compatible diffusion models, checkpoints, LoRA/LyCORIS files, and ANIMA split-model configurations.
- Reuses published prompts, trigger words, LoRA weights, seed, steps, CFG, sampler, scheduler, denoise, and output dimensions when available, while keeping the locally selected compatible base model authoritative.

### CANVAS and prompt analysis

- Exposes the visual CANVAS workspace for connecting project media, generation steps, prompt tools, and outputs.
- Adds an Image / Video to Prompt template backed by the separately installed `1038lab/ComfyUI-MiniMax-H3-Promptor` custom node.
- Sends project images at their native dimensions and project videos as videos for temporal sampling.
- Returns structured prompt text to CANVAS for viewing or downstream generation.

### Generation records and reusable workflows

- Adds a project-aware generation library with immutable versions and active-version selection.
- Adds prompt-library and preference storage, generation recipe metadata, and portable generation artifact export.
- Improves imported custom-workflow binding, validation, missing-dependency reporting, and conservative auto-repair.
- Automatically imports unmanaged outputs created directly in embedded ComfyUI into organized project asset folders.

### Guided creation

- Expands Music Video output controls, responsive shot-card layouts, prompt previews, reference selection, and queued-job cancellation.
- Adds local Irodori-TTS v3 dialogue generation to Short Film Creation alongside the inherited cloud voice route.
- Improves workflow dependency installation for custom nodes, Python requirements, and curated models.
- Strengthens Civitai-to-workflow routing for local checkpoints, LoRAs, and published example parameters.

### Editing and interface

- Adds expanded Japanese localization and prompt translation that does not require a local LLM.
- Adds user-controlled third-party/community-model consent and risk messaging.
- Improves low-resolution Settings navigation with bounded scrolling and compact responsive spacing.
- Adds lightweight static effect-preview thumbnails using one cached WebP reference image rather than live preview canvases.
- Renames the inherited visual flow workspace to the short user-facing name **CANVAS**, while retaining legacy internal identifiers for project compatibility.

### Local ComfyUI reliability

- Improves configurable ComfyUI launching, restart/remount behavior, connection handling, workflow loading, and frontend readiness checks.
- Improves dependency discovery and curated installation flows.
- Adds Qwen ASR compatibility for both current `model_variant` and legacy `model_size` TTS-Audio-Suite schemas from upstream Velorn v0.3.28.
- Preserves full video input for workflows that analyze motion or sample frames over time.

## Development and platform status

Lumeweft-specific development and validation currently happen primarily on Windows. The inherited Linux and macOS code paths and packaging definitions are preserved. New OS-specific features should use isolated Electron adapters and safe fallbacks rather than embedding Windows-only paths or APIs into shared renderer code.

Windows verification does not imply that every Lumeweft-specific feature has already been exercised on Linux, Intel Mac, or Apple Silicon Mac.

## Licensing and attribution

- Lumeweft source code is distributed under `GPL-3.0-only`; see the repository [LICENSE](../LICENSE).
- Velorn-derived code retains its upstream history, notices, and GPL obligations.
- Lumeweft is not affiliated with or endorsed by VelornLabs; see [UPSTREAM.md](../UPSTREAM.md).
- Third-party models, ComfyUI custom nodes, hosted APIs, and media remain subject to their own licenses and service terms.
- Downloading or invoking a third-party component through Lumeweft does not transfer ownership or override that component's license.
