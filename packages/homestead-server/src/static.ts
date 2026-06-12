/**
 * Static SPA serving for prod. Assets are read from disk — either the repo's
 * built SPA (packages/homestead-app/dist) or the launcher-built dist passed
 * via --spa-dist. Streams through node:fs so the same code runs under Bun
 * and Node.
 */

import { existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openFileStream } from './engine/files';

/** A servable static asset (absolute disk path + derived metadata). */
export interface SpaAsset {
  path: string;
  size: number;
  contentType: string;
}

/** Static SPA assets resolved by request path. */
export interface SpaAssets {
  index(): SpaAsset;
  file(relPath: string): SpaAsset | null;
}

const DEFAULT_DIST = fileURLToPath(
  new URL('../../homestead-app/dist', import.meta.url),
);

// Everything a Vite SPA build can emit; unknown extensions fall through to
// application/octet-stream.
const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

export function contentTypeFor(path: string): string {
  return CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

function asset(path: string): SpaAsset {
  return { path, size: statSync(path).size, contentType: contentTypeFor(path) };
}

/** Disk-backed assets from the built SPA (packages/homestead-app/dist). */
export function diskSpaAssets(dir: string = DEFAULT_DIST): SpaAssets {
  const indexPath = join(dir, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`built SPA not found at ${dir} — run \`make build\`, or start with --dev`);
  }
  return {
    index: () => asset(indexPath),
    file: (rel) => {
      const safe = normalize(rel).replace(/^(\.\.(\/|\\|$))+/, '');
      if (!safe || safe === '.') return null;
      const p = join(dir, safe);
      return p.startsWith(dir) && isFile(p) ? asset(p) : null;
    },
  };
}

/** Serve a static asset, falling back to index.html (SPA routing). */
export function serveStatic(spa: SpaAssets, path: string): Response {
  const rel = path.replace(/^\/+/, '');
  if (rel && rel !== '.') {
    const file = spa.file(rel);
    if (file) return assetResponse(file);
  }
  return assetResponse(spa.index());
}

function assetResponse(a: SpaAsset): Response {
  return new Response(openFileStream(a.path), {
    headers: {
      'content-type': a.contentType,
      'content-length': String(a.size),
    },
  });
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
