import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Directory holding this package's sources (Bun's import.meta.dir, portably). */
export const srcDir = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the repo root, derived from this file's location
 * (packages/homestead-cli/src). Only meaningful when running from source;
 * a compiled binary resolves everything through the project's node_modules
 * instead (see supervisor.ts / spa-build.ts).
 */
export const repoRoot = resolve(srcDir, '../../..');
