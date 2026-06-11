// Run homestead-server inside the launcher's own Bun process (prod).
//
// Implemented in JS (with a hand-written .d.ts) so the CLI's `tsc` doesn't
// follow this import into the server's app graph (the app registry + every
// app worker + the DOM/JSX app types). `bun build --compile` still bundles
// the server — and through it homestead.config.ts — into the binary.
import { startServer } from '@rambleraptor/homestead-server/src/server.ts';

export { startServer };
