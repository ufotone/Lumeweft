# Generation memory management

Implemented 2026-09-15. Settings → ComfyUI Launcher → Generation memory management.

Generate, Director and CANVAS use a single manager at the ComfyUI service submission boundary. Model filenames form a signature; changing that signature requests standard ComfyUI model unloading and execution-cache cleanup before the next application submission when the server queue is empty. No cleanup custom node is required. Direct embedded-ComfyUI generation shares idle/pressure cleanup; its prompts cannot be intercepted at submission time.

Defaults: automatic management enabled; 60-second idle timeout; cleanup after 20 completed prompts at a safe boundary; free RAM target 4 GiB; free VRAM target 2 GiB; deep process sleep disabled. Targets trigger cleanup, not admission guarantees. Settings persist immediately in renderer localStorage.

The manager serializes cleanup, resume and application prompt submission. Generate and CANVAS hold activity leases through preparation, generation and result import so timers and manual cleanup cannot interrupt those stages. Model transitions inside an active pipeline still use the serialized submission boundary. Unknown, disconnected, running or pending queues never authorize cleanup. Success/complete aliases are deduplicated in a bounded 200-ID set.

Standard cleanup uses POST /free with unload_models and free_memory. HTTP success means flags were accepted. GPU telemetry is sampled after the request for up to six iterations; stable readings are reported as stable readings, not proof that every allocation was released. Failed requests remain retryable. Python/custom-node retained references and driver allocations may survive normal cleanup.

System RAM telemetry comes from a narrow Electron IPC using os.freemem()/totalmem(). ComfyUI supplies GPU telemetry. Renderer cleanup releases cached video decoders in the hidden editor and inactive decoders in a paused editor; active playback is preserved. It does not clear assets, generation history, saved files, paint layers or undo data, and does not claim to purge every renderer texture/cache.

Optional deep idle sleep stops only a running script process owned by Lumeweft (ownership ours). Electron rechecks queue, endpoint, PID and ownership before stopping; external servers and macOS app ownership are excluded. Future real model/object-info access, upload or submission resumes the configured launcher and waits for its API, bounded to five minutes plus network timeouts. Background connection heartbeats keep sleeping available on demand without waking it. A failed resume prevents submission and preserves the sleeping state for retry. Independent external clients can enqueue between any remote queue check and an action; the managed endpoint should not be shared when enabling automatic process sleep.

Validation: 10 manager lifecycle tests plus existing Fluid and CANVAS text suites (19 tests total), renderer build and Electron main/preload syntax checks passed. Actual RAM/VRAM recovery and owned-process sleep/resume still require live desktop/GPU verification after restarting Electron. No LLM runtime or weights were added.
