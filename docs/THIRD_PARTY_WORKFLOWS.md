# Third-party workflows and dependencies

This document explains the licensing boundary for Lumeweft's bundled workflow definitions and the external software, models, data, and services those workflows can use.

## Lumeweft workflow definitions

Workflow JSON, guided-workflow configuration, glue code, and documentation authored for this repository are distributed as part of Lumeweft under `GPL-3.0-only`, unless a file contains a different notice. A bundled workflow definition is an interoperability recipe; it does not relicense any model, custom node, dataset, API, example image, or other external dependency referenced by that recipe.

The workflow starter pack records provenance and dependency metadata in:

- `docs/workflow-starter-pack/INDEX.md`
- `docs/workflow-starter-pack/docs/workflows/`
- `docs/workflow-starter-pack/models/model-manifest.json`
- `docs/workflow-starter-pack/nodes/custom-node-manifest.json`
- `docs/workflow-starter-pack/starter-pack.manifest.json`

The runtime catalog in `src/config/workflowInstallCatalog.js` is the canonical source for model source URLs, license URLs, pinned filenames, hashes, access requirements, and notes used by the application. Generated starter-pack manifests mirror that catalog for offline inspection.

## External components

External components retain their own licenses and terms. Before downloading, installing, redistributing, or using one, review the license at the recorded source URL and any model card, repository notice, service terms, acceptable-use policy, and territory restriction. Terms can change after a Lumeweft release; the publisher's current terms control.

Important categories include:

- **ComfyUI and custom nodes.** Installed into the user's separate ComfyUI environment. Each repository's license applies. A repository without a clear license must not be assumed reusable or redistributable merely because Lumeweft can interoperate with it.
- **Models, LoRAs, VAEs, and text encoders.** Not part of the Lumeweft GPL grant. Model-specific community, research, commercial-use, redistribution, or territory terms continue to apply.
- **Cloud APIs and hosted services.** Governed by the provider's current service terms, pricing, privacy rules, content policy, and API agreement. Consumer credits may not be interchangeable with API billing.
- **Datasets and dictionaries.** Keep their source-specific permission and attribution. The JP Tag Assistant files have a dedicated provenance notice at `public/data/jp-tag-assistant/NOTICE.md` and integration notes at `docs/JP_TAG_ASSISTANT_INTEGRATION.md`.
- **User-supplied or downloaded media.** Copyright and other rights remain with their respective owners. Lumeweft does not grant rights to input media, previews, examples, or generated output.

## Notable restrictions surfaced by current workflows

The following summaries are convenience warnings, not substitutes for the linked license text:

- MiniMax H3 components use the MiniMax H3 Community License and may include territory or authorization conditions.
- Qwen Image 2.1 components use the Qwen Research License unless the specific source states otherwise.
- Civitai-hosted resources keep the permissions and restrictions selected by each publisher. Some resources prohibit redistribution, derivative checkpoint sharing, paid generation services, or particular commercial uses even when image sale is allowed.
- Access-gated Hugging Face repositories require the user to obtain access and accept the publisher's terms directly.
- The Google Gemini and Veo integrations use the user's own API credentials and are subject to Google's current API terms, pricing, safety rules, and regional availability.

Lumeweft surfaces available license URLs and notes during dependency review, but it does not provide legal advice or guarantee that a particular use is permitted.

## Distribution policy

Lumeweft does not intentionally commit downloaded model weights, API credentials, personal projects, generated media, ComfyUI installations, or machine-specific paths. Installer recipes download dependencies from their publishers or require the user to install them separately. Hashes and pinned source revisions are integrity and provenance records; they are not license grants.

When adding or updating a workflow:

1. Record the publisher's source URL and the most specific available license URL.
2. Pin the revision, filename, size, and SHA-256 where practical.
3. Document access gates and material commercial-use, redistribution, territory, or acceptable-use restrictions.
4. Do not copy external code, workflows, media, or data into the repository without a compatible license or documented permission.
5. Regenerate the workflow starter-pack manifests and checksums when dependency metadata changes.
6. Recheck the publisher's current terms before release.

Questions about a third-party license should be directed to that component's publisher. Questions about Lumeweft's own GPL-licensed code can be raised in the Lumeweft repository.
