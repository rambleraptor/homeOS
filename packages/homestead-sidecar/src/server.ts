/**
 * Homestead sidecar.
 *
 * A small Hono server that owns the three API routes the SPA can't serve
 * itself (they need a JS runtime + the module worker contract):
 *   POST /api/omnibox/parse
 *   POST /api/notifications/send-test
 *   ALL  /api/modules/:moduleId/*   (module workers)
 *
 * Run with Bun (`bun run src/server.ts`). The Go edge server reverse-
 * proxies these paths to this process; aepbase is reached directly via
 * `AEPBASE_URL`.
 */

import { Hono } from 'hono';
// Side effect: initialize the module registry before any request lands.
import './module-registry';
import { omniboxRoute } from './routes/omnibox';
import { notificationsRoute } from './routes/notifications';
import { modulesRoute } from './routes/modules';

const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));
app.route('/api/omnibox', omniboxRoute);
app.route('/api/notifications', notificationsRoute);
app.route('/api/modules', modulesRoute);

const port = Number(process.env.PORT ?? 4000);
console.log(`[sidecar] listening on :${port}`);

export default { port, fetch: app.fetch };
