/**
 * homestead-server — the whole backend in one process (Bun, or Node ≥ 22.13
 * via tsx; see listen.ts / engine/sqlite.ts for the runtime seams).
 *
 * One listener, one process. Everything is served on the public port:
 * /api/aep/* (the custom-method gateway + the engine, the *only* way to reach
 * aepbase), /api/chat, /api/notifications, /api/custom-methods, /oauth/*, then
 * the SPA (Vite middleware in dev, static assets in prod). Same-box callers
 * (schema sync, server-side helpers, the `homestead resources` CLI) reach the
 * engine over loopback at the same /api/aep prefix — there is no separate
 * engine port.
 */

import { Hono } from 'hono';
import { join } from 'node:path';
import { DEFAULT_ACCESS_CACHE_TTL_MS, makeAccessCheck } from './engine/access';
import { Engine } from './engine/engine';
import { listen } from './listen';
import { isServerPath, type ServerOptions } from './options';
import { diskSpaAssets, serveStatic } from './static';

export interface RunningServer {
  publicPort: number;
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
  // Loopback origin for same-box callers (schema sync, server-side helpers,
  // the `homestead resources` CLI). The engine is reachable only under the
  // /api/aep prefix on the public port — there is no separate engine port.
  const loopbackOrigin = `http://127.0.0.1:${opts.publicPort}`;
  const engineBase = `${loopbackOrigin}/api/aep`;

  // homestead-core/server/aepbase reads AEPBASE_URL at import time, so it
  // must be set before any route module loads (they're imported lazily
  // below for exactly this reason).
  process.env.AEPBASE_URL = process.env.AEPBASE_URL || engineBase;

  // Importing the registry module initializes the app registry (side effect).
  const registry = await import('./app-registry');
  const { ensureSuperuser } = await import('./bootstrap');

  const engine = new Engine({
    dbPath: join(opts.dataDir, 'aepbase.db'),
    filesDir: join(opts.dataDir, 'files'),
    serverUrl: engineBase,
    oauth: registry.oauthConfig(),
  });

  // E2E_DISABLE_APP_ACCESS is the e2e suite's debugging escape hatch for
  // running with backend enforcement off.
  const accessMap = process.env.E2E_DISABLE_APP_ACCESS ? null : registry.appAccessMap();
  if (accessMap) {
    engine.setAccessCheck(makeAccessCheck(engine.db, accessMap, accessCacheTtlMs(opts)));
  }

  const setupState = await ensureSuperuser(engine.db);

  // --- public app ---
  const { customMethodsResponse } = await import('./routes/custom-methods');
  const { makeAepGateway } = await import('./routes/aep-gateway');
  const { chatRoute } = await import('./routes/chat');
  const { notificationsRoute } = await import('./routes/notifications');
  const { makeSetupRoute } = await import('./routes/setup');

  const publicApp = new Hono();
  publicApp.get('/health', (c) => c.json({ ok: true }));
  // Open tabs poll this and reload when the served SPA build changes (the
  // launcher rebuilds + restarts the server on homestead.config.ts edits).
  publicApp.get('/api/app-version', (c) => c.json({ buildId: opts.buildId ?? '' }));
  publicApp.get('/api/custom-methods', () => customMethodsResponse());
  publicApp.route('/api/setup', makeSetupRoute(engine.db));
  publicApp.route('/api/notifications', notificationsRoute);
  publicApp.route('/api/chat', chatRoute);
  publicApp.route('/api/aep', makeAepGateway(engine, loopbackOrigin));
  // OAuth redirects arrive on the public origin; the engine serves them.
  publicApp.all('/oauth/*', (c) => engine.fetch(c.req.raw));

  let stopPublic: () => Promise<void> | void;
  if (opts.dev) {
    const { startDevServer } = await import('./dev-vite');
    const dev = await startDevServer({ port: opts.publicPort, fetch: publicApp.fetch });
    stopPublic = dev.stop;
  } else {
    const spa = opts.spa ?? diskSpaAssets();
    const server = await listen({
      port: opts.publicPort,
      fetch: (req) => {
        const path = new URL(req.url).pathname;
        if (isServerPath(path)) return publicApp.fetch(req);
        return serveStatic(spa, path);
      },
    });
    stopPublic = server.stop;
  }

  // Apply app-declared schema in the background; serving doesn't depend on
  // it (the sync is idempotent and best-effort).
  void (async () => {
    const { syncSchema } = await import('./schema-sync');
    await syncSchema(engine.db, engineBase);
  })();

  console.log(
    `[homestead-server] listening on :${opts.publicPort}${opts.dev ? ' (dev: vite middleware)' : ''}`,
  );
  if (setupState === 'pending') {
    console.log(
      `[homestead-server] no admin account yet — open http://localhost:${opts.publicPort} to create one`,
    );
  }

  return {
    publicPort: opts.publicPort,
    engine,
    stop: async () => {
      await stopPublic();
      engine.db.close();
    },
  };
}
