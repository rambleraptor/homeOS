/**
 * OAuth authorization-server storage: registered clients, single-use
 * authorization codes, and the short-lived "authorize request" handles the
 * SPA consent page approves. Access + refresh tokens live in the auth
 * service's own tables (`_tokens` / `_auth_refresh_tokens`); this module only
 * owns the AS-specific state. All access is through the `Database` seam.
 */

import type { Database } from '../../engine/sqlite';
import { nowRFC3339 } from '../../engine/ids';

export interface ClientRecord {
  client_id: string;
  client_secret: string | null;
  redirect_uris: string[];
  client_name: string | null;
  token_endpoint_auth_method: string;
  grant_types: string[];
  create_time: string;
}

export interface AuthCodeRecord {
  code: string;
  client_id: string;
  user_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  resource: string | null;
  scope: string | null;
  expires_at: string;
}

/** A validated /authorize request, stashed while the user consents in the SPA. */
export interface AuthRequestRecord {
  request_id: string;
  client_id: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  state: string | null;
  resource: string | null;
  scope: string | null;
  expires_at: string;
}

export function createOAuthTables(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS _auth_clients (
		client_id TEXT PRIMARY KEY,
		client_secret TEXT,
		redirect_uris TEXT NOT NULL,
		client_name TEXT,
		token_endpoint_auth_method TEXT NOT NULL,
		grant_types TEXT NOT NULL,
		create_time TEXT NOT NULL
	)`);
  db.run(`CREATE TABLE IF NOT EXISTS _auth_auth_codes (
		code TEXT PRIMARY KEY,
		client_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		redirect_uri TEXT NOT NULL,
		code_challenge TEXT NOT NULL,
		code_challenge_method TEXT NOT NULL,
		resource TEXT,
		scope TEXT,
		expires_at TEXT NOT NULL
	)`);
  db.run(`CREATE TABLE IF NOT EXISTS _auth_requests (
		request_id TEXT PRIMARY KEY,
		client_id TEXT NOT NULL,
		redirect_uri TEXT NOT NULL,
		code_challenge TEXT NOT NULL,
		code_challenge_method TEXT NOT NULL,
		state TEXT,
		resource TEXT,
		scope TEXT,
		expires_at TEXT NOT NULL
	)`);
}

// --- clients ---

export function insertClient(db: Database, c: Omit<ClientRecord, 'create_time'>): void {
  db.query(
    `INSERT INTO _auth_clients
      (client_id, client_secret, redirect_uris, client_name, token_endpoint_auth_method, grant_types, create_time)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    c.client_id,
    c.client_secret,
    JSON.stringify(c.redirect_uris),
    c.client_name,
    c.token_endpoint_auth_method,
    JSON.stringify(c.grant_types),
    nowRFC3339(),
  );
}

interface ClientRow {
  client_id: string;
  client_secret: string | null;
  redirect_uris: string;
  client_name: string | null;
  token_endpoint_auth_method: string;
  grant_types: string;
  create_time: string;
}

export function getClient(db: Database, clientId: string): ClientRecord | null {
  const row = db
    .query('SELECT * FROM _auth_clients WHERE client_id = ?')
    .get(clientId) as ClientRow | null;
  if (!row) return null;
  return {
    ...row,
    redirect_uris: JSON.parse(row.redirect_uris) as string[],
    grant_types: JSON.parse(row.grant_types) as string[],
  };
}

// --- authorization codes (single-use) ---

export function insertAuthCode(db: Database, c: AuthCodeRecord): void {
  db.query(
    `INSERT INTO _auth_auth_codes
      (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, resource, scope, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    c.code,
    c.client_id,
    c.user_id,
    c.redirect_uri,
    c.code_challenge,
    c.code_challenge_method,
    c.resource,
    c.scope,
    c.expires_at,
  );
}

/**
 * Atomically fetch-and-delete a code (single use). Returns the row, or null if
 * the code is unknown or already consumed. Expiry is checked by the caller.
 */
export function consumeAuthCode(db: Database, code: string): AuthCodeRecord | null {
  const row = db
    .query('SELECT * FROM _auth_auth_codes WHERE code = ?')
    .get(code) as AuthCodeRecord | null;
  if (!row) return null;
  const del = db.query('DELETE FROM _auth_auth_codes WHERE code = ?').run(code);
  if (Number(del.changes) === 0) return null;
  return row;
}

// --- pending authorize requests ---

export function insertAuthRequest(db: Database, r: AuthRequestRecord): void {
  db.query(
    `INSERT INTO _auth_requests
      (request_id, client_id, redirect_uri, code_challenge, code_challenge_method, state, resource, scope, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    r.request_id,
    r.client_id,
    r.redirect_uri,
    r.code_challenge,
    r.code_challenge_method,
    r.state,
    r.resource,
    r.scope,
    r.expires_at,
  );
}

export function getAuthRequest(db: Database, requestId: string): AuthRequestRecord | null {
  return db
    .query('SELECT * FROM _auth_requests WHERE request_id = ?')
    .get(requestId) as AuthRequestRecord | null;
}

export function deleteAuthRequest(db: Database, requestId: string): void {
  db.query('DELETE FROM _auth_requests WHERE request_id = ?').run(requestId);
}
