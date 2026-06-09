/**
 * Spawn the Vite dev server for e2e. Vite serves the SPA and proxies
 * `/api/aep/*` to the test aepbase and `/api/{notifications,apps}/*`
 * to the test sidecar (targets seeded via AEPBASE_URL / SIDECAR_URL, read by
 * vite.config.ts). The schema is applied by the sidecar on boot, so this
 * setup only waits for Vite to start listening.
 */

import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { get as httpGet } from 'http';
import { getAepbaseUrl, getProjectRoot, type AepbaseAdminCreds } from './aepbase.setup';
import { getSidecarUrl } from './sidecar.setup';

const DEV_SERVER_PORT = 5173;
const DEV_SERVER_URL = `http://localhost:${DEV_SERVER_PORT}`;
const READY_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 500;

let devServerProcess: ChildProcess | null = null;

export function getDevServerUrl(): string {
  return DEV_SERVER_URL;
}

/**
 * Start the Vite dev server and resolve once it's listening. Schema is
 * already applied by the sidecar (see sidecar.setup.ts), so there's no
 * separate schema wait here.
 */
export async function startDevServer(_creds: AepbaseAdminCreds): Promise<void> {
  if (process.env.PLAYWRIGHT_REUSE_DEV_SERVER && (await ping(DEV_SERVER_URL))) {
    console.log(`✅ Reusing existing dev server at ${DEV_SERVER_URL}`);
    return;
  }

  const cwd = join(getProjectRoot(), 'packages', 'homestead-app');
  devServerProcess = spawn(
    'npm',
    ['run', 'dev', '--', '--port', String(DEV_SERVER_PORT), '--strictPort', '--host', '127.0.0.1'],
    {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        AEPBASE_URL: getAepbaseUrl(),
        SIDECAR_URL: getSidecarUrl(),
      },
    },
  );

  devServerProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[vite] ${chunk}`);
  });
  devServerProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[vite ERR] ${chunk}`);
  });

  const exitedEarly = new Promise<never>((_, reject) => {
    devServerProcess?.once('close', (code) => {
      reject(new Error(`dev server exited early with code ${code}`));
    });
  });

  await Promise.race([
    waitFor(() => ping(DEV_SERVER_URL), READY_TIMEOUT_MS, 'vite dev server'),
    exitedEarly,
  ]);
}

export function stopDevServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!devServerProcess) {
      resolve();
      return;
    }
    devServerProcess.once('close', () => resolve());
    devServerProcess.kill();
    setTimeout(() => resolve(), 5000);
  });
}

function ping(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpGet(url, (res) => {
      // Anything that responds with HTTP — including 3xx redirects — counts.
      resolve(res.statusCode !== undefined && res.statusCode < 500);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`);
}
