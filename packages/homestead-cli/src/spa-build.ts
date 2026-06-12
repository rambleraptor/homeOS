/**
 * Build-on-change SPA pipeline.
 *
 * The launcher never embeds the SPA: app code (and homestead.config.ts, which
 * the SPA bundles via the `@homestead/config` alias) lives in the operator's
 * project, so the SPA must be built there. Builds land in the cache dir keyed
 * by a content hash; an unchanged project boots without rebuilding, and a
 * config edit produces a new hash → new build → server child restart.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cacheRoot, findRuntime } from './runtime.ts';
import { spawnChild } from './proc.ts';

export interface SpaBuild {
  /** Directory holding the built SPA (index.html + assets). */
  dist: string;
  /** Content hash identifying this build; served at /api/app-version. */
  buildId: string;
}

function buildsDir(): string {
  return join(cacheRoot(), 'spa-builds');
}

/**
 * Hash everything that feeds the SPA build: the operator config (bundled into
 * the SPA), package.json + lockfiles (app package versions), and the git HEAD
 * (source edits in a workspace checkout arrive as commits via `homestead
 * update`). Uncommitted source edits don't change the hash — that's what
 * `--dev` is for.
 */
export function spaBuildId(projectRoot: string): string {
  const h = createHash('sha256');
  h.update(readFileSync(join(projectRoot, 'homestead.config.ts')));
  for (const name of ['package.json', 'package-lock.json', 'bun.lock']) {
    const file = join(projectRoot, name);
    if (existsSync(file)) h.update(readFileSync(file));
  }
  const head = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  h.update(head.status === 0 ? head.stdout : 'no-git');
  return h.digest('hex').slice(0, 16);
}

/**
 * The SPA shell package, resolved through the project's node_modules (a
 * workspace symlink in a repo checkout, a real package otherwise). Resolved
 * to its real path so the shell's vite.config.ts default config path
 * (../../homestead.config.ts) keeps working in the workspace layout.
 */
export function resolveShellRoot(projectRoot: string): string {
  const linked = join(projectRoot, 'node_modules', '@rambleraptor', 'homestead-app');
  if (!existsSync(join(linked, 'vite.config.ts'))) {
    throw new Error(
      `SPA shell not found at ${linked} — install dependencies (\`bun install\` / \`npm install\`) in ${projectRoot}`,
    );
  }
  return realpathSync(linked);
}

/**
 * Return the cached build for the project's current hash, building it first
 * if missing. Throws when the build fails (callers keep serving the previous
 * build in that case).
 */
export async function ensureSpaBuild(projectRoot: string): Promise<SpaBuild> {
  const buildId = spaBuildId(projectRoot);
  const dist = join(buildsDir(), buildId);
  if (existsSync(join(dist, 'index.html'))) {
    return { dist, buildId };
  }

  const shellRoot = resolveShellRoot(projectRoot);
  const viteBin = join(projectRoot, 'node_modules', '.bin', 'vite');
  if (!existsSync(viteBin)) {
    throw new Error(`vite not found at ${viteBin} — install dependencies (\`bun install\` / \`npm install\`) in ${projectRoot}`);
  }

  log(`building SPA (${buildId}) — this can take a minute`);
  const child = spawnChild({
    // The vite bin is plain JS, so the runtime executable runs it directly.
    cmd: [findRuntime(projectRoot).exe, viteBin, 'build', '--outDir', dist, '--emptyOutDir'],
    cwd: shellRoot,
    env: {
      HOMESTEAD_BUILD_ID: buildId,
      HOMESTEAD_CONFIG: join(projectRoot, 'homestead.config.ts'),
    },
    tag: '[spa-build]',
  });
  const code = await child.wait();
  if (code !== 0 || !existsSync(join(dist, 'index.html'))) {
    rmSync(dist, { recursive: true, force: true });
    throw new Error(`vite build failed (exit ${code})`);
  }
  return { dist, buildId };
}

/** Drop cached builds other than the ones in `keep` (the one being served). */
export function pruneSpaBuilds(keep: string[]): void {
  const dir = buildsDir();
  if (!existsSync(dir)) return;
  const keepSet = new Set(keep);
  for (const entry of readdirSync(dir)) {
    if (keepSet.has(entry)) continue;
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function log(msg: string): void {
  console.log(`[homestead] ${msg}`);
}
