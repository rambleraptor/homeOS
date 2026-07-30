/**
 * Auth-service storage. Access tokens live in the engine's `_tokens` table (so
 * the engine keeps validating them); this module owns the tables layered on top
 * — refresh tokens here, and OAuth clients/codes in a later stage. Everything
 * goes through the runtime-portable `Database` seam.
 */

import type { Database } from '../engine/sqlite';
import { nowRFC3339 } from '../engine/ids';

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

export function insertAccessTokenBinding(db: Database, b: AccessTokenBinding): void {
  db.query(
    `INSERT INTO _auth_access_tokens (access_token, user_id, client_id, scope, audience, create_time)
      VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(b.access_token, b.user_id, b.client_id, b.scope, b.audience, nowRFC3339());
}

export function getAccessTokenBinding(db: Database, accessToken: string): AccessTokenBinding | null {
  return db
    .query('SELECT access_token, user_id, client_id, scope, audience FROM _auth_access_tokens WHERE access_token = ?')
    .get(accessToken) as AccessTokenBinding | null;
}

export function deleteAccessTokenBinding(db: Database, accessToken: string): void {
  db.query('DELETE FROM _auth_access_tokens WHERE access_token = ?').run(accessToken);
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
    r.refresh_token,
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
    .get(refreshToken) as RefreshTokenRecord | null;
}

export function deleteRefreshToken(db: Database, refreshToken: string): void {
  db.query('DELETE FROM _auth_refresh_tokens WHERE refresh_token = ?').run(refreshToken);
}

/** Drop any refresh tokens tied to an access token (used when revoking it). */
export function deleteRefreshTokensForAccess(db: Database, accessToken: string): void {
  db.query('DELETE FROM _auth_refresh_tokens WHERE access_token = ?').run(accessToken);
}
