import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadProject } from './project.ts';
import { aepbaseOAuthEnv } from './config.ts';
import { moduleAccessEnv } from './module-access.js';
import { startAepbase } from './aepbase.ts';
import { startSidecar, type SidecarHandle } from './sidecar.ts';
import { startVite } from './vite.ts';
import { startEdge } from './edge.ts';
import { spaAssets } from './embed.ts';
import type { Child } from './proc.ts';

export interface StartOptions {
  dev: boolean;
  frontendPort: number;
  aepbasePort: number;
  sidecarPort: number;
  /** Overrides <project>/data when set. */
  dataDir?: string;
}

/**
 * Bring the full stack up and block until a signal (or a component exiting),
 * then shut everything down in order: frontend → sidecar → aepbase.
 */
export async function runStart(
  projectDir: string,
  opts: StartOptions,
): Promise<void> {
  const project = loadProject(projectDir);
  const dataDir = opts.dataDir ? resolve(opts.dataDir) : project.dataDir;
  mkdirSync(dataDir, { recursive: true });

  const aepbaseUrl = `http://127.0.0.1:${opts.aepbasePort}`;
  const sidecarUrl = `http://127.0.0.1:${opts.sidecarPort}`;

  // 1. aepbase
  log(`starting aepbase on :${opts.aepbasePort}`);
  const aep = await startAepbase({
    port: opts.aepbasePort,
    dataDir,
    oauthEnv: aepbaseOAuthEnv(),
    moduleAccessEnv: moduleAccessEnv(),
  });

  // 2. sidecar
  log(`starting sidecar on :${opts.sidecarPort}`);
  const sidecar = await startSidecar({
    dev: opts.dev,
    port: opts.sidecarPort,
    aepbaseUrl,
    adminEmail: aep.credentials.email,
    adminPassword: aep.credentials.password,
  });

  // 3. frontend — Vite (dev) or the embedded SPA via the edge (prod).
  let vite: Child | undefined;
  let edge: ReturnType<typeof Bun.serve> | undefined;
  if (opts.dev) {
    log(`starting vite on :${opts.frontendPort}`);
    vite = startVite({ port: opts.frontendPort, aepbaseUrl, sidecarUrl });
  } else {
    edge = startEdge({
      port: opts.frontendPort,
      aepbaseUrl,
      sidecarUrl,
      spa: spaAssets(),
    });
  }

  // 4. Readiness banner (best-effort).
  if (await waitForPort(opts.frontendPort, 30_000)) {
    log('ready');
    log(`  app       http://localhost:${opts.frontendPort}`);
    log(`  aepbase   ${aepbaseUrl}`);
    log(`  superuser ${aep.credentials.email} / ${aep.credentials.password}`);
  } else {
    log(`frontend never became reachable on :${opts.frontendPort}`);
  }

  // 5. Block until a signal or any component exits.
  await waitForShutdownTrigger({ aep: aep.child, sidecar, vite });

  // 6. Ordered shutdown: frontend first (drains in-flight), then sidecar,
  //    then aepbase last.
  if (edge) edge.stop();
  if (vite) await vite.stop();
  await sidecar.stop();
  await aep.child.stop();
}

function waitForShutdownTrigger(children: {
  aep: Child;
  sidecar: SidecarHandle;
  vite?: Child;
}): Promise<void> {
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
    void children.aep.wait().then((c) => finish(`aepbase exited (${c})`));
    void children.sidecar.wait().then((c) => finish(`sidecar exited (${c})`));
    if (children.vite) {
      void children.vite.wait().then((c) => finish(`vite exited (${c})`));
    }
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
