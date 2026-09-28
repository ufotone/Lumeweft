# TK Toolkit integration

## Decision

Lumeweft may integrate [TK Toolkit](https://github.com/Ararararararaki/comfyui-anima-toolkit). The source repository declares the MIT License, while Lumeweft is GPL-3.0-only. MIT-licensed code can be combined with and redistributed as part of a GPLv3 work as long as the MIT copyright and permission notice remain available with copied or substantially derived portions.

License and integration behavior were reviewed against upstream commit `a2bf0bfc90f84c7285a4098c9f15608bcda0abc4` on 2026-09-13.

The current integration does not vendor TK Toolkit source. Workflow Setup clones the publisher's repository into the user's own ComfyUI `custom_nodes` folder, where the upstream `LICENSE` remains intact.

## What ships in Lumeweft

- An optional TK Toolkit card in Generate -> Backstage.
- A curated Workflow Setup recipe that installs or updates the official repository and its required Python packages.
- Dependency detection through the stable `TK Batch LoRA Loader` node class.
- A direct launcher for the toolkit's ComfyUI-hosted panel.
- Japanese and English Lumeweft-facing names, descriptions, and setup guidance.

## Localization boundary

The upstream toolkit currently contains a large amount of Chinese UI text across its TypeScript panel, ComfyUI widget JavaScript, and Python node display metadata. Lumeweft must not describe the upstream panel as fully localized until those surfaces use a maintainable locale catalog.

A full Japanese/English edition should be maintained as an upstream contribution or a clearly identified fork, not as a brittle DOM text-replacement layer. The localization work should introduce locale catalogs and stable message keys in the toolkit source, preserve Chinese as an available locale, and add Japanese and English regression coverage before Lumeweft changes its launcher copy to claim full localization.

## Content and service boundaries

The MIT software license does not grant rights to third-party model weights, LoRAs, Civitai preview media, Danbooru posts, training images, generated outputs, or remote APIs. Those items retain their own licenses, content rules, and service terms. Lumeweft should keep those distinctions visible wherever it later exposes download or reuse actions natively.
