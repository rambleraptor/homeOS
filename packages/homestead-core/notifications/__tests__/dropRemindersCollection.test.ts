/**
 * Unit tests for the `notifications-drop-reminders-collection` migration.
 *
 * The migration is one HTTP call, so what's worth pinning down is how it treats
 * each answer — and above all that it is ordered behind the adoption, since
 * getting that wrong destroys data rather than merely erroring.
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MigrationContext } from '@rambleraptor/homestead-core/apps/migrations';
import migrate from '../migrations/drop-reminders-collection';
import { notificationsApp } from '../app.config';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function ctx(): MigrationContext {
  return {
    id: 'notifications-drop-reminders-collection',
    appId: 'notifications',
    token: 'admin-token',
    log: async () => {},
  };
}

function reply(status: number, body = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe('drop-reminders-collection', () => {
  test('deletes the definition, which is what drops the table', async () => {
    fetchMock.mockResolvedValue(reply(200));

    const result = await migrate(ctx());

    expect(result).toMatchObject({ dropped: true });
    const [url, init] = fetchMock.mock.calls[0];
    // Removing the definition from the declared set is inert — the resource
    // sync has no delete path — so the collection only goes via this call.
    expect(String(url)).toMatch(/\/aep-resource-definitions\/reminder$/);
    expect(init).toMatchObject({ method: 'DELETE' });
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer admin-token',
    });
  });

  test('a definition that is already gone is a no-op, not a failure', async () => {
    fetchMock.mockResolvedValue(reply(404));

    const result = await migrate(ctx());

    // A fresh instance never had the collection; a re-run after a ledger write
    // failed would see the same thing.
    expect(result).toMatchObject({ dropped: false, reason: 'absent' });
  });

  test('a refusal fails loudly rather than half-retiring the collection', async () => {
    // 400 is what `removeResource` returns when something still parents it.
    fetchMock.mockResolvedValue(reply(400, 'children depend on it: [transaction]'));

    await expect(migrate(ctx())).rejects.toThrow(/children depend on it/);
  });

  test('a server error is not swallowed', async () => {
    fetchMock.mockResolvedValue(reply(500, 'boom'));
    await expect(migrate(ctx())).rejects.toThrow(/500/);
  });
});

describe('migration ordering', () => {
  test('the drop is declared after the adoption that reads the collection', () => {
    const ids = (notificationsApp.migrations ?? []).map((m) => m.id);
    const adopt = ids.indexOf('notifications-adopt-reminders');
    const drop = ids.indexOf('notifications-drop-reminders-collection');

    // Migrations run in array order within an app. Reversing these two would
    // delete the reminders before they were carried into the queue, on any
    // instance upgrading across both releases at once — and a DROP TABLE has
    // no undo. This assertion is the guard on that.
    expect(adopt).toBeGreaterThanOrEqual(0);
    expect(drop).toBeGreaterThan(adopt);
  });
});
