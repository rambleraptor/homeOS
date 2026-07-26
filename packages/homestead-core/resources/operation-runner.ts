/**
 * Process-wide concurrency gate for background operations.
 *
 * Every AEP-151 operation runs as an in-process async task that makes several
 * loopback calls back into the same server (create the record, log progress,
 * complete it) on top of whatever work the handler itself does. Firing an
 * unbounded number of them at once lets a burst saturate the loopback
 * connection pool and the single SQLite connection: some operations get
 * created but their very first follow-up write (the `started` log) never lands,
 * so they sit `running` with no logs forever. Nothing queues — the overflow is
 * effectively lost.
 *
 * {@link OperationRunner} bounds how many run at once and makes the rest wait
 * their turn in a FIFO queue instead of stampeding. The shared
 * {@link operationRunner} singleton is the one every spawner (the custom-method
 * dispatcher, the file-index trigger) submits to, so the cap is truly global.
 *
 * Runtime-agnostic: depends only on standard timers + `process.env`, so it works
 * under Bun, Node, and the test harness alike.
 */

import type { OperationStore } from './operations';

/** Default max concurrent operations when `HOMESTEAD_MAX_OPERATIONS` is unset. */
export const DEFAULT_MAX_CONCURRENT_OPERATIONS = 4;

/** Default per-operation safety timeout when `HOMESTEAD_OPERATION_TIMEOUT_MS` is unset. */
export const DEFAULT_OPERATION_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * A bounded FIFO runner. At most `maxConcurrent` submitted tasks execute at
 * once; further submissions wait (in submission order) until a slot frees. It
 * is a plain counting semaphore — it neither creates nor mutates operation
 * records, so it stays trivially testable and reusable.
 */
export class OperationRunner {
  private readonly maxConcurrent: number;
  private active = 0;
  private readonly waiters: Array<() => void> = [];

  constructor(maxConcurrent: number) {
    // A non-positive/NaN cap would wedge the queue; clamp to at least 1.
    this.maxConcurrent = Number.isFinite(maxConcurrent) && maxConcurrent > 0
      ? Math.floor(maxConcurrent)
      : DEFAULT_MAX_CONCURRENT_OPERATIONS;
  }

  /** Tasks currently executing. */
  get activeCount(): number {
    return this.active;
  }

  /** Tasks waiting for a slot. */
  get queuedCount(): number {
    return this.waiters.length;
  }

  /**
   * Run `task` under the concurrency cap and resolve/reject with its result.
   * If every slot is busy the task waits its turn; `onQueued` (if given) fires
   * exactly once, only when the task actually had to wait — so callers can flag
   * a record as `pending` without a spurious note on the common uncontended
   * path.
   */
  async submit<T>(task: () => Promise<T>, opts?: { onQueued?: () => void }): Promise<T> {
    if (this.active >= this.maxConcurrent) {
      opts?.onQueued?.();
      // Wait for a slot to be *handed* to us on release (the releaser does not
      // decrement in that case), so `active` can never exceed the cap even
      // though a resolved waiter resumes on a later microtask.
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    } else {
      this.active += 1;
    }

    try {
      return await task();
    } finally {
      const next = this.waiters.shift();
      if (next) {
        // Transfer this slot straight to the next waiter — `active` unchanged.
        next();
      } else {
        this.active -= 1;
      }
    }
  }
}

/**
 * Race `promise` against a timeout. On timeout the returned promise rejects
 * with an {@link Error} carrying `message` (the underlying work keeps running —
 * JS can't cancel it — but the caller stops waiting and its slot frees). A
 * non-positive `ms` disables the timeout and just awaits `promise`.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    // Never let the safety timer keep the process alive on its own.
    if (typeof (timer as { unref?: () => void }).unref === 'function') {
      (timer as { unref: () => void }).unref();
    }
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Per-operation safety timeout (ms). Set `HOMESTEAD_OPERATION_TIMEOUT_MS=0` to
 * disable. Read per-call so it can be tuned without a restart in long-lived
 * hosts and overridden in tests.
 */
export function operationTimeoutMs(): number {
  const raw = process.env.HOMESTEAD_OPERATION_TIMEOUT_MS;
  if (raw !== undefined && raw.trim() === '0') return 0;
  return parsePositiveInt(raw, DEFAULT_OPERATION_TIMEOUT_MS);
}

/** Max concurrent operations, from `HOMESTEAD_MAX_OPERATIONS` (default 4). */
export function maxConcurrentOperations(): number {
  return parsePositiveInt(
    process.env.HOMESTEAD_MAX_OPERATIONS,
    DEFAULT_MAX_CONCURRENT_OPERATIONS,
  );
}

/**
 * The shared, process-wide operation runner. Every background-operation spawner
 * submits to this one instance, so `HOMESTEAD_MAX_OPERATIONS` caps the whole
 * process, not each spawner independently.
 */
export const operationRunner = new OperationRunner(maxConcurrentOperations());

export interface RunOperationJobOptions {
  /** The store the operation record lives in. */
  store: OperationStore;
  /** Bearer token the lifecycle writes (`start`/`complete`) are made with. */
  token: string;
  /**
   * The operation record's id. Omit only for a best-effort run whose record
   * couldn't be created — the `start`/`complete` writes are then skipped and
   * just `work` runs (still pooled).
   */
  operationId?: string;
  /**
   * Append a progress entry to the operation's log timeline. Pass the bound
   * `logger.log` (see {@link makeOperationLogger}); pass a no-op when there is
   * no record to log against.
   */
  log: (message: string) => Promise<void>;
  /** The actual work; its resolved value becomes the operation's `response`. */
  work: () => Promise<unknown>;
  /** Subject for the timeout error, e.g. the method name or `cron "<id>"`. */
  timeoutLabel: string;
  /**
   * Invoked with the thrown value before it's recorded on the operation, for
   * call-site context logging. The failure is always logged onto the operation
   * itself regardless.
   */
  onError?: (error: unknown) => void;
}

/**
 * Run `work` as a pooled AEP-151 operation: wait for a slot in the shared
 * {@link operationRunner}, promote the (pending) record to `running`, bracket
 * the run with `started` / terminal log entries, guard it with the
 * per-operation timeout, and record the response (success) or error (throw).
 *
 * This is the single home of the start → log → complete choreography: the
 * custom-method dispatcher, the cron scheduler, and the file-index trigger all
 * create their record, then funnel through here, so the lifecycle can't drift
 * between them. Never rejects — every failure is logged onto the operation (and
 * surfaced via `onError`) — so callers can `void` or `await` the returned
 * promise freely. It resolves once the operation has settled.
 */
export function runOperationJob({
  store,
  token,
  operationId,
  log,
  work,
  timeoutLabel,
  onError,
}: RunOperationJobOptions): Promise<void> {
  return operationRunner.submit(async () => {
    try {
      // Promote out of the queue now that a slot is ours.
      if (operationId) await store.start?.({ token, id: operationId });
      await log('started');
      const response = await withTimeout(
        Promise.resolve(work()),
        operationTimeoutMs(),
        `${timeoutLabel} exceeded the operation time limit`,
      );
      // Record the terminal status before completing. Safe against complete()'s
      // PATCH: the logger only writes `metadata`, complete() only writes
      // done/status/response/error (disjoint keys).
      await log('succeeded');
      // Default a void result to `{}` so the record always carries an object
      // response, independent of how a given store handles `undefined`.
      if (operationId) await store.complete({ token, id: operationId, response: response ?? {} });
    } catch (error) {
      onError?.(error);
      await log(`failed: ${error instanceof Error ? error.message : String(error)}`);
      if (operationId) {
        try {
          await store.complete({ token, id: operationId, error });
        } catch (recordError) {
          console.error(`Failed to record failure for operation ${operationId}:`, recordError);
        }
      }
    }
  });
}
