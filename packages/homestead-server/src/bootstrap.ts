/**
 * Superuser bootstrap. On first boot (empty _users) a superuser is created
 * with a random password printed to stdout ONCE — there is no
 * credentials.json anymore. Recovery goes through `homestead admin
 * reset-password`, which calls resetSuperuserPassword() against the db
 * directly. Schema sync and `homestead resources` mint short-lived tokens
 * via mintAdminToken() instead of logging in with stored credentials.
 */

import type { Database } from 'bun:sqlite';
import { generateId, generateToken, nowRFC3339 } from './engine/ids';
import type { User } from './engine/types';
import { TYPE_SUPERUSER } from './engine/types';
import { countUsers, deleteToken, hashPassword, insertToken, insertUser } from './engine/users';

export const DEFAULT_SUPERUSER_EMAIL = 'admin@example.com';

/** Insert a superuser with a known password (used by e2e and bootstrap). */
export async function createSuperuser(
  db: Database,
  email: string,
  password: string,
): Promise<User> {
  const id = generateId();
  const now = nowRFC3339();
  const user: User = {
    id,
    path: `users/${id}`,
    email,
    display_name: 'Admin',
    type: TYPE_SUPERUSER,
    create_time: now,
    update_time: now,
  };
  insertUser(db, user, await hashPassword(password));
  return user;
}

/**
 * First-boot bootstrap: when no users exist, create the default superuser
 * and print its password to stdout (the only time it is shown). No-op when
 * users already exist.
 */
export async function ensureSuperuser(db: Database): Promise<void> {
  if (countUsers(db) > 0) return;
  const password = generateToken().slice(0, 16);
  await createSuperuser(db, DEFAULT_SUPERUSER_EMAIL, password);
  console.log('=== DEFAULT SUPERUSER CREATED ===');
  console.log(`  Email:    ${DEFAULT_SUPERUSER_EMAIL}`);
  console.log(`  Password: ${password}`);
  console.log('  This password is shown only once. To reset it later, run:');
  console.log('    homestead admin reset-password');
  console.log('=================================');
}

function firstSuperuser(db: Database, email?: string): { id: string; email: string } | null {
  if (email) {
    return db
      .query('SELECT id, email FROM _users WHERE email = ? AND type = ?')
      .get(email, TYPE_SUPERUSER) as { id: string; email: string } | null;
  }
  return db
    .query('SELECT id, email FROM _users WHERE type = ? ORDER BY id LIMIT 1')
    .get(TYPE_SUPERUSER) as { id: string; email: string } | null;
}

/**
 * Reset a superuser's password to a fresh random value and return it.
 * Targets the first superuser unless an email is given.
 */
export async function resetSuperuserPassword(
  db: Database,
  email?: string,
): Promise<{ email: string; password: string }> {
  const found = firstSuperuser(db, email);
  if (!found) {
    throw new Error(email ? `no superuser with email ${email}` : 'no superuser exists');
  }
  const password = generateToken().slice(0, 16);
  db.query('UPDATE _users SET password_hash = ?, update_time = ? WHERE id = ?').run(
    await hashPassword(password),
    nowRFC3339(),
    found.id,
  );
  return { email: found.email, password };
}

export interface AdminToken {
  token: string;
  userId: string;
  /** Remove the token from the db (call when done). */
  revoke: () => void;
}

/**
 * Mint a bearer token for the first superuser directly in the db — no
 * password round-trip. Used by the boot-time schema sync and the
 * `homestead resources` CLI.
 */
export function mintAdminToken(db: Database): AdminToken {
  const found = firstSuperuser(db);
  if (!found) throw new Error('no superuser exists; start the server once to bootstrap one');
  const token = generateToken();
  insertToken(db, token, found.id);
  return {
    token,
    userId: found.id,
    revoke: () => deleteToken(db, token),
  };
}
