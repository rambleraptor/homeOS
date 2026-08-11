/**
 * First-visit setup: GET reports whether the instance still needs its admin
 * account; POST claims it (one-shot) by setting the pending superuser's email
 * and password. The SPA's login page renders a "create your admin account"
 * form while needsSetup is true.
 */

import { Hono } from 'hono';
import type { Database } from '../engine/sqlite';
import { AlreadyClaimedError, claimSetup, needsSetup } from '../bootstrap';

const MIN_PASSWORD_LENGTH = 8;
const MAX_DISPLAY_NAME_LENGTH = 100;

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
      display_name?: string;
    } | null;
    const email = body?.email?.trim();
    const password = body?.password;
    const displayName = body?.display_name?.trim();
    if (!email || !email.includes('@')) {
      return c.json({ error: 'a valid email is required' }, 400);
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return c.json(
        { error: `password must be at least ${MIN_PASSWORD_LENGTH} characters` },
        400,
      );
    }
    if (displayName && displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      return c.json(
        {
          error: `display name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`,
        },
        400,
      );
    }
    // The needsSetup check above is a fast path, not the guard: two requests can
    // both pass it. claimSetup's atomic compare-and-set picks the single winner;
    // a loser (or any already-claimed instance) surfaces here as a 409.
    try {
      await claimSetup(db, email, password, displayName);
    } catch (err) {
      if (err instanceof AlreadyClaimedError) {
        return c.json({ error: 'instance is already set up' }, 409);
      }
      throw err;
    }
    return c.json({ ok: true });
  });

  return app;
}
