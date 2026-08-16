/**
 * The shared password policy and the enumeration-guard helper.
 *
 * Every server path that sets a password funnels through `validatePassword`, so
 * these cover the rules once rather than per-route (routes assert only that
 * they *call* it — see auth.test.ts / routes.test.ts).
 */

import { describe, expect, test } from 'vitest';
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  hashPassword,
  validatePassword,
  verifyPassword,
  verifyPasswordDummy,
} from '../../src/engine/password';

describe('validatePassword', () => {
  test('accepts a password at the length floor', () => {
    const check = validatePassword('a'.repeat(MIN_PASSWORD_LENGTH));
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.password).toBe('a'.repeat(MIN_PASSWORD_LENGTH));
  });

  test('rejects one below the floor', () => {
    const check = validatePassword('a'.repeat(MIN_PASSWORD_LENGTH - 1));
    expect(check.ok).toBe(false);
  });

  test.each([
    ['undefined', undefined],
    ['null', null],
    ['a number', 12345678],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(validatePassword(value).ok).toBe(false);
  });

  test('rejects an all-whitespace password', () => {
    expect(validatePassword('          ').ok).toBe(false);
  });

  test('accepts a password at the byte ceiling', () => {
    expect(validatePassword('a'.repeat(MAX_PASSWORD_BYTES)).ok).toBe(true);
  });

  test('rejects one past the byte ceiling, where bcrypt would truncate', () => {
    expect(validatePassword('a'.repeat(MAX_PASSWORD_BYTES + 1)).ok).toBe(false);
  });

  test('measures the ceiling in bytes, not characters', () => {
    // Each emoji is 4 bytes, so 20 of them are 80 bytes — over the limit even
    // though the string is only 20 code points long.
    const emoji = '🔐'.repeat(20);
    expect(emoji.length).toBeLessThan(MAX_PASSWORD_BYTES);
    expect(validatePassword(emoji).ok).toBe(false);
  });
});

describe('verifyPasswordDummy', () => {
  test('always reports failure', async () => {
    expect(await verifyPasswordDummy('anything at all')).toBe(false);
  });

  test('the constant it verifies against is a real bcrypt hash', async () => {
    // If the constant were malformed, bcrypt.compare would reject immediately
    // and the guard would do no work — silently restoring the timing oracle it
    // exists to close. A real hash of a real password is the canary.
    const password = 'a known password';
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);

    const start = process.hrtime.bigint();
    await verifyPasswordDummy(password);
    const dummyNs = Number(process.hrtime.bigint() - start);

    const realStart = process.hrtime.bigint();
    await verifyPassword('the wrong password', hash);
    const realNs = Number(process.hrtime.bigint() - realStart);

    // Same cost factor → same order of magnitude. A short-circuiting guard
    // would come back orders of magnitude faster than a real verification.
    expect(dummyNs).toBeGreaterThan(realNs / 10);
  });
});
