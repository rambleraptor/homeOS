// Asset resolution: where the built SPA comes from. Running from source
// (dev) these are repo paths. A compiled binary (`bun build --compile`, see
// embedded.generated.ts) bakes the SPA in; the server itself is bundled JS,
// so nothing needs extraction.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './paths.ts';
import { spaFiles } from './embedded.generated.ts';
import { diskSpaAssets, type SpaAssets } from '@rambleraptor/homestead-server/src/static.ts';

export type { SpaAssets };

/** True when running inside a `bun build --compile` single-file executable. */
export const isCompiled = Bun.embeddedFiles.length > 0;

/** Resolve the bun executable (PATH, then the default install location). */
export function findBun(): string {
  const onPath = Bun.which('bun');
  if (onPath) return onPath;
  const fallback = join(homedir(), '.bun', 'bin', 'bun');
  if (existsSync(fallback)) return fallback;
  throw new Error('bun not found on PATH or ~/.bun/bin (install from https://bun.sh)');
}

/** Base cache dir (~/.homestead/cache), overridable via HOMESTEAD_CACHE_DIR. */
export function cacheRoot(): string {
  return process.env.HOMESTEAD_CACHE_DIR || join(homedir(), '.homestead', 'cache');
}

/** SPA assets for the server: embedded map (compiled) or disk dir. */
export function spaAssets(): SpaAssets {
  const files = spaFiles;
  if (files) {
    const index = files['index.html'];
    if (!index) throw new Error('embedded SPA is missing index.html');
    return {
      index: () => Bun.file(index),
      file: (rel) => {
        const p = files[rel];
        return p ? Bun.file(p) : null;
      },
    };
  }
  return diskSpaAssets(join(repoRoot, 'packages', 'homestead-app', 'dist'));
}
