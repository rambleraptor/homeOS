/**
 * SPA build pipeline for prod (`homestead start`).
 *
 * The launcher never embeds the SPA: app code (and homestead.config.ts, which
 * the SPA bundles via the `@homestead/config` alias) lives in the operator's
 * project, so the SPA must be built there. We run Vite's own watch-mode build
 * (`vite build --watch`) as a resident child: it tracks the real module graph —
 * homestead.config.ts, the auto-discovered `apps/` tree, and any workspace/npm
 * app packages they import — and rebuilds `dist` in place on any change. The
 * server serves that dist and derives the build id from its output (see
 * `SpaAssets.version()` in homestead-server), so there is no input hashing, no
 * git coupling, and no enumerated watch list to keep in sync with the bundler.
 */

import { createHash } from 'node:crypto';
import { existsSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { cacheRoot, findRuntime } from './runtime.ts';
import { Child } from './proc.ts';

/** A resident SPA builder watching the project and rebuilding `dist` in place. */
export interface SpaWatcher {
  /** Directory holding the built SPA (index.html + assets). */
  dist: string;
  /** Stop the watcher child. */
  stop(): Promise<void>;
}

/**
 * Stable per-project dist directory, keyed by the project's real path (not its
 * contents): one project always builds into the same place, so a restart
 * reuses the existing build while Vite refreshes it.
 */
export function spaDistDir(projectRoot: string): string {
  const key = createHash('sha256').update(realpathSync(projectRoot)).digest('hex').slice(0, 16);
  return join(cacheRoot(), 'spa-builds', key);
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
 * Start `vite build --watch` for the project and resolve once the first build
 * has produced index.html. The child stays resident and rebuilds `dist` in
 * place whenever anything in the module graph changes; a failed rebuild leaves
 * the previous build on disk (Vite keeps serving the last good output).
 *
 * Throws if the first build never produces index.html (the child exits, or the
 * timeout elapses) — callers surface that and abort `start`.
 */
export async function startSpaWatch(projectRoot: string): Promise<SpaWatcher> {
  const shellRoot = resolveShellRoot(projectRoot);
  const viteBin = join(projectRoot, 'node_modules', '.bin', 'vite');
  if (!existsSync(viteBin)) {
    throw new Error(
      `vite not found at ${viteBin} — install dependencies (\`bun install\` / \`npm install\`) in ${projectRoot}`,
    );
  }

  const dist = spaDistDir(projectRoot);
  // Clean slate for the first build. We deliberately omit `--emptyOutDir`: in
  // watch mode that would wipe `dist` at the start of every rebuild, opening a
  // window where the server 404s the SPA. Vite leaves the dir alone (it's
  // outside the project root), so old hashed assets linger until the next
  // start — a fresh boot clears them here.
  rmSync(dist, { recursive: true, force: true });

  log('starting SPA build (vite build --watch)');
  const child = new Child({
    // The vite bin is plain JS, so the runtime executable runs it directly.
    cmd: [findRuntime(projectRoot).exe, viteBin, 'build', '--watch', '--outDir', dist],
    cwd: shellRoot,
    env: { HOMESTEAD_CONFIG: join(projectRoot, 'homestead.config.ts') },
    tag: '[spa]',
  });

  let childExited = false;
  void child.wait().then(() => (childExited = true));

  const indexPath = join(dist, 'index.html');
  const deadline = Date.now() + 180_000;
  while (!existsSync(indexPath)) {
    if (childExited) {
      throw new Error('vite build exited before producing the SPA — see [spa] logs above');
    }
    if (Date.now() > deadline) {
      await child.stop();
      throw new Error('SPA build timed out (no index.html after 180s)');
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  log('SPA build ready');
  return { dist, stop: () => child.stop() };
}

function log(msg: string): void {
  console.log(`[homestead] ${msg}`);
}
