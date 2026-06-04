import { spawnChild } from './proc.ts';
import { resolveSidecarDevCommand } from './embed.ts';

export interface SidecarOptions {
  dev: boolean;
  port: number;
  aepbaseUrl: string;
  adminEmail: string;
  adminPassword: string;
}

/**
 * A running sidecar — either a spawned `bun --watch` child (dev, for hot
 * reload) or the Hono app served in-process (prod). The two share this handle
 * so the supervisor treats them uniformly.
 */
export interface SidecarHandle {
  stop(): Promise<void> | void;
  /** Resolves if/when the sidecar exits on its own (child only). */
  wait(): Promise<number | void>;
}

/**
 * Launch the sidecar (omnibox / notifications / module workers + boot-time
 * schema sync). In dev it runs as a `bun --watch` child for hot reload; in
 * prod it runs in-process to avoid embedding a second bun runtime.
 */
export async function startSidecar(opts: SidecarOptions): Promise<SidecarHandle> {
  const env = {
    AEPBASE_URL: opts.aepbaseUrl,
    AEPBASE_ADMIN_EMAIL: opts.adminEmail,
    AEPBASE_ADMIN_PASSWORD: opts.adminPassword,
  };

  if (opts.dev) {
    const { cmd, cwd } = resolveSidecarDevCommand();
    const child = spawnChild({
      cmd,
      cwd,
      env: { PORT: String(opts.port), ...env },
      tag: '[sidecar]',
    });
    return { stop: () => child.stop(), wait: () => child.wait() };
  }

  // Prod: serve the sidecar's Hono app in this process. Its server-side aepbase
  // client reads AEPBASE_URL at import time, so set env before importing.
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const { serveSidecar } = await import('./sidecar-inproc.js');
  const server = serveSidecar(opts.port);
  return {
    stop: () => server.stop(),
    // In-process: it never exits on its own — it dies with this process.
    wait: () => new Promise<void>(() => {}),
  };
}
