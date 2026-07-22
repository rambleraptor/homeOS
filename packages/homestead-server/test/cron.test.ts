import { afterEach, describe, expect, test, vi } from 'vitest';
import { Database } from '../src/engine/sqlite';
import { createUserTables, getUserByToken } from '../src/engine/users';
import { createSuperuser } from '../src/bootstrap';
import { runCronHook, startCronScheduler } from '../src/cron';
import type { RegisteredCronHook } from '@rambleraptor/homestead-core/apps/registry';
import type { CronContext, CronHandler } from '@rambleraptor/homestead-core/apps/types';

async function freshDb(withSuperuser = true): Promise<Database> {
  const db = new Database(':memory:');
  createUserTables(db);
  if (withSuperuser) await createSuperuser(db, 'owner@example.com', 'pw');
  return db;
}

/** Build a hook around a handler, defaulting the boilerplate fields. */
function hook(
  id: string,
  handler: CronHandler,
  extra: Partial<RegisteredCronHook> = {},
): RegisteredCronHook {
  return {
    id,
    appId: 'test-app',
    intervalSeconds: 10,
    load: async () => ({ default: handler }),
    ...extra,
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Poll `predicate` until true or the deadline elapses. */
async function waitUntil(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: timed out');
    await sleep(5);
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runCronHook', () => {
  test('hands the handler a working admin token + context, then revokes it', async () => {
    const db = await freshDb();
    let seen: CronContext | undefined;
    let userDuringRun: string | undefined;

    await runCronHook(
      db,
      hook('digest', async (ctx) => {
        seen = ctx;
        userDuringRun = getUserByToken(db, ctx.token)?.email;
      }),
    );

    expect(seen?.id).toBe('digest');
    expect(seen?.appId).toBe('test-app');
    expect(seen?.firedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    // The token resolved to the superuser while the handler ran…
    expect(userDuringRun).toBe('owner@example.com');
    // …and was revoked once the handler settled.
    expect(getUserByToken(db, seen!.token)).toBeNull();

    db.close();
  });

  test('swallows a throwing handler and still revokes the token', async () => {
    const db = await freshDb();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let token: string | undefined;

    await expect(
      runCronHook(
        db,
        hook('flaky', async (ctx) => {
          token = ctx.token;
          throw new Error('boom');
        }),
      ),
    ).resolves.toBeUndefined();

    expect(err).toHaveBeenCalledWith('[cron] "flaky" failed', expect.any(Error));
    expect(getUserByToken(db, token!)).toBeNull();

    db.close();
  });

  test('logs and skips when no admin exists, without invoking the handler', async () => {
    const db = await freshDb(false);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    let called = false;

    await runCronHook(
      db,
      hook('orphan', async () => {
        called = true;
      }),
    );

    expect(called).toBe(false);
    expect(err).toHaveBeenCalledWith(
      '[cron] "orphan" no admin available; skipping',
      expect.any(Error),
    );

    db.close();
  });
});

describe('startCronScheduler', () => {
  test('runOnStart fires the handler once at boot', async () => {
    const db = await freshDb();
    let calls = 0;
    const scheduler = startCronScheduler(db, [
      // A long interval so only the runOnStart firing lands during the test.
      hook('boot', async () => void calls++, { runOnStart: true, intervalSeconds: 60 }),
    ]);

    await waitUntil(() => calls === 1);
    expect(calls).toBe(1);

    scheduler.stop();
    db.close();
  });

  test('fires repeatedly on the interval and stop() halts further firings', async () => {
    const db = await freshDb();
    let calls = 0;
    // 30ms interval keeps the test quick while staying comfortably above timer jitter.
    const scheduler = startCronScheduler(db, [hook('tick', async () => void calls++, { intervalSeconds: 0.03 })]);

    await waitUntil(() => calls >= 2);
    scheduler.stop();

    const afterStop = calls;
    await sleep(120);
    expect(calls).toBe(afterStop);

    db.close();
  });

  test('skips a tick while the previous run of the same hook is still in flight', async () => {
    const db = await freshDb();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let starts = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const scheduler = startCronScheduler(db, [
      hook(
        'slow',
        async () => {
          starts++;
          await gate;
        },
        { intervalSeconds: 0.03 },
      ),
    ]);

    // First tick starts the handler, which blocks on the gate; later ticks
    // arrive while it's still running and must be skipped.
    await waitUntil(() => warn.mock.calls.length > 0);
    expect(starts).toBe(1);
    expect(warn).toHaveBeenCalledWith('[cron] "slow" still running; skipping this tick');

    // Once the first run finishes, subsequent ticks fire again.
    release();
    await waitUntil(() => starts >= 2);

    scheduler.stop();
    db.close();
  });

  test('an empty hook list is a no-op that still returns a usable handle', async () => {
    const db = await freshDb();
    const scheduler = startCronScheduler(db, []);
    await sleep(20);
    expect(() => scheduler.stop()).not.toThrow();
    db.close();
  });
});
