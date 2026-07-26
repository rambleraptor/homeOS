import { describe, expect, test, vi } from 'vitest';
import { OperationRunner, withTimeout } from '../operation-runner';

/** A task whose resolution the test controls, tracking peak concurrency. */
function makeGatedTask(track: { active: number; peak: number }) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const task = async () => {
    track.active += 1;
    track.peak = Math.max(track.peak, track.active);
    await gate;
    track.active -= 1;
    return 'done';
  };
  return { task, release };
}

describe('OperationRunner', () => {
  test('runs tasks immediately while under the cap', async () => {
    const runner = new OperationRunner(2);
    const results = await Promise.all([
      runner.submit(async () => 'a'),
      runner.submit(async () => 'b'),
    ]);
    expect(results).toEqual(['a', 'b']);
    expect(runner.activeCount).toBe(0);
    expect(runner.queuedCount).toBe(0);
  });

  test('never exceeds the cap and queues the overflow', async () => {
    const runner = new OperationRunner(2);
    const track = { active: 0, peak: 0 };
    const gates = Array.from({ length: 5 }, () => makeGatedTask(track));

    const runs = gates.map((g) => runner.submit(g.task));

    // Two run immediately; the other three wait for a slot.
    await Promise.resolve();
    expect(runner.activeCount).toBe(2);
    expect(runner.queuedCount).toBe(3);

    // Drain them one at a time; concurrency must stay pinned at 2.
    for (const g of gates) {
      g.release();
      await Promise.resolve();
    }
    await Promise.all(runs);

    expect(track.peak).toBe(2);
    expect(runner.activeCount).toBe(0);
    expect(runner.queuedCount).toBe(0);
  });

  test('processes the queue in FIFO order', async () => {
    const runner = new OperationRunner(1);
    const order: number[] = [];
    const runs = [0, 1, 2, 3].map((i) =>
      runner.submit(async () => {
        order.push(i);
      }),
    );
    await Promise.all(runs);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  test('onQueued fires only for tasks that had to wait', async () => {
    const runner = new OperationRunner(1);
    const onQueued = vi.fn();
    const track = { active: 0, peak: 0 };
    const first = makeGatedTask(track);

    const p1 = runner.submit(first.task, { onQueued }); // runs now
    const p2 = runner.submit(async () => 'second', { onQueued }); // must wait

    await Promise.resolve();
    // Only the second submission was queued.
    expect(onQueued).toHaveBeenCalledTimes(1);

    first.release();
    await Promise.all([p1, p2]);
    expect(onQueued).toHaveBeenCalledTimes(1);
  });

  test('a rejecting task frees its slot and propagates the error', async () => {
    const runner = new OperationRunner(1);
    await expect(
      runner.submit(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    // Slot released despite the throw — the next task still runs.
    await expect(runner.submit(async () => 'ok')).resolves.toBe('ok');
    expect(runner.activeCount).toBe(0);
  });

  test('clamps a non-positive cap to a working value', async () => {
    const runner = new OperationRunner(0);
    await expect(runner.submit(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('withTimeout', () => {
  test('resolves with the value when the work beats the timeout', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000, 'too slow')).resolves.toBe(42);
  });

  test('rejects with the message when the work exceeds the timeout', async () => {
    const slow = new Promise((r) => setTimeout(r, 50));
    await expect(withTimeout(slow, 5, 'too slow')).rejects.toThrow('too slow');
  });

  test('a non-positive timeout disables the guard', async () => {
    await expect(withTimeout(Promise.resolve('v'), 0, 'x')).resolves.toBe('v');
  });
});
