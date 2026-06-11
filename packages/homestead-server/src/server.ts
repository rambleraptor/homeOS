/**
 * homestead-server — the whole backend in one Bun process.
 *
 * Two listeners, one process:
 *  - public (user-facing): /api/aep/* (custom-method gateway + engine),
 *    /api/chat, /api/notifications, /api/custom-methods, /oauth/*, then the
 *    SPA (Vite middleware in dev, static assets in prod).
 *  - internal (127.0.0.1 only): the engine at bare paths (/users,
 *    /gift-cards, /openapi.json) — a drop-in for the old standalone aepbase
 *    port used by server-side helpers, schema sync, e2e, and
 *    `homestead resources`.
 */

import { Hono } from 'hono';
import { join } from 'node:path';
import { DEFAULT_ACCESS_CACHE_TTL_MS, makeAccessCheck } from './engine/access';
import { Engine } from './engine/engine';
import { isServerPath, type ServerOptions } from './options';
import { diskSpaAssets, serveStatic } from './static';

export interface RunningServer {
  publicPort: number;
  internalPort: number;
  engine: Engine;
  stop: () => Promise<void>;
}

function accessCacheTtlMs(opts: ServerOptions): number {
  if (opts.accessCacheTtlMs !== undefined) return opts.accessCacheTtlMs;
  const raw = process.env.AEPBASE_ACCESS_CACHE_TTL_MS?.trim();
  if (raw) {
    const ms = parseInt(raw, 10);
    if (!Number.isNaN(ms) && ms >= 0) return ms;
  }
  return DEFAULT_ACCESS_CACHE_TTL_MS;
}

export async function startServer(opts: ServerOptions): Promise<RunningServer> {
  const internalBase = `http://127.0.0.1:${opts.internalPort}`;

  // homestead-core/server/aepbase reads AEPBASE_URL at import time, so it
  // must be set before any route module loads (they're imported lazily
  // below for exactly this reason).
  process.env.AEPBASE_URL = process.env.AEPBASE_URL || internalBase;

  // Importing the registry module initializes the app registry (side effect).
  const registry = await import('./app-registry');
  const { ensureSuperuser } = await import('./bootstrap');

  const engine = new Engine({
    dbPath: join(opts.dataDir, 'aepbase.db'),
    filesDir: join(opts.dataDir, 'files'),
    serverUrl: internalBase,
    oauth: registry.oauthConfig(),
  });

  // E2E_DISABLE_APP_ACCESS is the e2e suite's debugging escape hatch for
  // running with backend enforcement off.
  const accessMap = process.env.E2E_DISABLE_APP_ACCESS ? null : registry.appAccessMap();
  if (accessMap) {
    engine.setAccessCheck(makeAccessCheck(engine.db, accessMap, accessCacheTtlMs(opts)));
  }

  await ensureSuperuser(engine.db);

  // --- public app ---
  const { customMethodsResponse } = await import('./routes/custom-methods');
  const { makeAepGateway } = await import('./routes/aep-gateway');
  const { chatRoute } = await import('./routes/chat');
  const { notificationsRoute } = await import('./routes/notifications');

  const publicApp = new Hono();
  publicApp.get('/health', (c) => c.json({ ok: true }));
  publicApp.get('/api/custom-methods', () => customMethodsResponse());
  publicApp.route('/api/notifications', notificationsRoute);
  publicApp.route('/api/chat', chatRoute);
  publicApp.route('/api/aep', makeAepGateway(engine, internalBase));
  // OAuth redirects arrive on the public origin; the engine serves them.
  publicApp.all('/oauth/*', (c) => engine.fetch(c.req.raw));

  // --- internal loopback listener (the old aepbase port) ---
  // Bare engine paths plus the same /api/* routes as the public port, so
  // tools like `homestead resources` need only this one URL.
  const internal = Bun.serve({
    hostname: '127.0.0.1',
    port: opts.internalPort,
    idleTimeout: 0,
    fetch: (req) => {
      const path = new URL(req.url).pathname;
      if (path === '/api' || path.startsWith('/api/')) return publicApp.fetch(req);
      return engine.fetch(req);
    },
  });

  let stopPublic: () => Promise<void> | void;
  if (opts.dev) {
    const { startDevServer } = await import('./dev-vite');
    const dev = await startDevServer({ port: opts.publicPort, fetch: publicApp.fetch });
    stopPublic = dev.stop;
  } else {
    const spa = opts.spa ?? diskSpaAssets();
    const server = Bun.serve({
      port: opts.publicPort,
      idleTimeout: 0,
      fetch: (req) => {
        const path = new URL(req.url).pathname;
        if (isServerPath(path)) return publicApp.fetch(req);
        return serveStatic(spa, path);
      },
    });
    stopPublic = () => server.stop(true);
  }

  // Apply app-declared schema in the background; serving doesn't depend on
  // it (the sync is idempotent and best-effort).
  void (async () => {
    const { syncSchema } = await import('./schema-sync');
    await syncSchema(engine.db, internalBase);
  })();

  console.log(
    `[homestead-server] public :${opts.publicPort}${opts.dev ? ' (dev: vite middleware)' : ''}, internal 127.0.0.1:${opts.internalPort}`,
  );

  return {
    publicPort: opts.publicPort,
    internalPort: opts.internalPort,
    engine,
    stop: async () => {
      await stopPublic();
      internal.stop(true);
      engine.db.close();
    },
  };
}
