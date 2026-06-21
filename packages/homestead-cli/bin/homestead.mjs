#!/usr/bin/env node
// npm entrypoint for the `homestead` CLI.
//
// The CLI source is TypeScript (src/cli.ts) and is run as-is by Bun or tsx in
// the rest of the system. For an npm-installed CLI we can't assume Bun is
// present, so this wrapper registers tsx's ESM loader (a runtime dependency)
// and then imports the TS entry. cli.ts runs at import time and reads
// process.argv.slice(2), which is unaffected by this indirection, so user args
// and the exit code flow through unchanged.
import { register } from 'tsx/esm/api';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

register();

const here = dirname(fileURLToPath(import.meta.url));
await import(join(here, '..', 'src', 'cli.ts'));
