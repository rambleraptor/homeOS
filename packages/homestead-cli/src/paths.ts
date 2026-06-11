import { resolve } from 'node:path';

/**
 * Absolute path to the repo root, derived from this file's location
 * (packages/homestead-cli/src). Only meaningful when running from source;
 * a compiled binary resolves everything through the project's node_modules
 * instead (see supervisor.ts / spa-build.ts).
 */
export const repoRoot = resolve(import.meta.dir, '../../..');
