<div align="center">

# Lumeweft

<img src="public/splash.png" alt="Lumeweft — weave generative workflows into finished stories" width="100%">

**A local-first AI media workstation with community model integration and user-controlled content settings.**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue)](LICENSE)
[![Platforms](https://img.shields.io/badge/Platforms-Windows%20%C2%B7%20macOS%20%C2%B7%20Linux-444444)](#run-from-source)

[Help translate the Lumeweft interface](docs/LOCALIZATION.md)

</div>

Lumeweft is an independent, open-source desktop AI media workstation for creators who use ComfyUI. It brings planning, generation, asset management, timeline editing, captions, effects, and export into one project-based app.

Editing, captions, export, project management, and MCP editorial tools work without ComfyUI. All current generation features require a locally running ComfyUI instance.

Use built-in local and cloud workflows, import either a ComfyUI API workflow or regular UI/graph JSON, or install the bundled compatibility bridge so a graph open in ComfyUI can be sent back into Lumeweft. UI/graph JSON conversion requires the local ComfyUI frontend.

## Relationship to Velorn

This project can be regarded as an improved and expanded version based on Velorn.

Most of its core functionality depends on Velorn, but Lumeweft also includes many original features.

For the basic functionality, see [Velorn](https://github.com/VelornLabs/velorn).

This is a personal project developed independently from the Velorn development team.

No support or warranty of any kind is provided for this project.

### 日本語

このプロジェクトはVelornを元にした改良発展版のようなものです。

最も基本的な機能はVelornに依存していますが、Lumeweft独自の機能も多く存在します。

基本機能については[Velorn](https://github.com/VelornLabs/velorn)を参照してください。

Velornの開発チームとは独立した個人のプロジェクトです。

このプロジェクトに関しては何のサポートも保証も存在しません。

Major Lumeweft additions include:

- A **Community** model browser with Civitai URL lookup, authenticated downloads, license/permission metadata, trigger words, published-generation parameter reuse, and guided checkpoint/LoRA workflow creation.
- **CANVAS**, a visual media workflow workspace, including image/video-to-prompt analysis through the separately installed MiniMax H3 Promptor custom node.
- A generation library with version history, prompt reuse, portable recipe/artifact export, and custom-workflow import and repair helpers.
- Automatic import of outputs produced directly in the embedded ComfyUI workspace.
- Guided-workflow improvements for Music Video, Short Film, UGC, and Business Ad creation, including local Irodori-TTS v3 dialogue support.
- Expanded Japanese localization, configurable prompt translation, safer third-party-model consent, responsive Settings UI, and lightweight static effect previews.
- ComfyUI launcher, dependency-installation, workflow-loading, asset-relinking, and project-persistence improvements developed around real local workflows.

See [Changes from Velorn](docs/CHANGES_FROM_VELORN.md) for a more detailed comparison and [UPSTREAM.md](UPSTREAM.md) for attribution and compatibility notes.

## What Lumeweft Is For

- Creating music videos from lyrics, timing, characters, keyframes, video shots, and timeline edits.
- Building UGC-style creator ads and small-business ads with editable shot plans.
- Running curated local and cloud image/video workflows from one Generate workspace.
- Running custom ComfyUI image, video, keyframe, and music-video workflows inside the app.
- Editing generated clips with tracks, transitions, effects, captions, proxy/cache tools, and export.
- Keeping generated media, prompts, workflow outputs, and timelines organized inside a project.

For generation, Lumeweft is not a replacement for ComfyUI. It is the production layer around ComfyUI: plan the work, send jobs to ComfyUI, collect the outputs, and finish the edit.

## Download

Packaged Lumeweft builds will be published on the [Lumeweft Releases page](https://github.com/ufotone/Lumeweft/releases). Until a release is available, build and run the application from source using the instructions below.

Release assets include:

- `Windows Installer`
- `Windows Portable`
- `Mac (Apple Silicon)`
- `Mac (Intel)`
- `Linux AppImage`
- `Linux deb`

Ignore GitHub's auto-generated source-code archives unless you plan to build Lumeweft from source.

## Main Features

### Generate

Generate runs built-in local workflows, cloud/partner workflows, and custom ComfyUI workflows.

- Local image, video, image-edit, audio, and utility workflows.
- Cloud workflows such as Nano Banana 2, GPT Image 2, Seedance, Kling, and other partner-node routes where available.
- Custom Image and Custom Video workflows for users who want Lumeweft to run their own ComfyUI API graphs.
- API JSON import for advanced users who prefer exporting workflows manually from ComfyUI.
- Compatibility bridge support so existing `VELORN_*` endpoint graphs can be sent from ComfyUI back to the correct Lumeweft panel.
- Workflow setup checks for missing nodes, models, credentials, and configuration.
- A Featured / My Workflows / Templates browser with Local and Cloud filters. Imported community workflows appear in Featured next to the built-ins.

The Templates tab browses the official ComfyUI template catalog (500+ templates with size and popularity info) and launches any of them into the embedded ComfyUI tab.

### Create

Create contains guided creator workflows built on the inherited Director Mode engine.

- **Music Video Creation** - turns a song, lyric timing, characters, references, and a director script into keyframes, video shots, and an editable timeline.
- **UGC Creator** - builds creator-style social ads with hooks, dialogue, product demos, try-ons, testimonials, and editable shot-by-shot outputs.
- **Business Ad Creator** - builds offer-first ads for local businesses, ecommerce products, events, services, and small teams.
- **Short Film Creation** - experimental script-to-scene coverage with selectable ElevenLabs cloud voices or local Irodori-TTS v3 dialogue. Workflow Setup can install the Irodori custom nodes, Python requirements, and model for a new ComfyUI environment. This is still very beta and may have rough edges.

### Music Video Creation

The Music Video Creator supports:

- Song import and lyric timing.
- ASR transcription or pasted-lyrics alignment into SRT.
- People/cast setup, including existing character sheets.
- Per-shot keyframe prompts, reference images, prompt copy, prompt editing, image replacement, and shot reruns.
- Built-in keyframe routes such as Qwen Image Edit and Nano Banana 2.
- Custom keyframe workflows using the inherited `VELORN_*` compatibility endpoint nodes.
- Built-in video routes such as LTX 2.3 Music and WAN 2.2.
- Custom video workflows with optional injected keyframe image, prompt, seed, width, height, FPS, duration, and audio.
- Timeline assembly from generated shot assets.

### Timeline Editor

The editor includes:

- Project asset browser.
- Multi-track video/audio timeline.
- Clip trimming, moving, snapping, overlap replacement behavior, and transitions.
- Text, shape, title, solid-color, adjustment-layer, keyframe, and visual effect tools.
- Inspector controls.
- Proxy/cache tools for smoother playback.
- Export panel for final renders.

### Captions

Captions can be generated from edited timeline audio and styled in-app.

- Timeline-aware transcription.
- Caption style presets.
- Font, color, outline, background, shadow, and animation controls.
- Saved caption style presets for reuse.
- Live preview with play/scrub controls and safe-zone overlays.
- Export-ready caption renders.

### Export

The Export tab includes practical render presets, hardware-accelerated options where available, numbered PNG image sequence export, queue controls, and project-aware output settings.

### Stock

The Stock tab uses Pexels so you can search and import photos or videos directly into the current project. A Pexels API key is optional and can be added in Settings.

### ComfyUI Integration

Lumeweft talks to a local ComfyUI server and can also help launch it.

- Default endpoint: `http://127.0.0.1:8188`
- Custom port support in Settings.
- Windows launcher support for a configured ComfyUI start script.
- macOS launcher support for a configured `ComfyUI.app`.
- Optional auto-start, stop-on-quit, and restart behavior.
- Embedded ComfyUI tab for opening and editing graphs.
- ComfyUI account login support inside the embedded ComfyUI tab.
- ComfyUI credit balance display when available.

Only localhost/loopback ComfyUI endpoints are supported in the desktop app.

### AI Agents (MCP)

Lumeweft includes a local MCP server with 100+ tools for Codex, Claude Code, Cursor-compatible tools, and other MCP clients.

- Endpoint: `http://127.0.0.1:19790/mcp`
- In-app setup: `Settings > Agents (MCP)` (one copy-paste command per client)
- Guide: [docs/MCP.md](docs/MCP.md)

Agents can inspect the open project, review timeline frames and visible shots, troubleshoot ComfyUI setup, preview safe timeline edits, queue approved generation work, and start delivery exports.

Agents can also bring in community ComfyUI workflows: hand one a workflow link or file, and it analyzes the graph, reports missing custom nodes and models, installs them after your approval, and runs the workflow on your timeline assets.

Most MCP write tools support a preview step, and many default to preview-first behavior. Normal timeline edits participate in Lumeweft's undo system. Imports, exports, generated files, project creation, and other filesystem changes are not universally undoable, so agents should get explicit approval before applying them. MCP is the recommended automation path for agent-assisted review, timeline operations, graphics polish, and generation workflows.

## Custom Workflows

Custom workflows are one of the main reasons Lumeweft exists.

Advanced users can:

1. Open a starter graph from Lumeweft.
2. Modify it in ComfyUI.
3. Keep the required compatibility endpoint nodes.
4. Send it back with the compatibility bridge or import either the API workflow JSON or regular UI/graph JSON manually.
5. Run that graph from Lumeweft as part of a creator flow or from Generate.

Common inherited endpoint node titles include:

- Velorn input image - `VELORN_INPUT_IMAGE`
- Velorn prompt - `VELORN_PROMPT`
- Velorn seed - `VELORN_SEED`
- Velorn width - `VELORN_WIDTH`
- Velorn height - `VELORN_HEIGHT`
- Velorn FPS - `VELORN_FPS`
- Velorn duration - `VELORN_DURATION`
- Velorn audio - `VELORN_AUDIO`
- Velorn output image - `VELORN_OUTPUT_IMAGE`
- Velorn output video - `VELORN_OUTPUT_VIDEO`

Exact `VELORN_*` titles are preferred for compatibility with existing graphs, but Lumeweft also recognizes readable titles such as `Velorn input image`. Older graphs that still use `COMFYSTUDIO_*` marker titles remain supported. These names are compatibility identifiers and do not indicate affiliation with the upstream project.

If an endpoint is present, Lumeweft can inject that value. If an endpoint is not present, the graph controls that setting itself.

## Requirements

Normal editing:

- No ComfyUI installation or Comfy account is required.
- Allow enough disk space for project assets, cache files, and exports.

Generation:

- A separately installed local ComfyUI running on the same machine is required for all current generation workflows.
- Local workflows may require compatible hardware, models, and custom nodes.
- Partner-node workflows require the appropriate Comfy.org credentials and credits.

Optional integrations:

- Pexels API key for the Stock tab.
- LM Studio for the local LLM Assistant.

Local workflow requirements vary by model. Some workflows can run on modest GPUs, while heavy video workflows may need 24 GB+ VRAM. Cloud workflows shift most of that requirement to the provider but may require credits.

## First Run

1. Install and launch Lumeweft.
2. Choose a projects folder.
3. Create or open a project.
4. Use `Lumeweft > Getting Started` from the bottom menu if you want the guided setup path.

To use generation, configure your local ComfyUI instance in `Settings > ComfyUI Connection`. This step is optional for editing, captions, export, project management, and MCP editorial tools. If ComfyUI is running on a non-default port, update the endpoint in Settings and run the connection test.

## ComfyUI Setup Notes

Lumeweft ships workflow JSON files, but workflows still need the correct ComfyUI environment.

Depending on the workflow, users may need:

- Custom nodes installed in ComfyUI.
- Model files in the expected folders.
- Cloud/partner credentials.
- Enough local VRAM for the selected model and resolution.

Current Lumeweft builds talk to local ComfyUI without any CORS setup. Legacy inherited builds may require ComfyUI's `--enable-cors-header` option if the embedded tab is blank or API calls return 403.

Inside Generate, use the workflow setup and dependency tools when something is missing.

## Run From Source

For development, run the Electron app:

```bash
npm install
npm run electron:dev
```

Browser-only `npm run dev` is useful for frontend work, but Electron is the normal development path because many features depend on desktop APIs.

## Build Commands

```bash
npm run build
npm run electron:build:win
npm run electron:build:mac
npm run electron:build:linux
```

Packaged artifacts are written to `release/`.

For release process details, see:

- `docs/RELEASE_PROCESS.md`
- `docs/CI_SECRETS.md`
- `docs/AI_RELEASE_HANDOFF.md`

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## Contributing

Lumeweft is open source, and contributions are welcome.

See:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SECURITY.md`

## License and third-party components

Lumeweft is distributed under **GNU General Public License v3.0 only (`GPL-3.0-only`)**. See [LICENSE](LICENSE). The repository preserves the upstream Git history, copyright notices, and attribution required for the Velorn-derived code.

Lumeweft is an independent fork and is not affiliated with, endorsed by, or supported by VelornLabs. See [UPSTREAM.md](UPSTREAM.md) and [Changes from Velorn](docs/CHANGES_FROM_VELORN.md).

Models, ComfyUI custom nodes, cloud services, example media, and other third-party components are not automatically relicensed by Lumeweft. Their own licenses, terms, acceptable-use rules, and commercial-use restrictions continue to apply. Lumeweft provides no warranty regarding third-party components or generated outputs.
