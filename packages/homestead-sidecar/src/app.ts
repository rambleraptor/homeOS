/**
 * The sidecar's Hono app — the API routes the SPA can't serve itself
 * (they need a JS runtime):
 *   POST /api/notifications/send-test
 *   ALL  /api/aep/...:verb          (AEP-136 resource custom methods)
 *
 * The `/api/aep` gateway owns the resource custom methods and proxies every
 * other aepbase call through to aepbase, so the edge/vite proxy can route all
 * colon-verb paths here without special-casing aepbase's own `:login` /
 * `:download`.
 *
 * Split out from server.ts so it can be served either as a standalone process
 * (dev, via server.ts) or in-process inside the homestead launcher (prod).
 */

import { Hono } from 'hono';
// Side effect: initialize the module registry before any request lands.
import './module-registry';
import { getAllResourceCustomMethods } from '@rambleraptor/homestead-core/modules/registry';
import { notificationsRoute } from './routes/notifications';
import { aepRoute } from './routes/aep';

export const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));

// Diagnostics: list the registered AEP-136 custom methods (plural, verb,
// target, http method) so the CLI / UIs can discover them — they don't appear
// in aepbase's OpenAPI since the sidecar owns them.
app.get('/api/custom-methods', (c) => {
  const methods = Object.entries(getAllResourceCustomMethods()).map(
    ([key, def]) => {
      const [plural, verb] = key.split(':', 2);
      return {
        plural,
        verb,
        target: def.target ?? 'collection',
        method: def.method ?? 'POST',
      };
    },
  );
  return c.json({ methods });
});

app.route('/api/notifications', notificationsRoute);
app.route('/api/aep', aepRoute);
