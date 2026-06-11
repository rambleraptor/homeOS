import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  createSuperuser,
  ensureSuperuser,
  mintAdminToken,
  resetSuperuserPassword,
  DEFAULT_SUPERUSER_EMAIL,
} from '../src/bootstrap';
import { countUsers, createUserTables, getUserByEmail, getUserByToken } from '../src/engine/users';

function freshDb(): Database {
  const db = new Database(':memory:');
  createUserTables(db);
  return db;
}

describe('ensureSuperuser', () => {
  test('creates the default superuser once on an empty db', async () => {
    const db = freshDb();
    await ensureSuperuser(db);
    expect(countUsers(db)).toBe(1);
    const found = getUserByEmail(db, DEFAULT_SUPERUSER_EMAIL);
    expect(found?.user.type).toBe('superuser');

    // Second boot: no-op, no duplicate.
    await ensureSuperuser(db);
    expect(countUsers(db)).toBe(1);
  });

  test('no-ops when users already exist (no fatal missing-file case anymore)', async () => {
    const db = freshDb();
    await createSuperuser(db, 'owner@example.com', 'pw');
    await ensureSuperuser(db);
    expect(countUsers(db)).toBe(1);
    expect(getUserByEmail(db, DEFAULT_SUPERUSER_EMAIL)).toBeNull();
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
    expect(await Bun.password.verify(password, hash)).toBe(true);
    expect(await Bun.password.verify('old', hash)).toBe(false);
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
});
