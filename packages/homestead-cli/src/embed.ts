// Asset resolution: where the aepbase binary, the built SPA, and the sidecar
// come from. Running from source (dev) these are repo paths. A compiled binary
// (`bun build --compile`, see embedded.generated.ts) bakes them in; the native
// aepbase + sidecar binaries are extracted to a cache dir before exec — Bun's
// virtual FS can't exec in place.
import type { BunFile } from 'bun';
import { chmodSync, existsSync, mkdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, normalize } from 'node:path';
import { repoRoot } from './paths.ts';
import { aepbasePath, spaFiles } from './embedded.generated.ts';

/** True when running inside a `bun build --compile` single-file executable. */
export const isCompiled = Bun.embeddedFiles.length > 0;

/** Static SPA assets, served from disk (dev) or embedded files (compiled). */
export interface SpaAssets {
  index(): BunFile;
  file(relPath: string): BunFile | null;
}

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

/**
 * Resolve an executable aepbase binary path. Order: explicit override env →
 * embedded (extracted to cache) → dev repo build.
 */
export async function resolveAepbaseBinary(): Promise<string> {
  const override = process.env.HOMESTEAD_AEPBASE_BIN;
  if (override) return override;

  if (aepbasePath) {
    return extractExecutable('aepbase', await Bun.file(aepbasePath).bytes());
  }

  const devPath = join(repoRoot, 'aepbase', 'bin', 'aepbase');
  if (existsSync(devPath)) return devPath;
  throw new Error(
    `aepbase binary not found at ${devPath} — build it with \`make aepbase\` (or set HOMESTEAD_AEPBASE_BIN)`,
  );
}

/**
 * Command + cwd to launch the sidecar as a `bun --watch` child (dev only). In
 * prod the sidecar runs in-process (see sidecar.ts), so it isn't embedded.
 */
export function resolveSidecarDevCommand(): { cmd: string[]; cwd?: string } {
  const entry = sidecarSource();
  if (!existsSync(entry)) {
    throw new Error(`sidecar source not found at ${entry} (run --dev from the repo root)`);
  }
  return { cmd: [findBun(), '--watch', 'run', entry], cwd: repoRoot };
}

/** SPA assets for the edge server: embedded map (compiled) or disk dir. */
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
  const dir = join(repoRoot, 'packages', 'homestead-app', 'dist');
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

function sidecarSource(): string {
  return join(repoRoot, 'packages', 'homestead-sidecar', 'src', 'server.ts');
}

/**
 * Write `bytes` to a content-addressed path under the cache dir and mark it
 * executable, returning the path. Re-uses an existing identical file.
 */
function extractExecutable(name: string, bytes: Uint8Array): string {
  const dir = join(cacheRoot(), 'bin');
  mkdirSync(dir, { recursive: true });
  const hash = Bun.hash(bytes).toString(16).slice(0, 16);
  const dst = join(dir, `${name}-${hash}`);
  if (!existsSync(dst)) {
    const tmp = `${dst}.tmp`;
    writeFileSync(tmp, bytes);
    chmodSync(tmp, 0o755);
    renameSync(tmp, dst);
  }
  return dst;
}

function isFile(p: string): boolean {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
}
