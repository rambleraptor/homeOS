/**
 * Cron scheduler — runs the periodic hooks apps declare via `AppConfig.crons`.
 *
 * On boot, `startServer` hands the aggregated hook list (from the app
 * registry's `getAllCronHooks`) to {@link startCronScheduler}, which sets up
 * one interval timer per hook. Each firing mints a short-lived admin bearer
 * token in the server's own db — the same mechanism the boot-time schema sync
 * uses — invokes the lazily-imported handler with it, and revokes the token
 * when the handler settles.
 *
 * A hook that is still running when its next tick arrives is skipped for that
 * tick (no overlapping runs), and a handler that throws is logged and
 * swallowed so a single bad run can't take the process down.
 *
 * Timers are `unref`'d: cron work should never keep the process alive on its
 * own — the HTTP listener does that — so shutdown and short-lived tools/tests
 * aren't blocked by a pending interval.
 */

import type { Database } from './engine/sqlite';
import { nowRFC3339 } from './engine/ids';
import { mintAdminToken } from './bootstrap';
import type { RegisteredCronHook } from '@rambleraptor/homestead-core/apps/registry';

export interface CronScheduler {
  /** Stop all timers. Idempotent. In-flight handlers are left to finish. */
  stop: () => void;
}

/**
 * Run a single hook once, end to end: mint a short-lived admin token, invoke
 * the lazily-imported handler with it, and revoke the token when the handler
 * settles. Never rejects — a missing admin or a throwing handler is logged and
 * swallowed so the scheduler's timer callback stays clean. Exposed (rather than
 * inlined) so the per-firing contract can be unit-tested without timers.
 */
export async function runCronHook(
  db: Database,
  hook: RegisteredCronHook,
): Promise<void> {
  let admin: ReturnType<typeof mintAdminToken>;
  try {
    admin = mintAdminToken(db);
  } catch (error) {
    console.error(`[cron] "${hook.id}" no admin available; skipping`, error);
    return;
  }

  try {
    const mod = await hook.load();
    await mod.default({
      id: hook.id,
      appId: hook.appId,
      token: admin.token,
      firedAt: nowRFC3339(),
    });
  } catch (error) {
    console.error(`[cron] "${hook.id}" failed`, error);
  } finally {
    admin.revoke();
  }
}

/**
 * Start the interval timers for the given hooks. Returns a handle whose
 * `stop()` clears them (called from the server's `stop()`). Passing an empty
 * list is a no-op that still returns a valid handle.
 */
export function startCronScheduler(
  db: Database,
  hooks: RegisteredCronHook[],
): CronScheduler {
  const timers: ReturnType<typeof setInterval>[] = [];
  const running = new Set<string>();

  const tick = async (hook: RegisteredCronHook): Promise<void> => {
    if (running.has(hook.id)) {
      console.warn(`[cron] "${hook.id}" still running; skipping this tick`);
      return;
    }
    running.add(hook.id);
    try {
      await runCronHook(db, hook);
    } finally {
      running.delete(hook.id);
    }
  };

  for (const hook of hooks) {
    if (hook.runOnStart) void tick(hook);
    const timer = setInterval(() => void tick(hook), hook.intervalSeconds * 1000);
    // Never let a cron timer alone keep the process alive.
    if (typeof timer.unref === 'function') timer.unref();
    timers.push(timer);
  }

  if (hooks.length > 0) {
    console.log(`[cron] scheduled ${hooks.length} hook(s): ${hooks.map((h) => h.id).join(', ')}`);
  }

  return {
    stop: () => {
      for (const timer of timers) clearInterval(timer);
      timers.length = 0;
    },
  };
}
