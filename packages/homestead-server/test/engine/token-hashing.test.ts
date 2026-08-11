/**
 * Tokens are stored in `_tokens` (and the auth side-tables) only as their hash,
 * so a database read can't recover a usable bearer token. Lookups hash the
 * presented value, so validation still works. A one-time migration purges the
 * plaintext rows a pre-hashing database still holds.
 */

import { describe, expect, test } from 'vitest';
import { Database } from '../../src/engine/sqlite';
import { generateId, generateToken, nowRFC3339 } from '../../src/engine/ids';
import { createUserTables, getUserByToken, insertToken, insertUser } from '../../src/engine/users';
import { hashToken } from '../../src/engine/pat';
import { AuthService } from '../../src/auth/service';
import type { User } from '../../src/engine/types';
import { TYPE_REGULAR } from '../../src/engine/types';

function freshDb(): Database {
  const db = new Database(':memory:');
  createUserTables(db);
  return db;
}

function seed(db: Database): User {
  const id = generateId();
  const now = nowRFC3339();
  const user: User = {
    id,
    path: `users/${id}`,
    email: `${id}@example.com`,
    type: TYPE_REGULAR,
    create_time: now,
    update_time: now,
  };
  insertUser(db, user, 'x');
  return user;
}

function storedTokens(db: Database): string[] {
  return (db.query('SELECT token FROM _tokens').all() as { token: string }[]).map((r) => r.token);
}

describe('tokens are hashed at rest', () => {
  test('insertToken stores the hash, not the raw value, but the raw value validates', () => {
    const db = freshDb();
    const user = seed(db);
    const raw = generateToken();
    insertToken(db, raw, user.id);

    // The raw token is nowhere in the table; only its hash is.
    expect(storedTokens(db)).not.toContain(raw);
    expect(storedTokens(db)).toContain(hashToken(raw));
    // …yet presenting the raw token still resolves the user.
    expect(getUserByToken(db, raw)?.id).toBe(user.id);
  });

  test('a session (access + refresh) is hashed at rest across all tables', () => {
    const db = freshDb();
    const user = seed(db);
    const auth = new AuthService(db);
    const session = auth.issueSession(user.id);

    // _tokens holds the access token hashed, not raw.
    expect(storedTokens(db)).toContain(hashToken(session.access_token));
    expect(storedTokens(db)).not.toContain(session.access_token);

    // The refresh token is hashed in its table; the presented-secret columns of
    // both side-tables never hold the raw value.
    const refreshRows = db
      .query('SELECT refresh_token FROM _auth_refresh_tokens')
      .all() as { refresh_token: string }[];
    expect(refreshRows.map((r) => r.refresh_token)).toEqual([hashToken(session.refresh_token)]);

    const bindingRows = db
      .query('SELECT access_token FROM _auth_access_tokens')
      .all() as { access_token: string }[];
    expect(bindingRows.map((r) => r.access_token)).toEqual([hashToken(session.access_token)]);

    // Validation and rotation still function against the raw values.
    expect(auth.validateAccessToken(session.access_token)?.id).toBe(user.id);
    const rotated = auth.rotateRefresh(session.refresh_token);
    expect(rotated?.access_token).toBeTruthy();
    expect(auth.validateAccessToken(session.access_token)).toBeNull(); // old one revoked
  });
});

describe('one-time purge of pre-hashing plaintext tokens', () => {
  test('drops raw session/auth rows but keeps already-hashed PAT rows, once', () => {
    // Simulate a pre-migration database: raw token rows and the auth side-tables,
    // with the migration flag NOT yet set.
    const db = new Database(':memory:');
    db.run(`CREATE TABLE _tokens (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL, create_time TEXT NOT NULL,
      expires_at TEXT, pat_id TEXT
    )`);
    db.run(`CREATE TABLE _auth_refresh_tokens (
      refresh_token TEXT PRIMARY KEY, access_token TEXT NOT NULL, user_id TEXT NOT NULL,
      client_id TEXT, scope TEXT, audience TEXT, expires_at TEXT NOT NULL, create_time TEXT NOT NULL
    )`);
    db.run(`CREATE TABLE _auth_access_tokens (
      access_token TEXT PRIMARY KEY, user_id TEXT NOT NULL, client_id TEXT, scope TEXT,
      audience TEXT, create_time TEXT NOT NULL
    )`);
    const now = nowRFC3339();
    // A raw session token (pat_id NULL) and an already-hashed PAT (pat_id set).
    db.query('INSERT INTO _tokens (token, user_id, create_time, pat_id) VALUES (?, ?, ?, ?)').run(
      'raw-session-token', 'u1', now, null,
    );
    db.query('INSERT INTO _tokens (token, user_id, create_time, pat_id) VALUES (?, ?, ?, ?)').run(
      hashToken('hsd_pat_secret'), 'u1', now, 'pat1',
    );
    db.query(
      'INSERT INTO _auth_refresh_tokens (refresh_token, access_token, user_id, expires_at, create_time) VALUES (?, ?, ?, ?, ?)',
    ).run('raw-refresh', 'raw-session-token', 'u1', now, now);
    db.query(
      'INSERT INTO _auth_access_tokens (access_token, user_id, create_time) VALUES (?, ?, ?)',
    ).run('raw-session-token', 'u1', now);

    // Boot runs the migration (createUserTables is idempotent over the columns).
    createUserTables(db);

    // The raw session row is gone; the hashed PAT row survives.
    expect(storedTokens(db)).toEqual([hashToken('hsd_pat_secret')]);
    // The auth side-tables (all session-only) are cleared.
    expect(db.query('SELECT COUNT(*) AS n FROM _auth_refresh_tokens').get()).toEqual({ n: 0 });
    expect(db.query('SELECT COUNT(*) AS n FROM _auth_access_tokens').get()).toEqual({ n: 0 });

    // Idempotent: a later boot doesn't re-purge (a fresh PAT added meanwhile stays).
    db.query('INSERT INTO _tokens (token, user_id, create_time, pat_id) VALUES (?, ?, ?, ?)').run(
      hashToken('hsd_pat_second'), 'u1', now, 'pat2',
    );
    createUserTables(db);
    expect(storedTokens(db)).toHaveLength(2);
  });
});
