/**
 * Server-side operationStore. The engine loopback (the shared homestead-client)
 * is mocked, so these assert the token-lease bookkeeping that keeps a detached
 * operation's caller token alive across its lifetime — the fix for
 * email-ingested documents whose classify/index operations were stranded when
 * the cron revoked its short-lived admin token out from under them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFakeServerClient } from './fake-server-client';

const fake = createFakeServerClient();
vi.mock('../client', () => ({
  serverClient: () => fake.client,
}));

const { createFn, updateFn } = fake;

import { operationStore } from '../operations';
import { leaseToken, leaseCount } from '../token-lease';

beforeEach(() => {
  vi.clearAllMocks();
  createFn.mockResolvedValue({ id: 'op-1', done: false });
  updateFn.mockResolvedValue({});
});

describe('operationStore token leasing', () => {
  it('retains the caller token on create and releases it on complete', async () => {
    const revoke = vi.fn();
    leaseToken('cron-tok', revoke);
    expect(leaseCount('cron-tok')).toBe(1);

    await operationStore.create({ token: 'cron-tok', method: 'documents/d1:classify' });
    // The operation now holds a reference, so an eager revoke can't delete it.
    expect(leaseCount('cron-tok')).toBe(2);

    await operationStore.complete({ token: 'cron-tok', id: 'op-1', response: {} });
    expect(leaseCount('cron-tok')).toBe(1);
  });

  it('releases the lease even when the terminal write fails', async () => {
    leaseToken('cron-tok-2', vi.fn());
    await operationStore.create({ token: 'cron-tok-2', method: 'm' });
    expect(leaseCount('cron-tok-2')).toBe(2);

    updateFn.mockRejectedValueOnce(new Error('network blip'));
    await expect(
      operationStore.complete({ token: 'cron-tok-2', id: 'op-1', error: new Error('boom') }),
    ).rejects.toThrow('network blip');

    // The operation is settled regardless of the write outcome, so its lease
    // must be released — otherwise the token would leak and never be revoked.
    expect(leaseCount('cron-tok-2')).toBe(1);
  });

  it('leaves an ordinary (unleased) user token untouched', async () => {
    await operationStore.create({ token: 'user-tok', method: 'm' });
    await operationStore.complete({ token: 'user-tok', id: 'op-1', response: {} });
    // Never registered → retain/release are no-ops, no behavior change.
    expect(leaseCount('user-tok')).toBe(0);
  });
});
