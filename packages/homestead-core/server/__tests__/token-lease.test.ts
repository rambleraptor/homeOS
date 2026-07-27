import { describe, it, expect, vi } from 'vitest';
import { leaseToken, retainToken, releaseToken, leaseCount } from '../token-lease';

describe('token-lease', () => {
  it('defers revocation until the minter releases its own reference', () => {
    const revoke = vi.fn();
    leaseToken('t1', revoke);
    expect(leaseCount('t1')).toBe(1);

    releaseToken('t1');
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(leaseCount('t1')).toBe(0);
  });

  it('keeps the token alive while an operation holds a reference', () => {
    const revoke = vi.fn();
    leaseToken('t2', revoke);

    // An operation created under the token retains it…
    retainToken('t2');
    expect(leaseCount('t2')).toBe(2);

    // …so the minter revoking eagerly does NOT delete it yet.
    releaseToken('t2'); // minter's own reference
    expect(revoke).not.toHaveBeenCalled();
    expect(leaseCount('t2')).toBe(1);

    // Only when the operation settles and releases does the token go.
    releaseToken('t2'); // operation's reference
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(leaseCount('t2')).toBe(0);
  });

  it('revokes exactly once regardless of reference ordering', () => {
    const revoke = vi.fn();
    leaseToken('t3', revoke);
    retainToken('t3');
    retainToken('t3');
    expect(leaseCount('t3')).toBe(3);

    releaseToken('t3');
    releaseToken('t3');
    expect(revoke).not.toHaveBeenCalled();
    releaseToken('t3');
    expect(revoke).toHaveBeenCalledTimes(1);

    // Extra releases after zero are harmless no-ops.
    releaseToken('t3');
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('treats retain/release on an unleased token as a no-op', () => {
    // Ordinary user tokens were never leased — the lifecycle must not touch them.
    expect(() => retainToken('user-token')).not.toThrow();
    expect(() => releaseToken('user-token')).not.toThrow();
    expect(leaseCount('user-token')).toBe(0);
  });

  it('ignores a duplicate lease of the same live token', () => {
    const first = vi.fn();
    const second = vi.fn();
    leaseToken('t4', first);
    leaseToken('t4', second); // ignored — must not reset the count or swap revoke
    expect(leaseCount('t4')).toBe(1);

    releaseToken('t4');
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});
