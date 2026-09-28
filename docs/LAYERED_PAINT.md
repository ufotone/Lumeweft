# Layered Paint in Lumeweft

Entry points: dedicated Paint top tab between CANVAS and Stock, Assets toolbar pencil (new image), image asset context menu (edit), CANVAS image-compatible input inspector (create/edit). AInVFX uses 512px black defaults and can add the first keyframe as an image layer. Ordinary new images default to 1024px transparent.

Features: round brush, eraser, move the selected pixels or mask, brush size/opacity/color, layers with visibility/name/opacity/blend, duplication, ordering, deletion, nondestructive masks with hide/reveal, mask preview/inversion/disable, project image layers, fit/25–400% zoom, undo/redo. Closing unsaved work requires a discard choice. Mask alpha encodes visibility; its preview is white over black. Moving pixels and moving a mask are separate operations.

Save always creates a new normal PNG asset and self-contained versioned JSON sidecar. The asset's `settings.paintDocument.path` references `assets/paint/<uuid>.lumeweft-paint.json`; the flattened PNG lives under `assets/images/Paint`. Existing source assets and prior sidecars are immutable. Move the whole project folder to retain editability; copying only a PNG or a CANVAS archive does not transfer editable layers. A missing/corrupt sidecar reports an error and offers explicit flattened-image recovery. Failed writes may leave an unregistered file; the source asset remains unchanged.

Limits: 16–4096 pixels per axis, 16 layers, 64 million total layer/mask pixels, bounded undo (up to 20 steps / 48 MB serialized history). No PSD/Krita import, selections, pressure sensitivity or vector tools in this initial implementation. ComfyUI is not required for painting.

Validation: 29 focused Node tests passed (paint validation/history/save failures, AInVFX, H3, localization). Browser checks cover actual canvas compositing, masking without source-pixel loss, inversion, disabled masks, ordering, serialize/reload; UI creation, two layers, mask painting, PNG/sidecar save and reopen; Assets entry points and CANVAS AInVFX defaults. Renderer production build passed. Packaged Electron and tablet input have not been exercised.

## Paint workspace (2026-09-16)

`PaintWorkspace` owns the top-level image gallery and drawing session. The shared painter supports embedded rendering in this workspace while retaining modal rendering for Assets/CANVAS. App lazy-mounts Paint on first visit and keeps it mounted across tab switches, preserving unsaved layers and undo history. Project-session changes reset the workspace. Saving or explicitly closing returns to the image gallery; unsaved close retains the existing discard prompt.

## Continuous translucent strokes (2026-09-16)

Brush/eraser/mask gestures now render an opaque coverage path on a temporary canvas and composite once at the selected opacity against the pre-gesture snapshot. Midpoint quadratic curves and round caps/joins replace repeated circular alpha stamps. Within one gesture, crossings and variable input density do not increase opacity. Separate gestures accumulate normally. Pointer samples include coalesced events, redraws are limited to animation frames, pointer-up flushes the endpoint before history/save, and cancellation/lost capture restores the original pixels. No new dependencies or document-format changes.

Browser regression page: `/tests/browser/layeredPaintStroke.html` on the Vite development server. It checks uniform alpha, sparse/dense samples, separate-stroke accumulation, self-crossing, eraser/mask concealment, cancel and a single tap, and displays thick/thin translucent curves. Verified using Chromium canvas and actual painter drag/undo/redo/save UI. Physical tablet/pen feel remains unverified.
