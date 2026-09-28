# Google Gemini media API integration

Lumeweft CANVAS can call Google's official Gemini API directly for image and video generation. This is separate from the consumer Google Flow website and does not use Google Flow credits.

## Setup

1. Create a Gemini API key in Google AI Studio and enable billing for its project.
2. In Lumeweft, open Settings > Connection.
3. Save the key under Google Gemini API and use Test to validate it.
4. In CANVAS, create either **Google Nano Banana 2 Lite** or **Google Veo 3.1 Lite**.

The key is stored through Electron `safeStorage`. `GEMINI_API_KEY` can be used instead; an environment key is never copied into settings.

## Initial model and cost policy

- Image: `gemini-3.1-flash-lite-image`, 1K output. The September 2026 list price is approximately USD 0.0336 per successful image, plus any input/text output usage.
- Video: `veo-3.1-lite-generate-preview`, 720p with audio, 4/6/8 seconds. The September 2026 list price is USD 0.05 per generated second.
- CANVAS shows an estimate before submitting the paid request. Pricing and availability can change; Google AI Studio remains authoritative.
- Google currently lists no Gemini API free tier for these image and video models. Google Flow's consumer credits cannot be spent by the Gemini API.

## Behavior

- Both templates support text-to-media.
- Connecting an image supplies an edit/reference image to Nano Banana or a start frame to Veo.
- Generated files are copied into the active project and registered as normal Lumeweft assets.
- Veo is a long-running operation. Lumeweft polls it and downloads the completed MP4 using the API key in the Electron main process.
- Generated media remains subject to Google's safety filters, terms, regional availability, quotas, and SynthID behavior.

## Verification boundary

The provider request shapes and error handling have unit coverage, and the renderer/electron production build passes. A live paid generation was not submitted during implementation because no user API key or approval to incur a charge was available.
