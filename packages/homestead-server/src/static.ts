/**
 * Static SPA serving for prod. Assets come from disk when running from
 * source, or from a compiled binary's embedded files (the CLI passes its
 * embedded map through ServerOptions.spa).
 */

import type { BunFile } from 'bun';
import { existsSync, statSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Static SPA assets: disk (dev/source) or embedded files (compiled). */
export interface SpaAssets {
  index(): BunFile;
  file(relPath: string): BunFile | null;
}

const DEFAULT_DIST = fileURLToPath(
  new URL('../../homestead-app/dist', import.meta.url),
);

/** Disk-backed assets from the built SPA (packages/homestead-app/dist). */
export function diskSpaAssets(dir: string = DEFAULT_DIST): SpaAssets {
  const indexPath = join(dir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`built SPA not found at ${dir} — run \`make build\`, or start with --dev`);
  }
  return {
    index: () => Bun.file(indexPath),
    file: (rel) => {
      const safe = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
      if (!safe || safe === '.') return null;
      const p = join(dir, safe);
      return p.startsWith(dir) && isFile(p) ? Bun.file(p) : null;
    },
  };
}

/** Serve a static asset, falling back to index.html (SPA routing). */
export function serveStatic(spa: SpaAssets, path: string): Response {
  const rel = path.replace(/^\/+/, '');
  if (rel && rel !== '.') {
    const file = spa.file(rel);
    if (file) return new Response(file);
  }
  return new Response(spa.index(), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
