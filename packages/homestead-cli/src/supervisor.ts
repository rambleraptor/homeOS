import { existsSync, mkdirSync, watch, type FSWatcher } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadProject } from './project.ts';
import { findRuntime, resolveServerModule, type JsRuntime } from './runtime.ts';
import { Child } from './proc.ts';
import { startSpaWatch, type SpaWatcher } from './spa-build.ts';

export interface StartOptions {
  dev: boolean;
  frontendPort: number;
  /** Overrides <project>/data when set. */
  dataDir?: string;
}

/**
 * Project-root files whose changes need the *server* re-read (OAuth + app-access
 * from homestead.config.ts, schema sync + app discovery from the apps/ tree).
 * The SPA itself is rebuilt by Vite's own watcher, not by this list.
 */
const SERVER_RESTART_FILE = 'homestead.config.ts';

/**
 * Bring the server up and block until a signal (or the server exiting).
 *
 * The server always runs as a runtime child (bun, or node + tsx) resolved
 * from the project's node_modules — the compiled launcher can't import the
 * operator's config (no node_modules resolution at runtime in compiled
 * binaries), so the project's own runtime evaluates it.
 *
 * Dev: a watch-mode child with Vite middleware (HMR) — server and SPA both
 * hot-reload. Prod: `vite build --watch` rebuilds the SPA in place over its
 * real module graph (config, the apps/ tree, app packages), the server serves
 * that dist and exposes its output hash at /api/app-version, and a small
 * watcher restarts the server when homestead.config.ts or the apps/ tree
 * change so OAuth/app-access/schema re-apply. Open tabs poll /api/app-version
 * and reload when the served build changes.
 */
export async function runStart(
  projectDir: string,
  opts: StartOptions,
): Promise<number> {
  const project = loadProject(projectDir);
  const dataDir = opts.dataDir ? resolve(opts.dataDir) : project.dataDir;
  mkdirSync(dataDir, { recursive: true });
  const runtime = findRuntime(project.root);
  const entry = await resolveEntryInstallingDeps(project.root, runtime);

  // Prod: stand up the resident SPA builder first and wait for its first build,
  // so the server has a dist to serve the moment it boots.
  let spa: SpaWatcher | null = null;
  if (!opts.dev) {
    spa = await startSpaWatch(project.root);
  }

  let child: Child;
  let restarting = false;
  let shuttingDown = false;
  let exitCode = 0;
  let finishResolve!: () => void;
  const finished = new Promise<void>((r) => (finishResolve = r));

  const finish = (code: number, msg: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    exitCode = code;
    log(msg);
    finishResolve();
  };

  const spawnServer = (): Child => {
    const cmd = opts.dev
      ? runtime.watch(entry, [...serverArgs(dataDir, opts), '--dev'])
      : runtime.run(entry, [...serverArgs(dataDir, opts), '--spa-dist', spa!.dist]);
    const c = new Child({
      cmd,
      cwd: project.root,
      env: {
        // The app registry resolves the operator's config from this (a
        // relative import only works in the source monorepo, not once the
        // server is installed under node_modules/@rambleraptor/...). Mirrors
        // what spa-build.ts passes to the SPA build.
        HOMESTEAD_CONFIG: join(project.root, 'homestead.config.ts'),
        // Explicit, even though the server's default is <cwd>/apps — the dir
        // may not exist yet, and discovery handles that.
        HOMESTEAD_APPS_DIR: join(project.root, 'apps'),
      },
      tag: '[server]',
    });
    void c.wait().then((code) => {
      // Deliberate restarts swap `child` before the old process exits; only
      // an unexpected death of the current child brings the launcher down.
      // In prod that exit is non-zero so systemd restarts the unit; in dev a
      // dead watch-child just ends the session cleanly.
      if (!shuttingDown && !restarting && c === child) {
        finish(
          opts.dev ? 0 : code === 0 ? 1 : code,
          `server exited${opts.dev ? '' : ' unexpectedly'} (${code})`,
        );
      }
    });
    return c;
  };
  child = spawnServer();

  // Prod only: restart the server when the operator edits homestead.config.ts
  // or the apps/ tree, so OAuth/app-access/schema re-apply. The SPA reload is
  // handled separately — Vite's watcher rebuilds the dist and the server's
  // /api/app-version exposes the new output hash, so tabs reload on their own.
  let restartBusy = false;
  let restartPending = false;
  const restartServer = async (): Promise<void> => {
    if (shuttingDown) return;
    if (restartBusy) {
      restartPending = true;
      return;
    }
    restartBusy = true;
    try {
      log('project config changed — restarting server');
      restarting = true;
      await child.stop();
      child = spawnServer();
      restarting = false;
    } finally {
      restartBusy = false;
      if (restartPending && !shuttingDown) {
        restartPending = false;
        void restartServer();
      }
    }
  };

  // Watch the directory, not the file: editors replace files atomically,
  // which silently detaches a direct file watch.
  let watcher: FSWatcher | null = null;
  let appsWatcher: FSWatcher | null = null;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const scheduleRestart = (): void => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void restartServer(), 500);
  };
  // Auto-discovered apps live under <project>/apps; a change there can alter
  // schema or discovery, so restart the server. Re-armed from the root watcher
  // when the dir is created or replaced after boot.
  const closeAppsWatcher = (): void => {
    appsWatcher?.close();
    appsWatcher = null;
  };
  const armAppsWatcher = (): void => {
    const appsDir = join(project.root, 'apps');
    if (!existsSync(appsDir)) {
      closeAppsWatcher();
      return;
    }
    if (appsWatcher) return;
    appsWatcher = watch(appsDir, { recursive: true }, () => scheduleRestart());
    appsWatcher.on('error', closeAppsWatcher);
  };
  if (!opts.dev) {
    watcher = watch(project.root, (_event, filename) => {
      if (filename === 'apps') {
        armAppsWatcher();
        scheduleRestart();
        return;
      }
      if (filename === SERVER_RESTART_FILE) scheduleRestart();
    });
    armAppsWatcher();
  }

  process.once('SIGINT', () => finish(0, 'received SIGINT, shutting down'));
  process.once('SIGTERM', () => finish(0, 'received SIGTERM, shutting down'));

  if (await waitForPort(opts.frontendPort, 60_000)) {
    log('ready');
    log(`  app       http://localhost:${opts.frontendPort}`);
    log(`  engine    http://localhost:${opts.frontendPort}/api/v1/aep`);
    log('  login     first visit asks you to create the admin account');
    log('            (recover later with `homestead admin reset-password`)');
  } else {
    log(`server never became reachable on :${opts.frontendPort}`);
  }

  await finished;
  watcher?.close();
  closeAppsWatcher();
  if (debounce) clearTimeout(debounce);
  await Promise.all([child.stop(), spa?.stop()]);
  return exitCode;
}

/**
 * Resolve the server entry, installing the project's dependencies first when
 * node_modules is missing (fresh `homestead init` projects) — `start` should
 * just work without a separate install step.
 */
async function resolveEntryInstallingDeps(
  projectRoot: string,
  runtime: JsRuntime,
): Promise<string> {
  try {
    return resolveServerModule(projectRoot, 'index.ts');
  } catch (err) {
    if (!existsSync(join(projectRoot, 'package.json'))) throw err;
    const installCmd = runtime.install();
    log(`dependencies not installed — running ${installCmd.join(' ')}`);
    const install = new Child({
      cmd: installCmd,
      cwd: projectRoot,
      tag: '[install]',
    });
    if ((await install.wait()) !== 0) {
      throw new Error('dependency install failed — fix the errors above and retry');
    }
    return resolveServerModule(projectRoot, 'index.ts');
  }
}

function serverArgs(dataDir: string, opts: StartOptions): string[] {
  return ['--port', String(opts.frontendPort), '--data-dir', dataDir];
}

async function waitForPort(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1000),
      });
      return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

function log(msg: string): void {
  console.log(`[homestead] ${msg}`);
}
