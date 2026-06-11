/**
 * homestead-server test instance setup.
 *
 * One Bun process serves everything the e2e suite needs: the SPA via Vite
 * middleware on :5173, and the engine API ("aepbase") on the loopback
 * :8092 listener. The schema sync runs in-process on boot.
 *
 * The bootstrap superuser's password is printed to stdout exactly once on
 * first boot (there is no credentials.json anymore); we capture it from the
 * child's output, log in, and persist the admin creds for the fixtures.
 */

import { spawn, ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, rm, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { get as httpGet } from 'http';

const ENGINE_PORT = 8092;
const APP_PORT = 5173;
const READY_TIMEOUT_MS = 120000;
const POLL_INTERVAL_MS = 500;

let serverProcess: ChildProcess | null = null;

export interface AepbaseAdminCreds {
  email: string;
  password: string;
  id: string;
  token: string;
}

export function getProjectRoot(): string {
  return join(process.cwd(), '../..');
}

/** The engine API base URL (the old standalone-aepbase port). */
export function getAepbaseUrl(): string {
  return `http://127.0.0.1:${ENGINE_PORT}`;
}

export function getAppUrl(): string {
  return `http://localhost:${APP_PORT}`;
}

function getTestDirs() {
  const e2eDir = process.cwd();
  return {
    e2eDir,
    dataDir: join(e2eDir, 'aep_test_data'),
    credsFile: join(e2eDir, 'aep_test_data', 'admin-creds.json'),
  };
}

/** Resolve bun: prefer the default install location, fall back to PATH. */
function bunBin(): string {
  const installed = join(homedir(), '.bun', 'bin', 'bun');
  return existsSync(installed) ? installed : 'bun';
}

/**
 * Start homestead-server with a fresh data directory and resolve with the
 * bootstrap superuser's credentials once the engine, the schema sync, and
 * the SPA are all ready.
 */
export async function startAepbase(): Promise<AepbaseAdminCreds> {
  const { dataDir, credsFile } = getTestDirs();

  // Fresh data directory
  if (existsSync(dataDir)) {
    await rm(dataDir, { recursive: true, force: true });
  }
  await mkdir(dataDir, { recursive: true });

  const entry = join(
    getProjectRoot(),
    'packages',
    'homestead-server',
    'src',
    'index.ts',
  );

  let stdout = '';
  serverProcess = spawn(
    bunBin(),
    [
      'run',
      entry,
      '--dev',
      '--port',
      String(APP_PORT),
      '--internal-port',
      String(ENGINE_PORT),
      '--data-dir',
      dataDir,
    ],
    {
      cwd: getProjectRoot(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Short (not zero) access-cache TTL: brief enough that flag-flipping
        // specs (which poll) see changes quickly, long enough that a
        // page-load burst shares one app_flags read.
        AEPBASE_ACCESS_CACHE_TTL_MS: '1000',
        // E2E_DISABLE_APP_ACCESS passes through to the server (escape hatch
        // for debugging with backend enforcement off).
      },
    },
  );

  serverProcess.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(`[server] ${text}`);
  });
  serverProcess.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stderr.write(`[server ERR] ${text}`);
  });

  const exitedEarly = new Promise<never>((_, reject) => {
    serverProcess?.once('close', (code) => {
      reject(new Error(`server exited early with code ${code}\nOutput:\n${stdout}`));
    });
  });

  // 1. Engine API up.
  await Promise.race([
    waitFor(checkHealth, READY_TIMEOUT_MS, 'engine API'),
    exitedEarly,
  ]);

  // 2. First boot prints the superuser password once; capture it and log in.
  const password = await Promise.race([
    waitForValue(
      () => /Password:\s+([0-9a-f]+)/.exec(stdout)?.[1] ?? null,
      READY_TIMEOUT_MS,
      'bootstrap superuser password',
    ),
    exitedEarly,
  ]);
  const creds = await loginAdmin(password);
  await writeFile(credsFile, JSON.stringify(creds, null, 2));

  // 3. The in-process schema sync runs asynchronously on boot; wait for a
  //    sentinel resource definition so tests don't race it.
  await Promise.race([
    waitFor(() => sentinelResourceExists(creds.token), READY_TIMEOUT_MS, 'schema sync'),
    exitedEarly,
  ]);

  // 4. SPA reachable.
  await Promise.race([
    waitFor(() => ping(getAppUrl()), READY_TIMEOUT_MS, 'SPA'),
    exitedEarly,
  ]);

  return creds;
}

export function stopAepbase(): Promise<void> {
  return new Promise((resolve) => {
    if (!serverProcess) {
      resolve();
      return;
    }
    serverProcess.once('close', () => resolve());
    serverProcess.kill();
    setTimeout(() => resolve(), 5000);
  });
}

async function loginAdmin(password: string): Promise<AepbaseAdminCreds> {
  const body = JSON.stringify({ email: 'admin@example.com', password });
  const res = await fetch(`${getAepbaseUrl()}/users/:login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (!res.ok) {
    throw new Error(`admin login failed: ${res.status} ${await res.text()}`);
  }
  const parsed = (await res.json()) as {
    token: string;
    user: { id: string };
  };
  return {
    email: 'admin@example.com',
    password,
    id: parsed.user.id,
    token: parsed.token,
  };
}

export async function readAdminCreds(): Promise<AepbaseAdminCreds> {
  const { credsFile } = getTestDirs();
  const fs = await import('fs/promises');
  return JSON.parse(await fs.readFile(credsFile, 'utf8'));
}

export async function checkHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    httpGet(`${getAepbaseUrl()}/openapi.json`, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => resolve(false));
  });
}

async function sentinelResourceExists(adminToken: string): Promise<boolean> {
  // `gift-card` is declared by gift-cards/resources.ts and applied by the
  // in-process schema sync. Its presence proves the sync ran.
  const res = await fetch(`${getAepbaseUrl()}/aep-resource-definitions/gift-card`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  }).catch(() => null);
  return res?.ok === true;
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

async function waitForValue(
  extract: () => string | null,
  timeoutMs: number,
  label: string,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = extract();
    if (value) return value;
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}
