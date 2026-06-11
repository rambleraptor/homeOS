/**
 * Standalone entry — `bun run src/index.ts [--dev] [--port N]
 * [--internal-port N] [--data-dir PATH]`. The launcher CLI calls
 * `startServer()` directly instead; this entry exists for dev (`bun --watch`)
 * and e2e.
 */

import { resolve } from 'node:path';
import { startServer } from './server';
import {
  DEFAULT_INTERNAL_PORT,
  DEFAULT_PUBLIC_PORT,
  type ServerOptions,
} from './options';

function flagValue(argv: string[], name: string): string | undefined {
  const eq = argv.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const i = argv.indexOf(name);
  return i !== -1 ? argv[i + 1] : undefined;
}

const argv = process.argv.slice(2);

const opts: ServerOptions = {
  dev: argv.includes('--dev'),
  publicPort: Number(
    flagValue(argv, '--port') ?? process.env.PORT ?? DEFAULT_PUBLIC_PORT,
  ),
  internalPort: Number(
    flagValue(argv, '--internal-port') ??
      process.env.AEPBASE_PORT ??
      DEFAULT_INTERNAL_PORT,
  ),
  dataDir: resolve(
    flagValue(argv, '--data-dir') ?? process.env.AEPBASE_DATA_DIR ?? 'data',
  ),
};

await startServer(opts);
