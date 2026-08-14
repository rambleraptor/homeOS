/**
 * Auth-service storage. Access tokens live in the engine's `_tokens` table (so
 * the engine keeps validating them); this module owns the tables layered on top
 * — refresh tokens here, and OAuth clients/codes in a later stage. Everything
 * goes through the runtime-portable `Database` seam.
 */

import type { Database } from '../engine/sqlite';
import { nowRFC3339 } from '../engine/ids';
import { hashToken } from '../engine/pat';
import { isExpired } from './tokens';

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

// --- connected apps (OAuth clients the user has authorized) ---

/**
 * One OAuth client the user has an active authorization with, aggregated across
 * however many sessions that client currently holds. Non-secret metadata only —
 * derived from the refresh-token rows plus the client registration, never the
 * bearer secrets (which are stored hashed).
 */
export interface ConnectedApp {
  client_id: string;
  /** The client's registered display name, or null if it registered without one. */
  client_name: string | null;
  /** Space-delimited scope of the most recent session, or null (unscoped). */
  scope: string | null;
  /** The resource the tokens are audience-bound to (RFC 8707), or null. */
  audience: string | null;
  /** How many active (non-expired) sessions this client currently holds. */
  session_count: number;
  /** When the earliest still-active session was authorized (RFC3339). */
  connected_at: string;
  /** When the latest-expiring session lapses (RFC3339). */
  expires_at: string;
}

interface ConnectedRow {
  client_id: string;
  client_name: string | null;
  scope: string | null;
  audience: string | null;
  expires_at: string;
  create_time: string;
}

/**
 * List the OAuth clients this user has authorized, one entry per client with
 * its active sessions folded together. Only clients with at least one
 * non-expired refresh token are returned, so a lapsed authorization drops off
 * the list on its own. Ordered most-recently-connected first.
 */
export function listConnectedApps(db: Database, userId: string): ConnectedApp[] {
  // `client_id IS NOT NULL` excludes the user's own login sessions (password /
  // federated logins mint refresh tokens with no client) — only tokens issued
  // to a registered OAuth client are a "connected app".
  const rows = db
    .query(
      `SELECT r.client_id, r.scope, r.audience, r.expires_at, r.create_time, c.client_name
        FROM _auth_refresh_tokens r
        LEFT JOIN _auth_clients c ON c.client_id = r.client_id
        WHERE r.user_id = ? AND r.client_id IS NOT NULL`,
    )
    .all(userId) as ConnectedRow[];

  const byClient = new Map<string, ConnectedRow[]>();
  for (const row of rows) {
    if (isExpired(row.expires_at)) continue;
    const bucket = byClient.get(row.client_id);
    if (bucket) bucket.push(row);
    else byClient.set(row.client_id, [row]);
  }

  const apps: ConnectedApp[] = [];
  for (const [clientId, sessions] of byClient) {
    // Newest session drives the displayed scope/audience; the earliest is when
    // the connection began; the latest expiry is when it lapses.
    const newest = sessions.reduce((a, b) => (b.create_time > a.create_time ? b : a));
    const connectedAt = sessions.reduce((min, s) => (s.create_time < min ? s.create_time : min), newest.create_time);
    const expiresAt = sessions.reduce((max, s) => (s.expires_at > max ? s.expires_at : max), newest.expires_at);
    apps.push({
      client_id: clientId,
      client_name: newest.client_name,
      scope: newest.scope,
      audience: newest.audience,
      session_count: sessions.length,
      connected_at: connectedAt,
      expires_at: expiresAt,
    });
  }
  apps.sort((a, b) => (a.connected_at < b.connected_at ? 1 : -1));
  return apps;
}

/**
 * Whether this user has any authorization (active or lapsed) with the client.
 * Used by the disconnect route to tell "nothing to revoke" (404) apart from a
 * successful teardown.
 */
export function userHasClient(db: Database, userId: string, clientId: string): boolean {
  const row = db
    .query('SELECT 1 FROM _auth_refresh_tokens WHERE user_id = ? AND client_id = ? LIMIT 1')
    .get(userId, clientId);
  return row != null;
}

/**
 * Revoke every session this client holds for the user — access tokens, their
 * refresh tokens, and the audience bindings. Reaches all of them (even sessions
 * already rotated past their refresh token) by matching the hashed access token
 * shared between `_auth_access_tokens` and the engine's `_tokens`.
 */
export function revokeClientForUser(db: Database, userId: string, clientId: string): void {
  db.query(
    `DELETE FROM _tokens WHERE token IN (
        SELECT access_token FROM _auth_access_tokens WHERE user_id = ? AND client_id = ?
      )`,
  ).run(userId, clientId);
  db.query('DELETE FROM _auth_access_tokens WHERE user_id = ? AND client_id = ?').run(userId, clientId);
  db.query('DELETE FROM _auth_refresh_tokens WHERE user_id = ? AND client_id = ?').run(userId, clientId);
}
