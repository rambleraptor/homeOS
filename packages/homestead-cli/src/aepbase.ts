import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnChild, type Child } from './proc.ts';
import { resolveAepbaseBinary } from './embed.ts';

export interface AepbaseOptions {
  port: number;
  /** Absolute data dir for the sqlite db, files, and credentials.json. */
  dataDir: string;
  /** Serialized AEPBASE_OAUTH value (from config.aepbaseOAuthEnv), if any. */
  oauthEnv?: string;
  /** Serialized AEPBASE_APP_ACCESS value (collection→app map), if any. */
  appAccessEnv?: string;
  /** Readiness timeout. */
  timeoutMs?: number;
}

export interface Credentials {
  email: string;
  password: string;
}

export interface AepbaseHandle {
  child: Child;
  credentials: Credentials;
}

/**
 * Spawn the aepbase child, wait until it's accepting connections, then read the
 * superuser credentials it wrote to data/credentials.json (used to seed the
 * sidecar's schema-sync). Throws if it exits before becoming ready.
 */
export async function startAepbase(
  opts: AepbaseOptions,
): Promise<AepbaseHandle> {
  const bin = await resolveAepbaseBinary();
  const child = spawnChild({
    cmd: [bin, '-port', String(opts.port), '-data-dir', opts.dataDir],
    env: {
      AEPBASE_OAUTH: opts.oauthEnv,
      AEPBASE_APP_ACCESS: opts.appAccessEnv,
    },
    tag: '[aepbase]',
  });

  await waitForReady(child, opts.port, opts.timeoutMs ?? 30_000);
  return { child, credentials: readCredentials(opts.dataDir) };
}

async function waitForReady(
  child: Child,
  port: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.proc.exitCode !== null) {
      throw new Error(
        `aepbase exited (code ${child.proc.exitCode}) before becoming ready`,
      );
    }
    try {
      // Any HTTP response (even 401) means the listener is up.
      await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1000),
      });
      return;
    } catch {
      // not listening yet
    }
    await Bun.sleep(150);
  }
  throw new Error(`aepbase did not become ready on :${port} within ${timeoutMs}ms`);
}

function readCredentials(dataDir: string): Credentials {
  const path = join(dataDir, 'credentials.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(`aepbase did not write ${path}: ${String(err)}`);
  }
  const parsed = JSON.parse(raw) as Partial<Credentials>;
  if (!parsed.email || !parsed.password) {
    throw new Error(`credentials file at ${path} is missing email or password`);
  }
  return { email: parsed.email, password: parsed.password };
}
