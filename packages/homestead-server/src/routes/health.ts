/**
 * Readiness check. Probes the database with `SELECT 1` rather than reporting a
 * static 200, so a process that is up but can't reach SQLite is reported
 * unhealthy (503) — the signal a load balancer or `systemd`/container health
 * probe actually needs. `ok` is kept alongside `status` for back-compat with
 * any probe that read the old `{ ok: true }` shape.
 */

import { Hono } from 'hono';
import type { Database } from '../engine/sqlite';
import { log } from '../log';

export function makeHealthRoute(db: Database): Hono {
  const app = new Hono();
  app.get('/', (c) => {
    try {
      db.query('SELECT 1').get();
      return c.json({ ok: true, status: 'ok' });
    } catch (err) {
      log.error('health check failed: database unreachable', { err });
      return c.json({ ok: false, status: 'error', error: 'database unreachable' }, 503);
    }
  });
  return app;
}
