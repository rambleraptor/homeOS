/**
 * Tests for the server-side per-user settings seam.
 *
 * The engine client is faked, so what's under test is the path the reader
 * builds, the flattening convention it decodes, and the coercion an untouched
 * or hand-written value goes through.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeServerClient } from './fake-server-client';

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof import('./fake-server-client').createFakeServerClient> | null }));

vi.mock('../client', () => ({
  serverClient: () => fake.current!.client,
}));

import { readUserFlag, readUserSetting, usersWithFlag } from '../user-settings';

beforeEach(() => {
  fake.current = createFakeServerClient();
});

/** Make the fake return `record` as the caller's single preference row. */
function storedPreferences(record: Record<string, unknown> | null) {
  fake.current!.listAllFn.mockImplementation(async () =>
    record ? [{ id: 'pref1', ...record }] : [],
  );
}

describe('readUserSetting', () => {
  test('reads the flattened field off the user’s preference record', async () => {
    storedPreferences({ home__pickup_reminder: true });
    await expect(readUserSetting('t', 'u1', 'home', 'pickup_reminder')).resolves.toBe(
      true,
    );
    expect(fake.current!.listAllFn).toHaveBeenCalledWith(
      '/users/u1/preferences',
      undefined,
    );
  });

  test('a hyphenated app id flattens to underscores', async () => {
    storedPreferences({ gift_cards__show_archived: true });
    await expect(
      readUserSetting('t', 'u1', 'gift-cards', 'show_archived'),
    ).resolves.toBe(true);
  });

  test('an untouched setting is undefined, not a guess', async () => {
    storedPreferences({});
    await expect(
      readUserSetting('t', 'u1', 'home', 'pickup_reminder'),
    ).resolves.toBeUndefined();
  });

  test('a user with no preference record at all is undefined', async () => {
    storedPreferences(null);
    await expect(
      readUserSetting('t', 'u1', 'home', 'pickup_reminder'),
    ).resolves.toBeUndefined();
  });
});

describe('readUserFlag', () => {
  test('an unset flag falls back', async () => {
    storedPreferences({});
    await expect(readUserFlag('t', 'u1', 'home', 'pickup_reminder')).resolves.toBe(
      false,
    );
    await expect(
      readUserFlag('t', 'u1', 'home', 'pickup_reminder', true),
    ).resolves.toBe(true);
  });

  test('the string forms coerce, so an older writer still reads right', async () => {
    storedPreferences({ home__pickup_reminder: 'true' });
    await expect(readUserFlag('t', 'u1', 'home', 'pickup_reminder')).resolves.toBe(
      true,
    );

    storedPreferences({ home__pickup_reminder: 'false' });
    await expect(
      readUserFlag('t', 'u1', 'home', 'pickup_reminder', true),
    ).resolves.toBe(false);
  });

  test('a value that means nothing falls back rather than reading as truthy', async () => {
    storedPreferences({ home__pickup_reminder: 'perhaps' });
    await expect(readUserFlag('t', 'u1', 'home', 'pickup_reminder')).resolves.toBe(
      false,
    );
  });
});

describe('usersWithFlag', () => {
  test('returns only the users who turned it on', async () => {
    fake.current!.listAllFn.mockImplementation(async (path: string) => [
      {
        id: 'pref1',
        home__pickup_reminder: path === '/users/u2/preferences',
      },
    ]);

    await expect(
      usersWithFlag('t', ['u1', 'u2', 'u3'], 'home', 'pickup_reminder'),
    ).resolves.toEqual(['u2']);
  });

  test('an empty household is an empty list, not a read', async () => {
    await expect(
      usersWithFlag('t', [], 'home', 'pickup_reminder'),
    ).resolves.toEqual([]);
    expect(fake.current!.listAllFn).not.toHaveBeenCalled();
  });
});
