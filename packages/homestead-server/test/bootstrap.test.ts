import { describe, expect, test } from 'vitest';
import { Database } from '../src/engine/sqlite';
import { verifyPassword } from '../src/engine/password';
import {
  claimSetup,
  createSuperuser,
  ensureSuperuser,
  mintAdminToken,
  needsSetup,
  resetSuperuserPassword,
  DEFAULT_SUPERUSER_EMAIL,
} from '../src/bootstrap';
import { countUsers, createUserTables, getUserByEmail, getUserByToken } from '../src/engine/users';
import { retainToken, releaseToken } from '@rambleraptor/homestead-core/server/token-lease';

function freshDb(): Database {
  const db = new Database(':memory:');
  createUserTables(db);
  return db;
}

describe('ensureSuperuser', () => {
  test('creates a pending superuser once on an empty db', async () => {
    const db = freshDb();
    expect(await ensureSuperuser(db)).toBe('pending');
    expect(countUsers(db)).toBe(1);
    expect(needsSetup(db)).toBe(true);
    const found = getUserByEmail(db, DEFAULT_SUPERUSER_EMAIL);
    expect(found?.user.type).toBe('superuser');

    // Second boot: no duplicate, still pending.
    expect(await ensureSuperuser(db)).toBe('pending');
    expect(countUsers(db)).toBe(1);
  });

  test('treats pre-existing deployments (users, no meta) as claimed', async () => {
    const db = freshDb();
    await createSuperuser(db, 'owner@example.com', 'pw');
    expect(await ensureSuperuser(db)).toBe('claimed');
    expect(needsSetup(db)).toBe(false);
    expect(countUsers(db)).toBe(1);
    expect(getUserByEmail(db, DEFAULT_SUPERUSER_EMAIL)).toBeNull();
  });
});

describe('claimSetup', () => {
  test('claims the instance: sets email + password, one-shot', async () => {
    const db = freshDb();
    await ensureSuperuser(db);
    await claimSetup(db, 'me@home.dev', 'hunter2hunter2');

    expect(needsSetup(db)).toBe(false);
    const found = getUserByEmail(db, 'me@home.dev');
    expect(found?.user.type).toBe('superuser');
    expect(await verifyPassword('hunter2hunter2', found!.hash)).toBe(true);

    await expect(claimSetup(db, 'evil@example.com', 'p4ssw0rdp4ssw0rd')).rejects.toThrow(
      'already set up',
    );
  });

  test('reset-password also claims (handing out creds ends setup)', async () => {
    const db = freshDb();
    await ensureSuperuser(db);
    expect(needsSetup(db)).toBe(true);
    await resetSuperuserPassword(db);
    expect(needsSetup(db)).toBe(false);
  });
});

describe('resetSuperuserPassword', () => {
  test('rotates the password and returns the new one', async () => {
    const db = freshDb();
    await createSuperuser(db, 'owner@example.com', 'old');
    const { email, password } = await resetSuperuserPassword(db);
    expect(email).toBe('owner@example.com');
    expect(password).toMatch(/^[0-9a-f]{16}$/);

    const { hash } = getUserByEmail(db, 'owner@example.com')!;
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('old', hash)).toBe(false);
  });

  test('revokes existing sessions so old tokens stop working', async () => {
    const db = freshDb();
    await createSuperuser(db, 'owner@example.com', 'old');
    const { token } = mintAdminToken(db);
    expect(getUserByToken(db, token)?.email).toBe('owner@example.com');

    await resetSuperuserPassword(db);
    expect(getUserByToken(db, token)).toBeNull();
  });

  test('throws when no superuser exists', async () => {
    const db = freshDb();
    await expect(resetSuperuserPassword(db)).rejects.toThrow('no superuser exists');
  });
});

describe('mintAdminToken', () => {
  test('mints a working token and revoke removes it', async () => {
    const db = freshDb();
    await createSuperuser(db, 'owner@example.com', 'pw');
    const admin = mintAdminToken(db);
    expect(getUserByToken(db, admin.token)?.email).toBe('owner@example.com');
    admin.revoke();
    expect(getUserByToken(db, admin.token)).toBeNull();
  });

  test('throws when no superuser exists', () => {
    const db = freshDb();
    expect(() => mintAdminToken(db)).toThrow('no superuser exists');
  });

  test('revoke defers token deletion while a background operation holds a lease', async () => {
    const db = freshDb();
    await createSuperuser(db, 'owner@example.com', 'pw');
    const admin = mintAdminToken(db);

    // A detached operation created under this token retains a lease on it.
    retainToken(admin.token);

    // The minter revokes eagerly (e.g. a cron firing returning) — but the token
    // must stay usable so the in-flight operation's lifecycle writes still work.
    admin.revoke();
    expect(getUserByToken(db, admin.token)?.email).toBe('owner@example.com');

    // Once the operation settles and releases its lease, the token is deleted.
    releaseToken(admin.token);
    expect(getUserByToken(db, admin.token)).toBeNull();
  });
});
