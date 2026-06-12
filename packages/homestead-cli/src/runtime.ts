// Host runtime helpers for the launcher. The compiled binary can't resolve
// bare imports from external files (no node_modules resolution at runtime),
// so everything that needs the operator's project — the server, the SPA
// build, config evaluation — runs as a runtime child inside the project dir.
//
// Two host runtimes are supported: bun (runs TypeScript natively) and node
// (runs TypeScript through the project's tsx). findRuntime() prefers
// whichever runtime the launcher itself is running under.
import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
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
    `homestead-server not found under ${projectRoot}/node_modules — run \`bun install\` (or \`npm install\`)`,
  );
}

/** Locate an executable on PATH (a portable Bun.which). */
export function which(bin: string): string | null {
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (!dir) continue;
    const p = join(dir, bin);
    try {
      if (!statSync(p).isFile()) continue;
      accessSync(p, constants.X_OK);
      return p;
    } catch {
      // keep scanning
    }
  }
  return null;
}

/** Resolve the bun executable (PATH, then the default install location). */
export function findBun(): string {
  const bun = tryFindBun();
  if (bun) return bun;
  throw new Error('bun not found on PATH or ~/.bun/bin (install from https://bun.sh)');
}

function tryFindBun(): string | null {
  const onPath = which('bun');
  if (onPath) return onPath;
  const fallback = join(homedir(), '.bun', 'bin', 'bun');
  return existsSync(fallback) ? fallback : null;
}

/**
 * A host runtime capable of running the project's TypeScript entrypoints
 * (the server, the db tools) and its plain-JS bins (vite).
 */
export interface JsRuntime {
  kind: 'bun' | 'node';
  /** Executable for plain-JS entrypoints, e.g. node_modules/.bin/vite. */
  exe: string;
  /** Human-readable description for doctor/logs. */
  label: string;
  /** argv to run a TypeScript entrypoint. */
  run(script: string, args?: string[]): string[];
  /** argv to run a TS entrypoint under a file watcher (dev mode). */
  watch(script: string, args?: string[]): string[];
  /** argv to install the project's dependencies. */
  install(): string[];
}

function bunRuntime(): JsRuntime | null {
  const bun = tryFindBun();
  if (!bun) return null;
  return {
    kind: 'bun',
    exe: bun,
    label: `bun (${bun})`,
    run: (script, args = []) => [bun, 'run', script, ...args],
    watch: (script, args = []) => [bun, '--watch', 'run', script, ...args],
    install: () => [bun, 'install'],
  };
}

/** The project's tsx bin (workspace symlink or real package), if installed. */
function resolveTsx(projectRoot: string): string | null {
  for (const root of [projectRoot, repoRoot]) {
    const bin = join(root, 'node_modules', '.bin', 'tsx');
    if (existsSync(bin)) return bin;
  }
  return null;
}

function nodeRuntime(projectRoot: string): JsRuntime | null {
  const node = process.versions.bun ? which('node') : process.execPath;
  if (!node) return null;
  const tsx = resolveTsx(projectRoot);
  if (!tsx) return null;
  return {
    kind: 'node',
    exe: node,
    label: `node (${node}) + tsx`,
    run: (script, args = []) => [node, tsx, script, ...args],
    watch: (script, args = []) => [node, tsx, 'watch', script, ...args],
    install: () => {
      const npm = which('npm');
      if (!npm) throw new Error('npm not found on PATH — install dependencies manually');
      return [npm, 'install'];
    },
  };
}

/**
 * Pick the runtime for project children, preferring the one the launcher
 * itself runs under (a compiled binary counts as bun). Falls back to the
 * other runtime so e.g. the compiled launcher still works on a bun-less
 * host that has node + the project's tsx.
 */
export function findRuntime(projectRoot: string): JsRuntime {
  const bun = bunRuntime();
  const node = nodeRuntime(projectRoot);
  const picked = process.versions.bun ? (bun ?? node) : (node ?? bun);
  if (picked) return picked;
  throw new Error(
    'no usable runtime: install bun (https://bun.sh), or run under node with the ' +
      "project's dependencies installed (tsx ships with homestead-server)",
  );
}

/** Base cache dir (~/.homestead/cache), overridable via HOMESTEAD_CACHE_DIR. */
export function cacheRoot(): string {
  return process.env.HOMESTEAD_CACHE_DIR || join(homedir(), '.homestead', 'cache');
}
