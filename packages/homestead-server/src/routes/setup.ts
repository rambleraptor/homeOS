/**
 * First-visit setup: GET reports whether the instance still needs its admin
 * account; POST claims it (one-shot) by setting the pending superuser's email
 * and password. The SPA's login page renders a "create your admin account"
 * form while needsSetup is true.
 */

import { Hono } from 'hono';
import type { Database } from 'bun:sqlite';
import { claimSetup, needsSetup } from '../bootstrap';

const MIN_PASSWORD_LENGTH = 8;

export function makeSetupRoute(db: Database): Hono {
  const app = new Hono();

  app.get('/', (c) => c.json({ needsSetup: needsSetup(db) }));

  app.post('/', async (c) => {
    if (!needsSetup(db)) {
      return c.json({ error: 'instance is already set up' }, 409);
    }
    const body = (await c.req.json().catch(() => null)) as {
      email?: string;
      password?: string;
    } | null;
    const email = body?.email?.trim();
    const password = body?.password;
    if (!email || !email.includes('@')) {
      return c.json({ error: 'a valid email is required' }, 400);
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return c.json(
        { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        400,
      );
    }
    await claimSetup(db, email, password);
    return c.json({ ok: true });
  });

  return app;
}
