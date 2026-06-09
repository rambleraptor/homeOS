/**
 * Homestead sidecar — standalone entry point.
 *
 * Run with Bun (`bun run src/server.ts`). Used in dev (the launcher spawns it
 * as a `bun --watch` child) and for standalone backend work. In prod the
 * launcher serves the same {@link app} in-process instead (see the homestead
 * CLI's sidecar-inproc.js), so there is no separate sidecar process.
 */

import { app } from './app';
import { syncSchema } from './schema-sync';

// Apply app-declared schema to aepbase in the background; serving the API
// doesn't depend on it (the sync is idempotent and best-effort).
void syncSchema();

const port = Number(process.env.PORT ?? 4000);
console.log(`[sidecar] listening on :${port}`);

export default { port, fetch: app.fetch };
