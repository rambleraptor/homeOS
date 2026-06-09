/**
 * Spawn the Bun sidecar for e2e. The sidecar owns the notifications /
 * app-worker API routes AND applies the aepbase schema
 * on boot (resource definitions, app flags, user settings) — replacing
 * the old Next instrumentation hook. We wait for both its health endpoint
 * and a sentinel resource definition so tests don't race the schema apply.
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { get as httpGet } from 'http';
import { getAepbaseUrl, getProjectRoot, type AepbaseAdminCreds } from './aepbase.setup';

const SIDECAR_PORT = 4002;
const READY_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 500;

let sidecarProcess: ChildProcess | null = null;

export function getSidecarUrl(): string {
  return `http://127.0.0.1:${SIDECAR_PORT}`;
}

/** Resolve bun: prefer the default install location, fall back to PATH. */
function bunBin(): string {
  const installed = join(homedir(), '.bun', 'bin', 'bun');
  return existsSync(installed) ? installed : 'bun';
}

/**
 * Start the sidecar against the test aepbase and resolve once it's healthy
 * and the schema has been applied.
 */
export async function startSidecar(creds: AepbaseAdminCreds): Promise<void> {
  const cwd = getProjectRoot();
  const entry = join(cwd, 'packages', 'homestead-sidecar', 'src', 'server.ts');

  sidecarProcess = spawn(bunBin(), ['run', entry], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(SIDECAR_PORT),
      AEPBASE_URL: getAepbaseUrl(),
      AEPBASE_ADMIN_EMAIL: creds.email,
      AEPBASE_ADMIN_PASSWORD: creds.password,
    },
  });

  sidecarProcess.stdout?.on('data', (chunk) => {
    process.stdout.write(`[sidecar] ${chunk}`);
  });
  sidecarProcess.stderr?.on('data', (chunk) => {
    process.stderr.write(`[sidecar ERR] ${chunk}`);
  });

  const exitedEarly = new Promise<never>((_, reject) => {
    sidecarProcess?.once('close', (code) => {
      reject(new Error(`sidecar exited early with code ${code}`));
    });
  });

  await Promise.race([
    waitFor(() => ping(`${getSidecarUrl()}/health`), READY_TIMEOUT_MS, 'sidecar'),
    exitedEarly,
  ]);

  // The sidecar pushes the schema asynchronously on boot. Poll aepbase
  // until a sentinel resource definition exists before letting tests run.
  await Promise.race([
    waitFor(
      () => sentinelResourceExists(creds.token),
      READY_TIMEOUT_MS,
      'schema sync',
    ),
    exitedEarly,
  ]);
}

export function stopSidecar(): Promise<void> {
  return new Promise((resolve) => {
    if (!sidecarProcess) {
      resolve();
      return;
    }
    sidecarProcess.once('close', () => resolve());
    sidecarProcess.kill();
    setTimeout(() => resolve(), 5000);
  });
}

function ping(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpGet(url, (res) => {
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

async function sentinelResourceExists(adminToken: string): Promise<boolean> {
  // `gift-card` is declared by gift-cards/resources.ts and applied by the
  // sidecar's schema sync. Its presence proves the sync ran.
  const res = await fetch(
    `${getAepbaseUrl()}/aep-resource-definitions/gift-card`,
    { headers: { Authorization: `Bearer ${adminToken}` } },
  ).catch(() => null);
  return res?.ok === true;
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
