import { mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadProject } from './project.ts';
import { findBun, spaAssets } from './embed.ts';
import { repoRoot } from './paths.ts';
import { Child } from './proc.ts';

export interface StartOptions {
  dev: boolean;
  frontendPort: number;
  /** Internal loopback port for the engine API (the old aepbase port). */
  aepbasePort: number;
  /** Overrides <project>/data when set. */
  dataDir?: string;
}

/**
 * Bring the server up and block until a signal (or the dev child exiting).
 *
 * Prod: homestead-server runs in-process (one process total; systemd
 * `Restart=` covers crash recovery). Dev: it runs as a `bun --watch` child
 * so server-code edits hot-reload, mirroring the old dev sidecar.
 */
export async function runStart(
  projectDir: string,
  opts: StartOptions,
): Promise<void> {
  const project = loadProject(projectDir);
  const dataDir = opts.dataDir ? resolve(opts.dataDir) : project.dataDir;
  mkdirSync(dataDir, { recursive: true });

  if (opts.dev) {
    await runDev(dataDir, opts);
    return;
  }

  const { startServer } = await import('./server-inproc.js');
  const server = await startServer({
    dev: false,
    publicPort: opts.frontendPort,
    internalPort: opts.aepbasePort,
    dataDir,
    spa: spaAssets(),
  });

  banner(opts);
  await waitForSignal();
  await server.stop();
}

async function runDev(dataDir: string, opts: StartOptions): Promise<void> {
  const entry = join(repoRoot, 'packages', 'homestead-server', 'src', 'index.ts');
  if (!existsSync(entry)) {
    throw new Error(
      `homestead-server source not found at ${entry} (run --dev from the repo root)`,
    );
  }
  log(`starting homestead-server (watch) on :${opts.frontendPort}`);
  const child = new Child({
    cmd: [
      findBun(),
      '--watch',
      'run',
      entry,
      '--dev',
      '--port',
      String(opts.frontendPort),
      '--internal-port',
      String(opts.aepbasePort),
      '--data-dir',
      dataDir,
    ],
    cwd: repoRoot,
    tag: '[server]',
  });

  if (await waitForPort(opts.frontendPort, 60_000)) {
    banner(opts);
  } else {
    log(`server never became reachable on :${opts.frontendPort}`);
  }

  await new Promise<void>((resolveOnce) => {
    let done = false;
    const finish = (msg: string) => {
      if (done) return;
      done = true;
      log(msg);
      resolveOnce();
    };
    process.once('SIGINT', () => finish('received SIGINT, shutting down'));
    process.once('SIGTERM', () => finish('received SIGTERM, shutting down'));
    void child.wait().then((c) => finish(`server exited (${c})`));
  });

  await child.stop();
}

function banner(opts: StartOptions): void {
  log('ready');
  log(`  app       http://localhost:${opts.frontendPort}`);
  log(`  engine    http://127.0.0.1:${opts.aepbasePort} (loopback)`);
  log('  superuser printed on first boot; reset with `homestead admin reset-password`');
}

function waitForSignal(): Promise<void> {
  return new Promise<void>((resolveOnce) => {
    let done = false;
    const finish = (msg: string) => {
      if (done) return;
      done = true;
      log(msg);
      resolveOnce();
    };
    process.once('SIGINT', () => finish('received SIGINT, shutting down'));
    process.once('SIGTERM', () => finish('received SIGTERM, shutting down'));
  });
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
    await Bun.sleep(200);
  }
  return false;
}

function log(msg: string): void {
  console.log(`[homestead] ${msg}`);
}
