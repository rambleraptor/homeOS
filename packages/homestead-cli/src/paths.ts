import { resolve } from 'node:path';

/**
 * Absolute path to the repo root, derived from this file's location
 * (packages/homestead-cli/src). Only meaningful when running from source
 * (dev); a compiled binary uses embedded assets instead (see embed.ts).
 */
export const repoRoot = resolve(import.meta.dir, '../../..');
