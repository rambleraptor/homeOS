/**
 * `groceries:demo-slow` async custom method (AEP-151).
 *
 * A minimal long-running method used to exercise the operations pipeline:
 * dispatched as `POST /api/aep/groceries:demo-slow`, it returns `202` with a
 * pending operation immediately, waits, then resolves — its return value
 * becomes the operation's `response`. Poll the returned operation path
 * (`GET /api/aep/operations/{id}`) until `done: true`.
 *
 * The wait is configurable via a `{ delay_ms }` body (clamped) so callers —
 * e.g. the e2e suite — can hold the operation in its running state long enough
 * to observe the spinner UI.
 */

import type { AsyncCustomMethodHandler } from '@rambleraptor/homestead-core/resources/types';

const DEFAULT_DELAY_MS = 3000;
const MAX_DELAY_MS = 30000;

const handler: AsyncCustomMethodHandler = async ({ request, auth }) => {
  const body = (await request.json().catch(() => ({}))) as { delay_ms?: unknown };
  const requested =
    typeof body.delay_ms === 'number' ? body.delay_ms : DEFAULT_DELAY_MS;
  const delayMs = Math.max(0, Math.min(requested, MAX_DELAY_MS));

  await new Promise((resolve) => setTimeout(resolve, delayMs));

  return {
    message: 'Demo operation complete',
    ran_by: auth.user.email,
    delay_ms: delayMs,
  };
};

export default handler;
