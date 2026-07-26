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
 * Every firing runs inside an AEP-151 operation (via the injected
 * {@link OperationStore}): the scheduler creates one before the handler runs
 * and completes it afterwards, so each run leaves a persisted record — status,
 * timing, and the handler's result or error — in the `operations` collection.
 * That's the built-in logging cron jobs get for free. Creating the operation is
 * best-effort: if it fails (e.g. the schema isn't synced yet at boot), the
 * handler still runs so the work isn't skipped.
 *
 * A hook that is still running when its next tick arrives is skipped for that
 * tick (no overlapping runs of the same hook), and a handler that throws is
 * logged and swallowed so a single bad run can't take the process down.
 *
 * Each firing runs through the shared {@link operationRunner}, the same
 * process-wide concurrency pool every other operation uses, so cron work
 * competes for the same `HOMESTEAD_MAX_OPERATIONS` slots instead of being
 * treated separately.
 *
 * Timers are `unref`'d: cron work should never keep the process alive on its
 * own — the HTTP listener does that — so shutdown and short-lived tools/tests
 * aren't blocked by a pending interval.
 */

import type { Database } from './engine/sqlite';
import { nowRFC3339 } from './engine/ids';
import { mintAdminToken } from './bootstrap';
import type { RegisteredCronHook } from '@rambleraptor/homestead-core/apps/registry';
import {
  makeOperationLogger,
  type Operation,
  type OperationLogger,
  type OperationStore,
} from '@rambleraptor/homestead-core/resources/operations';
import {
  operationRunner,
  operationTimeoutMs,
  withTimeout,
} from '@rambleraptor/homestead-core/resources/operation-runner';

export interface CronScheduler {
  /** Stop all timers. Idempotent. In-flight handlers are left to finish. */
  stop: () => void;
}

/** The `method` recorded on the operation a cron firing spawns. */
export function cronOperationMethod(id: string): string {
  return `cron:${id}`;
}

/**
 * Run a single hook once, end to end: mint a short-lived admin token, open an
 * operation for the firing, run the lazily-imported handler through the shared
 * concurrency pool, and complete the operation (succeeded with the handler's
 * result, or failed with its error) before revoking the token. Never rejects —
 * a missing admin, a failed operation create, or a throwing handler is logged
 * and swallowed so the scheduler's timer callback stays clean. Exposed (rather
 * than inlined) so the per-firing contract can be unit-tested without timers.
 *
 * The firing is bracketed with a `started` log entry and a terminal
 * `succeeded` / `failed: …` entry, and the handler gets a `log` function to add
 * its own progress entries in between (see {@link OperationLogger}). All of that
 * lands in the operation's `metadata.logs`.
 */
export async function runCronHook(
  db: Database,
  hook: RegisteredCronHook,
  operations: OperationStore,
): Promise<void> {
  let admin: ReturnType<typeof mintAdminToken>;
  try {
    admin = mintAdminToken(db);
  } catch (error) {
    console.error(`[cron] "${hook.id}" no admin available; skipping`, error);
    return;
  }

  // Open the operation up front so the run is visible while it's queued. Best
  // effort: if it can't be created, still run the handler (the work matters
  // more than the record) with a no-op logger. Created `pending` — the run is
  // gated behind the shared runner and may wait for a slot; `start()` promotes
  // it to `running` once one frees.
  const firedAt = nowRFC3339();
  let operation: Operation | undefined;
  try {
    operation = await operations.create({
      token: admin.token,
      method: cronOperationMethod(hook.id),
      title: hook.title ?? hook.id,
      createdBy: admin.userId,
      status: 'pending',
    });
  } catch (error) {
    console.error(`[cron] "${hook.id}" could not open an operation; running without one`, error);
  }

  const logger: OperationLogger | undefined = operation
    ? makeOperationLogger(operations, { token: admin.token, id: operation.id })
    : undefined;
  // When there's no operation, hand the handler a no-op so it can call
  // ctx.log(...) unconditionally.
  const log = logger ? (m: string) => logger.log(m) : async () => {};

  try {
    // Run through the shared pool so cron firings compete for the same
    // `HOMESTEAD_MAX_OPERATIONS` slots as every other operation, rather than
    // firing alongside them. The token stays valid across any queue wait; it's
    // revoked in `finally` once the run settles.
    await operationRunner.submit(async () => {
      try {
        if (operation) await operations.start?.({ token: admin.token, id: operation.id });
        await log('started');
        const mod = await hook.load();
        const response = await withTimeout(
          Promise.resolve(
            mod.default({
              id: hook.id,
              appId: hook.appId,
              token: admin.token,
              firedAt,
              log,
            }),
          ),
          operationTimeoutMs(),
          `cron "${hook.id}" exceeded the operation time limit`,
        );
        // Record the terminal status before completing. Safe against the
        // complete() PATCH below: the logger only writes `metadata` while
        // complete() only writes done/status/response/error (disjoint keys).
        await log('succeeded');
        if (operation) {
          await operations.complete({
            token: admin.token,
            id: operation.id,
            response: response ?? {},
          });
        }
      } catch (error) {
        console.error(`[cron] "${hook.id}" failed`, error);
        await log(`failed: ${error instanceof Error ? error.message : String(error)}`);
        if (operation) {
          try {
            await operations.complete({ token: admin.token, id: operation.id, error });
          } catch (recordError) {
            console.error(`[cron] "${hook.id}" could not record failure`, recordError);
          }
        }
      }
    });
  } finally {
    admin.revoke();
  }
}

/**
 * Start the interval timers for the given hooks. Returns a handle whose
 * `stop()` clears them (called from the server's `stop()`). Passing an empty
 * list is a no-op that still returns a valid handle. The {@link OperationStore}
 * records each firing (see {@link runCronHook}).
 */
export function startCronScheduler(
  db: Database,
  hooks: RegisteredCronHook[],
  operations: OperationStore,
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
      await runCronHook(db, hook, operations);
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
