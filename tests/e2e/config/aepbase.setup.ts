/**
 * aepbase Test Instance Setup
 *
 * Manages an isolated aepbase instance for e2e tests. Builds the binary
 * via aepbase/install.sh (idempotent), starts it on a dedicated port with
 * a fresh data directory, reads the bootstrap superuser credentials from
 * the data dir's credentials.json, and exposes them to the rest of the suite.
 */

import { spawn, ChildProcess, execSync, execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { get as httpGet } from 'http';

const TEST_PORT = 8092;

let aepbaseProcess: ChildProcess | null = null;

export interface AepbaseAdminCreds {
  email: string;
  password: string;
  id: string;
  token: string;
}

export function getProjectRoot(): string {
  return join(process.cwd(), '../..');
}

export function getAepbaseUrl(): string {
  return `http://127.0.0.1:${TEST_PORT}`;
}

function getTestDirs() {
  const e2eDir = process.cwd();
  return {
    e2eDir,
    dataDir: join(e2eDir, 'aep_test_data'),
    aepbaseDir: join(getProjectRoot(), 'aepbase'),
    binary: join(getProjectRoot(), 'aepbase/bin/aepbase'),
    credsFile: join(e2eDir, 'aep_test_data', 'admin-creds.json'),
  };
}

/** Build the aepbase binary if it doesn't exist yet. Idempotent. */
function ensureBinaryBuilt(): void {
  const { binary, aepbaseDir } = getTestDirs();
  if (existsSync(binary)) return;
  console.log('🔨 Building aepbase binary (one-time)...');
  execSync('./install.sh', { cwd: aepbaseDir, stdio: 'inherit' });
}

/** Resolve bun: prefer the default install location, fall back to PATH. */
function bunBin(): string {
  const installed = join(homedir(), '.bun', 'bin', 'bun');
  return existsSync(installed) ? installed : 'bun';
}

/**
 * Serialize the module-access map (collection→module + default visibility) the
 * same way the launcher does, so the e2e aepbase enforces module access exactly
 * like production. Computed in a bun subprocess (it handles the app/module
 * graph). Returns '' on failure, which leaves enforcement off.
 */
function computeModuleAccessEnv(): string {
  const script = join(getProjectRoot(), 'tests/e2e/config/compute-module-access.ts');
  try {
    return execFileSync(bunBin(), ['run', script], {
      cwd: getProjectRoot(),
    })
      .toString()
      .trim();
  } catch (err) {
    console.warn('⚠️  Failed to compute module-access map; e2e enforcement off:', err);
    return '';
  }
}

/**
 * Start aepbase on TEST_PORT with a fresh data directory. Once it's listening,
 * read the bootstrap superuser password from the data dir's credentials.json
 * (aepbase writes it before it starts serving) and resolve with admin creds.
 */
export async function startAepbase(): Promise<AepbaseAdminCreds> {
  const { dataDir, binary, credsFile } = getTestDirs();

  // Fresh data directory
  if (existsSync(dataDir)) {
    await rm(dataDir, { recursive: true, force: true });
  }
  await mkdir(dataDir, { recursive: true });

  ensureBinaryBuilt();

  // Enforce module access like production. Keep a short (not zero) access-cache
  // TTL: aepbase's sqlite allows a single open connection, so caching the
  // module_flags row lets a page-load burst share one read instead of each
  // gated request hammering the connection. 1s is brief enough that
  // flag-flipping specs (which poll) see changes quickly.
  const moduleAccessEnv = computeModuleAccessEnv();

  return new Promise((resolve, reject) => {
    aepbaseProcess = spawn(binary, [
      '-port', String(TEST_PORT),
      '-data-dir', dataDir,
      '-db', 'aepbase.db',
      '-cors-allowed-origins', '*',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Escape hatch for debugging: set E2E_DISABLE_MODULE_ACCESS=1 to run
        // the suite with backend enforcement off.
        AEPBASE_MODULE_ACCESS: process.env.E2E_DISABLE_MODULE_ACCESS
          ? ''
          : moduleAccessEnv,
        AEPBASE_ACCESS_CACHE_TTL_MS: '1000',
      },
    });

    let stdout = '';
    let ready = false;

    const onReady = async () => {
      if (ready) return;
      ready = true;
      try {
        // aepbase writes the bootstrap superuser to data/credentials.json
        // before it begins serving, so it's present by the time we see the
        // "listening on" log line.
        const raw = await readFile(join(dataDir, 'credentials.json'), 'utf8');
        const { password } = JSON.parse(raw) as { email: string; password: string };
        const creds = await loginAdmin(password);
        await writeFile(credsFile, JSON.stringify(creds, null, 2));
        resolve(creds);
      } catch (err) {
        reject(err);
      }
    };

    const handleOutput = (text: string) => {
      if (!ready && /listening on/i.test(text)) void onReady();
    };

    aepbaseProcess.stdout?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(`[aepbase] ${text}`);
      handleOutput(text);
    });

    aepbaseProcess.stderr?.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stderr.write(`[aepbase ERR] ${text}`);
      handleOutput(text);
    });

    aepbaseProcess.on('error', (err) => reject(err));
    aepbaseProcess.on('close', (code) => {
      if (!ready) {
        reject(new Error(`aepbase exited early with code ${code}\nOutput:\n${stdout}`));
      }
    });

    setTimeout(() => {
      if (!ready) {
        aepbaseProcess?.kill();
        reject(new Error('aepbase did not start within 15s'));
      }
    }, 15000);
  });
}

export function stopAepbase(): Promise<void> {
  return new Promise((resolve) => {
    if (!aepbaseProcess) {
      resolve();
      return;
    }
    aepbaseProcess.once('close', () => resolve());
    aepbaseProcess.kill();
    setTimeout(() => resolve(), 2000);
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
