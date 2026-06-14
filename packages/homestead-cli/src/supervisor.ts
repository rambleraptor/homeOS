import { existsSync, mkdirSync, watch, type FSWatcher } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadProject } from './project.ts';
import { findRuntime, resolveServerModule, type JsRuntime } from './runtime.ts';
import { Child } from './proc.ts';
import { ensureSpaBuild, pruneSpaBuilds, type SpaBuild } from './spa-build.ts';

export interface StartOptions {
  dev: boolean;
  frontendPort: number;
  /** Overrides <project>/data when set. */
  dataDir?: string;
}

/** Files in the project root that trigger a rebuild + server restart. */
const WATCHED_FILES = new Set([
  'homestead.config.ts',
  'package.json',
  'package-lock.json',
  'bun.lock',
]);

/**
 * Bring the server up and block until a signal (or the server exiting).
 *
 * The server always runs as a runtime child (bun, or node + tsx) resolved
 * from the project's node_modules — the compiled launcher can't import the
 * operator's config (no node_modules resolution at runtime in compiled
 * binaries), so the project's own runtime evaluates it.
 *
 * Dev: a watch-mode child with Vite middleware (HMR) — server and SPA both
 * hot-reload. Prod: the launcher builds the SPA (content-hash cached), serves
 * it via the child, and watches homestead.config.ts / package-lock.json and
 * the apps/ tree (auto-discovered apps) to rebuild + restart on change. Open
 * tabs poll /api/app-version and reload.
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

  let build: SpaBuild | null = null;
  if (!opts.dev) {
    build = await ensureSpaBuild(project.root);
    pruneSpaBuilds([build.buildId]);
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
      : runtime.run(entry, [
          ...serverArgs(dataDir, opts),
          '--spa-dist',
          build!.dist,
          '--build-id',
          build!.buildId,
        ]);
    const c = new Child({
      cmd,
      cwd: project.root,
      // Explicit, even though the server's default is <cwd>/apps — the dir
      // may not exist yet, and discovery handles that.
      env: { HOMESTEAD_APPS_DIR: join(project.root, 'apps') },
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

  // Prod only: rebuild + restart when the operator edits the config (or an
  // update pulls a new lockfile). A failed build keeps the current server
  // running. Dev needs none of this — the config is in Vite's module graph.
  let reloadBusy = false;
  let reloadPending = false;
  const reload = async (): Promise<void> => {
    if (shuttingDown) return;
    if (reloadBusy) {
      reloadPending = true;
      return;
    }
    reloadBusy = true;
    try {
      log('project config changed — rebuilding SPA');
      let next: SpaBuild;
      try {
        next = await ensureSpaBuild(project.root);
      } catch (err) {
        log(
          `SPA rebuild failed — keeping the current build: ${err instanceof Error ? err.message : err}`,
        );
        return;
      }
      if (next.buildId === build!.buildId) {
        log('no effective change — keeping the current build');
        return;
      }
      restarting = true;
      await child.stop();
      build = next;
      child = spawnServer();
      restarting = false;
      pruneSpaBuilds([build.buildId]);
      log(`restarted on SPA build ${build.buildId}`);
    } finally {
      reloadBusy = false;
      if (reloadPending && !shuttingDown) {
        reloadPending = false;
        void reload();
      }
    }
  };

  // Watch the directory, not the file: editors replace files atomically,
  // which silently detaches a direct file watch.
  let watcher: FSWatcher | null = null;
  let appsWatcher: FSWatcher | null = null;
  let debounce: ReturnType<typeof setTimeout> | null = null;
  const scheduleReload = (): void => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => void reload(), 500);
  };
  // Auto-discovered apps live under <project>/apps; any change there feeds
  // the build hash, so the whole tree triggers a reload (the buildId
  // no-change guard absorbs noise). Re-armed from the root watcher when the
  // dir is created or replaced after boot.
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
    appsWatcher = watch(appsDir, { recursive: true }, () => scheduleReload());
    appsWatcher.on('error', closeAppsWatcher);
  };
  if (!opts.dev) {
    watcher = watch(project.root, (_event, filename) => {
      if (filename === 'apps') {
        armAppsWatcher();
        scheduleReload();
        return;
      }
      if (!filename || !WATCHED_FILES.has(filename)) return;
      scheduleReload();
    });
    armAppsWatcher();
  }

  process.once('SIGINT', () => finish(0, 'received SIGINT, shutting down'));
  process.once('SIGTERM', () => finish(0, 'received SIGTERM, shutting down'));

  if (await waitForPort(opts.frontendPort, 60_000)) {
    log('ready');
    log(`  app       http://localhost:${opts.frontendPort}`);
    log(`  engine    http://localhost:${opts.frontendPort}/api/aep`);
    log('  login     first visit asks you to create the admin account');
    log('            (recover later with `homestead admin reset-password`)');
  } else {
    log(`server never became reachable on :${opts.frontendPort}`);
  }

  await finished;
  watcher?.close();
  closeAppsWatcher();
  if (debounce) clearTimeout(debounce);
  await child.stop();
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
