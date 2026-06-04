// Serve the sidecar's Hono app inside the launcher's own Bun process (prod),
// so the binary doesn't embed a second compiled bun runtime for the sidecar.
//
// Implemented in JS (with a hand-written .d.ts) so the CLI's `tsc` doesn't
// follow this import into the sidecar's module graph (Hono + every module
// worker + the DOM/JSX app types). `bun build --compile` still bundles it.
//
// The caller MUST set AEPBASE_URL + AEPBASE_ADMIN_EMAIL/PASSWORD in the
// environment BEFORE importing this module: the sidecar's server-side aepbase
// client reads AEPBASE_URL at import time.
import { app } from '@rambleraptor/homestead-sidecar/src/app.ts';
import { syncSchema } from '@rambleraptor/homestead-sidecar/src/schema-sync.ts';

export function serveSidecar(port) {
  // Best-effort, idempotent schema sync (same as the standalone entry).
  void syncSchema();
  console.log(`[sidecar] serving in-process on :${port}`);
  return Bun.serve({ port, idleTimeout: 0, fetch: app.fetch });
}
