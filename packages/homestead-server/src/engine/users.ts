/**
 * Built-in user resource: /users CRUD, the `:login`/`:logout` custom
 * methods, and the `me` alias — port of pkg/user. Passwords are bcrypt
 * hashes; verifyPassword handles both Go's $2a$ and the newer $2b$ variants.
 */

import { errorResponse, isUniqueConstraintError, jsonResponse } from './errors';
import { generateId, generateToken, nowRFC3339 } from './ids';
import { patLookupKey } from './pat';
import { hashPassword, verifyPassword } from './password';
import type { Database } from './sqlite';
import type { User } from './types';
import { TYPE_REGULAR, TYPE_SUPERUSER } from './types';
import type { SyncDispatcher } from '../sync';

// Re-exported for callers that hash alongside user writes (bootstrap, tests).
export { hashPassword, verifyPassword };

export function createUserTables(db: Database): void {
  db.run(`CREATE TABLE IF NOT EXISTS _users (
		id TEXT PRIMARY KEY,
		path TEXT UNIQUE NOT NULL,
		email TEXT UNIQUE NOT NULL,
		display_name TEXT NOT NULL DEFAULT '',
		type TEXT NOT NULL,
		password_hash TEXT NOT NULL,
		create_time TEXT NOT NULL,
		update_time TEXT NOT NULL
	)`);
  db.run(`CREATE TABLE IF NOT EXISTS _tokens (
		token TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		create_time TEXT NOT NULL,
		expires_at TEXT
	)`);
  // Upgrade older databases whose _tokens predates the expiry column. A row's
  // NULL expires_at means "never expires" — the semantics existing tokens
  // already have — so this migration is transparent to live sessions.
  ensureColumn(db, '_tokens', 'expires_at', 'TEXT');
  // pat_id links a token row to its personal-access-token record (NULL for
  // ordinary login/OAuth tokens). It's what marks a bearer token as a PAT so
  // enforcement can attenuate the caller down to that token's assigned grants.
  ensureColumn(db, '_tokens', 'pat_id', 'TEXT');
}

/** Add a column if the table doesn't already have it (idempotent migration). */
function ensureColumn(db: Database, table: string, column: string, decl: string): void {
  const cols = db.query(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

interface UserRow {
  id: string;
  path: string;
  email: string;
  display_name: string;
  type: string;
  password_hash?: string;
  create_time: string;
  update_time: string;
}

function rowToUser(row: UserRow, patId?: string | null): User {
  const u: User = {
    id: row.id,
    path: row.path,
    email: row.email,
    type: row.type,
    create_time: row.create_time,
    update_time: row.update_time,
  };
  if (row.display_name) u.display_name = row.display_name;
  if (patId) u.pat = { id: patId };
  return u;
}

const USER_COLS = 'id, path, email, display_name, type, create_time, update_time';

export function getUserById(db: Database, id: string): { user: User; hash: string } | null {
  const row = db
    .query(`SELECT ${USER_COLS}, password_hash FROM _users WHERE id = ?`)
    .get(id) as UserRow | null;
  return row ? { user: rowToUser(row), hash: row.password_hash! } : null;
}

export function getUserByEmail(db: Database, email: string): { user: User; hash: string } | null {
  const row = db
    .query(`SELECT ${USER_COLS}, password_hash FROM _users WHERE email = ?`)
    .get(email) as UserRow | null;
  return row ? { user: rowToUser(row), hash: row.password_hash! } : null;
}

export function getUserByToken(db: Database, token: string): User | null {
  // An access token is valid only while unexpired. NULL expires_at = never
  // expires (leased admin mints, and every token issued before the expiry
  // column existed). RFC3339 UTC timestamps of identical width compare
  // correctly as strings. PAT secrets are stored hashed, so hash the presented
  // value before the lookup (patLookupKey is a no-op for ordinary tokens).
  const row = db
    .query(
      `SELECT u.id, u.path, u.email, u.display_name, u.type, u.create_time, u.update_time, t.pat_id AS pat_id FROM _users u INNER JOIN _tokens t ON u.id = t.user_id WHERE t.token = ? AND (t.expires_at IS NULL OR t.expires_at > ?)`,
    )
    .get(patLookupKey(token), nowRFC3339()) as (UserRow & { pat_id: string | null }) | null;
  return row ? rowToUser(row, row.pat_id) : null;
}

export function countUsers(db: Database): number {
  const row = db.query('SELECT COUNT(*) AS n FROM _users').get() as { n: number };
  return row.n;
}

export function insertUser(db: Database, u: User, passwordHash: string): void {
  db.query(
    'INSERT INTO _users (id, path, email, display_name, type, password_hash, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    u.id,
    u.path,
    u.email,
    u.display_name ?? '',
    u.type,
    passwordHash,
    u.create_time,
    u.update_time,
  );
}

/**
 * Insert an access token. `expiresAt` is an RFC3339 UTC timestamp after which
 * the token stops validating; pass null (the default) for a token that never
 * expires — used by the leased admin mints and by every caller predating the
 * auth service.
 */
export function insertToken(
  db: Database,
  token: string,
  userId: string,
  expiresAt: string | null = null,
  patId: string | null = null,
): void {
  db.query(
    'INSERT INTO _tokens (token, user_id, create_time, expires_at, pat_id) VALUES (?, ?, ?, ?, ?)',
  ).run(token, userId, nowRFC3339(), expiresAt, patId);
}

/** Raw token row (used by the auth service to distinguish expired from absent). */
export function getTokenRecord(
  db: Database,
  token: string,
): { user_id: string; expires_at: string | null; pat_id: string | null } | null {
  return db
    .query('SELECT user_id, expires_at, pat_id FROM _tokens WHERE token = ?')
    .get(patLookupKey(token)) as
    | { user_id: string; expires_at: string | null; pat_id: string | null }
    | null;
}

export function deleteToken(db: Database, token: string): void {
  db.query('DELETE FROM _tokens WHERE token = ?').run(patLookupKey(token));
}

/** Delete the token row backing a PAT record (revocation). */
export function deleteTokenByPatId(db: Database, patId: string): void {
  db.query('DELETE FROM _tokens WHERE pat_id = ?').run(patId);
}

export function extractBearerToken(req: Request): string {
  const auth = req.headers.get('authorization');
  if (!auth) return '';
  const prefix = 'bearer ';
  if (auth.length < prefix.length || auth.slice(0, prefix.length).toLowerCase() !== prefix) {
    return '';
  }
  return auth.slice(prefix.length).trim();
}

// --- handlers ---

export async function handleLogin(db: Database, req: Request): Promise<Response> {
  let body: { email?: string; password?: string };
  try {
    body = (await req.json()) as { email?: string; password?: string };
  } catch {
    return errorResponse(400, 'invalid JSON body');
  }
  if (!body.email || !body.password) {
    return errorResponse(400, 'email and password are required');
  }

  const found = getUserByEmail(db, body.email);
  if (!found) return errorResponse(401, 'invalid email or password');

  const ok = await verifyPassword(body.password, found.hash);
  if (!ok) return errorResponse(401, 'invalid email or password');

  const token = generateToken();
  insertToken(db, token, found.user.id);
  return jsonResponse({ token, user: found.user });
}

export function handleLogout(db: Database, req: Request): Response {
  const token = extractBearerToken(req);
  if (!token) return errorResponse(401, 'missing Authorization header');
  deleteToken(db, token);
  return jsonResponse({});
}

export async function handleUserCreate(
  db: Database,
  req: Request,
  caller: User | null,
  syncDispatcher: SyncDispatcher | null = null,
): Promise<Response> {
  if (!caller || caller.type !== TYPE_SUPERUSER) {
    return errorResponse(403, 'only superusers can create users');
  }

  let body: { email?: string; display_name?: string; password?: string; type?: string };
  try {
    body = (await req.json()) as {
      email?: string;
      display_name?: string;
      password?: string;
      type?: string;
    };
  } catch {
    return errorResponse(400, 'invalid JSON body');
  }
  if (!body.email) return errorResponse(400, 'email is required');
  if (!body.password) return errorResponse(400, 'password is required');
  const type = body.type || TYPE_REGULAR;
  if (type !== TYPE_SUPERUSER && type !== TYPE_REGULAR) {
    return errorResponse(400, `type must be "${TYPE_SUPERUSER}" or "${TYPE_REGULAR}"`);
  }

  const hash = await hashPassword(body.password);
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || generateId();
  const now = nowRFC3339();
  const u: User = {
    id,
    path: `users/${id}`,
    email: body.email,
    display_name: body.display_name,
    type,
    create_time: now,
    update_time: now,
  };

  try {
    insertUser(db, u, hash);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return errorResponse(409, 'a user with that email or id already exists');
    }
    return errorResponse(500, `failed to create user: ${err instanceof Error ? err.message : err}`);
  }
  // Post-commit mirror. `u` is the User wire shape (no password_hash), so the
  // hash is never handed to a sync handler. Fire-and-forget.
  syncDispatcher?.dispatch({
    event: 'create',
    resource: 'user',
    recordId: u.id,
    record: { ...u },
    previous: null,
  });
  return jsonResponse(u);
}

export function handleUserGet(db: Database, id: string, caller: User | null): Response {
  if (!caller) return errorResponse(401, 'authentication required');
  // "me" is a whoami for clients that only hold a token (e.g. post-OAuth).
  if (id === 'me') id = caller.id;
  if (caller.type !== TYPE_SUPERUSER && caller.id !== id) {
    return errorResponse(403, 'you can only view your own user');
  }
  const found = getUserById(db, id);
  if (!found) return errorResponse(404, `user "${id}" not found`);
  return jsonResponse(found.user);
}

export function handleUserList(db: Database, req: Request, caller: User | null): Response {
  if (!caller || caller.type !== TYPE_SUPERUSER) {
    return errorResponse(403, 'only superusers can list users');
  }

  const url = new URL(req.url);
  let pageSize = 50;
  const ps = url.searchParams.get('max_page_size');
  if (ps) {
    const n = parseInt(ps, 10);
    if (!Number.isNaN(n) && n > 0) pageSize = Math.min(n, 1000);
  }
  const pageToken = url.searchParams.get('page_token') ?? '';

  const whereClauses: string[] = [];
  const args: string[] = [];
  if (pageToken !== '') {
    try {
      const cursor = Buffer.from(pageToken, 'base64').toString('utf8');
      if (cursor !== '') {
        whereClauses.push('id > ?');
        args.push(cursor);
      }
    } catch {
      // ignored
    }
  }
  const where = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

  const rows = db
    .query(`SELECT ${USER_COLS} FROM _users${where} ORDER BY id LIMIT ?`)
    .all(...args, pageSize + 1) as UserRow[];
  let results = rows.map((r) => rowToUser(r));

  let nextPageToken = '';
  if (results.length > pageSize) {
    nextPageToken = Buffer.from(results[pageSize - 1]!.id, 'utf8').toString('base64');
    results = results.slice(0, pageSize);
  }

  const resp: Record<string, unknown> = { results };
  if (nextPageToken !== '') resp.next_page_token = nextPageToken;
  return jsonResponse(resp);
}

export async function handleUserUpdate(
  db: Database,
  req: Request,
  id: string,
  caller: User | null,
  syncDispatcher: SyncDispatcher | null = null,
): Promise<Response> {
  if (!caller) return errorResponse(401, 'authentication required');
  if (caller.type !== TYPE_SUPERUSER && caller.id !== id) {
    return errorResponse(403, 'only superusers can update other users');
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, 'invalid JSON body');
  }

  const fields: Record<string, string> = {};
  if (typeof body.email === 'string' && body.email !== '') fields.email = body.email;
  if (typeof body.display_name === 'string') fields.display_name = body.display_name;
  if (typeof body.type === 'string' && body.type !== '') {
    if (caller.type !== TYPE_SUPERUSER) {
      return errorResponse(403, 'only superusers can change user type');
    }
    if (body.type !== TYPE_SUPERUSER && body.type !== TYPE_REGULAR) {
      return errorResponse(400, `type must be "${TYPE_SUPERUSER}" or "${TYPE_REGULAR}"`);
    }
    fields.type = body.type;
  }
  if (typeof body.password === 'string' && body.password !== '') {
    fields.password_hash = await hashPassword(body.password);
  }

  if (Object.keys(fields).length === 0) {
    return errorResponse(400, 'no updatable fields provided');
  }

  // Capture the pre-state (User wire shape, no hash) for the sync's `previous`,
  // before the UPDATE runs. Only read when a dispatcher is wired.
  const preUser = syncDispatcher ? getUserById(db, id)?.user ?? null : null;

  const setClauses = ['update_time = ?'];
  const args: string[] = [nowRFC3339()];
  for (const [col, val] of Object.entries(fields)) {
    setClauses.push(`${col} = ?`);
    args.push(val);
  }
  args.push(id);
  try {
    db.query(`UPDATE _users SET ${setClauses.join(', ')} WHERE id = ?`).run(...args);
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      return errorResponse(409, 'a user with that email already exists');
    }
    return errorResponse(500, `failed to update user: ${err instanceof Error ? err.message : err}`);
  }

  const found = getUserById(db, id);
  if (!found) return errorResponse(404, `user "${id}" not found`);
  // Post-commit mirror. Both record and previous are User wire shapes (no
  // password_hash). Fire-and-forget.
  syncDispatcher?.dispatch({
    event: 'update',
    resource: 'user',
    recordId: id,
    record: { ...found.user },
    previous: preUser ? { ...preUser } : null,
  });
  return jsonResponse(found.user);
}

export function handleUserDelete(
  db: Database,
  id: string,
  caller: User | null,
  syncDispatcher: SyncDispatcher | null = null,
): Response {
  if (!caller || caller.type !== TYPE_SUPERUSER) {
    return errorResponse(403, 'only superusers can delete users');
  }

  // Read the pre-state (User wire shape, no hash) before the DELETE — the row
  // is gone afterwards. Only read when a dispatcher is wired.
  const preUser = syncDispatcher ? getUserById(db, id)?.user ?? null : null;

  db.query('DELETE FROM _tokens WHERE user_id = ?').run(id);
  const result = db.query('DELETE FROM _users WHERE id = ?').run(id);
  if (result.changes === 0) {
    return errorResponse(404, `user "${id}" not found`);
  }
  // Post-commit mirror. `record` is null on delete; `previous` carries the
  // removed user (no password_hash). Fire-and-forget. Preserves the 200 {}
  // response unchanged.
  syncDispatcher?.dispatch({
    event: 'delete',
    resource: 'user',
    recordId: id,
    record: null,
    previous: preUser ? { ...preUser } : null,
  });
  return jsonResponse({});
}
