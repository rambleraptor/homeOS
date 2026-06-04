/**
 * The sidecar's Hono app — the three API routes the SPA can't serve itself
 * (they need a JS runtime + the module worker contract):
 *   POST /api/omnibox/parse
 *   POST /api/notifications/send-test
 *   ALL  /api/modules/:moduleId/*   (module workers)
 *
 * Split out from server.ts so it can be served either as a standalone process
 * (dev, via server.ts) or in-process inside the homestead launcher (prod).
 */

import { Hono } from 'hono';
// Side effect: initialize the module registry before any request lands.
import './module-registry';
import { omniboxRoute } from './routes/omnibox';
import { notificationsRoute } from './routes/notifications';
import { modulesRoute } from './routes/modules';

export const app = new Hono();

app.get('/health', (c) => c.json({ ok: true }));
app.route('/api/omnibox', omniboxRoute);
app.route('/api/notifications', notificationsRoute);
app.route('/api/modules', modulesRoute);
