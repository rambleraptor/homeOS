/**
 * Superuser bootstrap. On first boot (empty _users) a *pending* superuser is
 * created with a random, never-revealed password, and the instance is marked
 * unclaimed: the first visit to the SPA shows a "create your admin account"
 * form backed by /api/setup, which sets the email + password and claims the
 * instance. Recovery goes through `homestead admin reset-password`, which
 * calls resetSuperuserPassword() against the db directly (and also claims).
 * The boot-time schema sync and cron runs mint short-lived tokens via
 * mintAdminToken() — the pending superuser exists from first boot, so those
 * work before the instance is claimed. (The `homestead resources` CLI no
 * longer mints locally; it uses a user token from `homestead login`.)
 */

import type { Database } from './engine/sqlite';
import { generateId, generateToken, nowRFC3339 } from './engine/ids';
import type { User } from './engine/types';
import { TYPE_SUPERUSER } from './engine/types';
import { countUsers, deleteToken, hashPassword, insertToken, insertUser } from './engine/users';
import { leaseToken, releaseToken } from '@rambleraptor/homestead-core/server/token-lease';

export const DEFAULT_SUPERUSER_EMAIL = 'admin@example.com';

// Launcher/server housekeeping outside the engine's dynamic resources.
const META_TABLE = `CREATE TABLE IF NOT EXISTS _homestead_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
)`;
const SETUP_CLAIMED_KEY = 'setup_claimed';

function ensureMetaTable(db: Database): void {
  db.run(META_TABLE);
}

function getMeta(db: Database, key: string): string | null {
  ensureMetaTable(db);
  const row = db.query('SELECT value FROM _homestead_meta WHERE key = ?').get(key) as
    | { value: string }
    | null;
  return row?.value ?? null;
}

function setMeta(db: Database, key: string, value: string): void {
  ensureMetaTable(db);
  db.query(
    'INSERT INTO _homestead_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, value);
}

/** True while the instance is waiting for its first admin account. */
export function needsSetup(db: Database): boolean {
  return getMeta(db, SETUP_CLAIMED_KEY) === '0';
}

/**
 * Claim the instance: set the pending superuser's email + password, and an
 * optional display name (falls back to the bootstrap default when omitted).
 * One-shot — throws when the instance is already claimed (the /api/setup route
 * also guards with a 409, this is the backstop).
 */
export async function claimSetup(
  db: Database,
  email: string,
  password: string,
  displayName?: string,
): Promise<void> {
  if (!needsSetup(db)) throw new Error('instance is already set up');
  const found = firstSuperuser(db);
  if (!found) throw new Error('no pending superuser — has the server booted?');
  const passwordHash = await hashPassword(password);
  const now = nowRFC3339();
  const name = displayName?.trim();
  if (name) {
    db.query(
      'UPDATE _users SET email = ?, password_hash = ?, display_name = ?, update_time = ? WHERE id = ?',
    ).run(email, passwordHash, name, now, found.id);
  } else {
    db.query(
      'UPDATE _users SET email = ?, password_hash = ?, update_time = ? WHERE id = ?',
    ).run(email, passwordHash, now, found.id);
  }
  setMeta(db, SETUP_CLAIMED_KEY, '1');
}

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
 * First-boot bootstrap: when no users exist, create a pending superuser with
 * a random, never-revealed password and mark the instance unclaimed — the
 * first SPA visit claims it via /api/setup. Pre-existing deployments (users
 * present, no meta row) are treated as claimed.
 */
export async function ensureSuperuser(db: Database): Promise<'pending' | 'claimed'> {
  if (countUsers(db) > 0) {
    if (getMeta(db, SETUP_CLAIMED_KEY) === null) setMeta(db, SETUP_CLAIMED_KEY, '1');
    return needsSetup(db) ? 'pending' : 'claimed';
  }
  await createSuperuser(db, DEFAULT_SUPERUSER_EMAIL, generateToken().slice(0, 16));
  setMeta(db, SETUP_CLAIMED_KEY, '0');
  return 'pending';
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
  // Revoke existing sessions: a reset means the old password is no longer
  // trusted, so tokens minted under it must not keep working.
  db.query('DELETE FROM _tokens WHERE user_id = ?').run(found.id);
  // Handing out working credentials claims the instance — the first-visit
  // setup form must not reappear over a usable login.
  setMeta(db, SETUP_CLAIMED_KEY, '1');
  return { email: found.email, password };
}

export interface AdminToken {
  token: string;
  userId: string;
  /**
   * Release the minter's reference on the token. The token row is removed from
   * the db once this *and* every lease taken by an operation created under it
   * (see {@link leaseToken}) have been released — so calling this while a
   * detached background operation is still in flight defers the real deletion
   * until that work settles, rather than yanking the token out from under it.
   */
  revoke: () => void;
}

/**
 * Mint a bearer token for the first superuser directly in the db — no
 * password round-trip. Used by the boot-time schema sync and cron runs.
 *
 * The token is registered as *leased*: `revoke()` releases the minter's own
 * reference, but the underlying row is only deleted once all references are
 * gone. Background operations created with this token (via `operationStore`)
 * retain a reference for their lifetime, so a cron firing can revoke eagerly
 * the moment its handler returns without stranding the classify/index
 * operations it kicked off fire-and-forget.
 */
export function mintAdminToken(db: Database): AdminToken {
  const found = firstSuperuser(db);
  if (!found) throw new Error('no superuser exists; start the server once to bootstrap one');
  return mintTokenForUser(db, found.id);
}

/**
 * Mint a leased bearer token for a specific user id — the same lease semantics
 * as {@link mintAdminToken} (see that doc), but for any user. Used by the MCP
 * route when Cloudflare Access authenticates a caller: the endpoint runs the
 * tools under the mapped user's token, then revokes it once the request settles.
 */
export function mintTokenForUser(db: Database, userId: string): AdminToken {
  const token = generateToken();
  insertToken(db, token, userId);
  leaseToken(token, () => deleteToken(db, token));
  return {
    token,
    userId,
    revoke: () => releaseToken(token),
  };
}
