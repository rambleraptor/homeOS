/**
 * Auth-service storage. Access tokens live in the engine's `_tokens` table (so
 * the engine keeps validating them); this module owns the tables layered on top
 * — refresh tokens here, and OAuth clients/codes in a later stage. Everything
 * goes through the runtime-portable `Database` seam.
 */

import type { Database } from '../engine/sqlite';
import { nowRFC3339 } from '../engine/ids';
import { hashToken } from '../engine/pat';

export interface RefreshTokenRecord {
  refresh_token: string;
  access_token: string;
  user_id: string;
  client_id: string | null;
  scope: string | null;
  audience: string | null;
  expires_at: string;
  create_time: string;
}

/** Audience/scope/client binding for an issued access token (RFC 8707). */
export interface AccessTokenBinding {
  access_token: string;
  user_id: string;
  client_id: string | null;
  scope: string | null;
  audience: string | null;
}

export function createAuthTables(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS _auth_refresh_tokens (
		refresh_token TEXT PRIMARY KEY,
		access_token TEXT NOT NULL,
		user_id TEXT NOT NULL,
		client_id TEXT,
		scope TEXT,
		audience TEXT,
		expires_at TEXT NOT NULL,
		create_time TEXT NOT NULL
	)`);
  // Access tokens live in the engine's `_tokens`; this side table records the
  // OAuth binding (client/scope/audience) so a resource server can enforce
  // audience. Plain logins get a row with null bindings.
  db.run(`CREATE TABLE IF NOT EXISTS _auth_access_tokens (
		access_token TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		client_id TEXT,
		scope TEXT,
		audience TEXT,
		create_time TEXT NOT NULL
	)`);
}

// Presented secrets are stored only as their hash (matching `_tokens.token`),
// so a database read can't recover a usable token. Both the refresh token and
// the access token are values a client presents back (the access token via the
// OAuth resource-server verify path), so both are hashed here. The refresh
// row's `access_token` column is a *correlation copy* used only to cascade-
// delete the matching `_tokens`/binding rows — its keys are looked up with the
// raw access token (which the delete funnels hash themselves), so it stays raw.

export function insertAccessTokenBinding(db: Database, b: AccessTokenBinding): void {
  db.query(
    `INSERT INTO _auth_access_tokens (access_token, user_id, client_id, scope, audience, create_time)
      VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(hashToken(b.access_token), b.user_id, b.client_id, b.scope, b.audience, nowRFC3339());
}

export function getAccessTokenBinding(db: Database, accessToken: string): AccessTokenBinding | null {
  return db
    .query('SELECT access_token, user_id, client_id, scope, audience FROM _auth_access_tokens WHERE access_token = ?')
    .get(hashToken(accessToken)) as AccessTokenBinding | null;
}

export function deleteAccessTokenBinding(db: Database, accessToken: string): void {
  db.query('DELETE FROM _auth_access_tokens WHERE access_token = ?').run(hashToken(accessToken));
}

export function insertRefreshToken(
  db: Database,
  r: Omit<RefreshTokenRecord, 'create_time'>,
): void {
  db.query(
    `INSERT INTO _auth_refresh_tokens
      (refresh_token, access_token, user_id, client_id, scope, audience, expires_at, create_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    hashToken(r.refresh_token),
    // Correlation copy only (see note above) — kept raw so `deleteToken` /
    // `deleteRefreshTokensForAccess` can hash the presented access token once.
    r.access_token,
    r.user_id,
    r.client_id,
    r.scope,
    r.audience,
    r.expires_at,
    nowRFC3339(),
  );
}

export function getRefreshToken(db: Database, refreshToken: string): RefreshTokenRecord | null {
  return db
    .query('SELECT * FROM _auth_refresh_tokens WHERE refresh_token = ?')
    .get(hashToken(refreshToken)) as RefreshTokenRecord | null;
}

export function deleteRefreshToken(db: Database, refreshToken: string): void {
  db.query('DELETE FROM _auth_refresh_tokens WHERE refresh_token = ?').run(hashToken(refreshToken));
}

/** Drop any refresh tokens tied to an access token (used when revoking it). */
export function deleteRefreshTokensForAccess(db: Database, accessToken: string): void {
  // Matches the raw correlation copy stored by insertRefreshToken.
  db.query('DELETE FROM _auth_refresh_tokens WHERE access_token = ?').run(accessToken);
}
