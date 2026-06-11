// Host runtime helpers for the launcher. The compiled binary can't resolve
// bare imports from external files (no node_modules resolution at runtime),
// so everything that needs the operator's project — the server, the SPA
// build, config evaluation — runs as a `bun` child inside the project dir.
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './paths.ts';

/**
 * Resolve a file inside the homestead-server package through the project's
 * node_modules (a workspace symlink in a repo checkout, a real package
 * otherwise), falling back to the repo layout for source runs before
 * `npm install`.
 */
export function resolveServerModule(projectRoot: string, ...relPath: string[]): string {
  const fromProject = join(
    projectRoot,
    'node_modules',
    '@rambleraptor',
    'homestead-server',
    'src',
    ...relPath,
  );
  if (existsSync(fromProject)) return fromProject;
  const fromRepo = join(repoRoot, 'packages', 'homestead-server', 'src', ...relPath);
  if (existsSync(fromRepo)) return fromRepo;
  throw new Error(
    `homestead-server not found under ${projectRoot}/node_modules — run \`bun install\``,
  );
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
