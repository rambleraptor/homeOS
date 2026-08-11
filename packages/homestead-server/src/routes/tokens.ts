/**
 * `/api/tokens/*` — personal access token (PAT) management.
 *
 *   - `POST /`        — mint a token: creates the metadata record, its bearer
 *                       secret (stored hashed in `_tokens`), and one
 *                       `access-grant` per requested scope (subject_type =
 *                       'token'). Returns the plaintext secret exactly once.
 *   - `DELETE /:id`   — revoke a token: tears down the record, the `_tokens`
 *                       row, and every grant addressed to it.
 *
 * A PAT's authority is expressed entirely in the ordinary grant vocabulary, and
 * enforced at request time as the intersection of the token's grants with the
 * owner's own access (see engine/enforce.ts). So a token can never do more than
 * its owner can, no matter what scopes were requested here — this route only
 * validates scope *shape*; the runtime intersection is the security guarantee.
 *
 * Token-subject grants are written here with a leased admin token (the public
 * grants API rejects them — see enforceGrantWrite), which is why minting has to
 * be a dedicated server route rather than plain client CRUD.
 */

import { Hono } from 'hono';
import { authenticate, type AuthResult } from '@rambleraptor/homestead-core/server/aepbase';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { USERS, PERSONAL_ACCESS_TOKENS } from '@rambleraptor/homestead-core/resources/builtins';
import { ACCESS_GRANTS } from '@rambleraptor/homestead-core/permissions/resources';
import type { Engine } from '../engine/engine';
import { mintAdminToken } from '../bootstrap';
import { insertToken, deleteTokenByPatId } from '../engine/users';
import { generatePatSecret, patDisplayPrefix } from '../engine/pat';

/** Auth resolver, injectable so the route can be tested without loopback auth. */
export type AuthFn = (request: Request) => Promise<AuthResult | null>;

const CAPABILITIES = new Set(['read', 'write', 'manage']);
const TOKEN_SCOPES = new Set(['all', 'app', 'collection']);

/** One scope a PAT is granted: a capability over a target. */
interface TokenScope {
  capability: string;
  target_scope: string;
  target_app?: string;
  resource_type?: string;
  filter?: string;
  effect?: string;
}

/** Validate a requested scope's shape; returns an error message or null. */
function scopeError(s: unknown): string | null {
  if (!s || typeof s !== 'object') return 'each scope must be an object';
  const scope = s as Record<string, unknown>;
  if (typeof scope.capability !== 'string' || !CAPABILITIES.has(scope.capability)) {
    return 'scope.capability must be one of read, write, manage';
  }
  if (typeof scope.target_scope !== 'string' || !TOKEN_SCOPES.has(scope.target_scope)) {
    return 'scope.target_scope must be one of all, app, collection';
  }
  if (scope.target_scope === 'app' && typeof scope.target_app !== 'string') {
    return "an 'app' scope needs target_app";
  }
  if (scope.target_scope === 'collection' && typeof scope.resource_type !== 'string') {
    return "a 'collection' scope needs resource_type";
  }
  return null;
}

/** Normalize an ISO timestamp to the engine's RFC3339 (seconds, no millis). */
function normalizeExpiry(value: unknown): string | null {
  if (typeof value !== 'string' || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function makeTokensRoute(engine: Engine, authFn: AuthFn = authenticate): Hono {
  const app = new Hono();

  app.post('/', async (c) => {
    const auth = await authFn(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);

    let body: { name?: unknown; expires_at?: unknown; scopes?: unknown };
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      return c.json({ error: 'invalid JSON body' }, 400);
    }

    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return c.json({ error: 'name is required' }, 400);

    const rawScopes = Array.isArray(body.scopes) ? body.scopes : [];
    for (const s of rawScopes) {
      const err = scopeError(s);
      if (err) return c.json({ error: err }, 400);
    }
    const scopes = rawScopes as TokenScope[];
    const expiresAt = normalizeExpiry(body.expires_at);

    const secret = generatePatSecret();
    const hs = serverClient(auth.token);

    // The metadata record, owned by the caller (owner-RLS keeps it private).
    let record: { id: string };
    try {
      record = (await hs
        .collection(USERS)
        .record(auth.user.id)
        .collection<{ id: string }>(PERSONAL_ACCESS_TOKENS)
        .create({
          name,
          token_prefix: patDisplayPrefix(secret),
          expires_at: expiresAt ?? undefined,
          scopes,
        })) as { id: string };
    } catch (err) {
      return c.json(
        { error: `failed to create token: ${err instanceof Error ? err.message : String(err)}` },
        403,
      );
    }

    // The bearer secret, linked to the record via pat_id. insertToken hashes it
    // at rest, so only the one-time plaintext `secret` returned below is usable.
    insertToken(engine.db, secret, auth.user.id, expiresAt, record.id);

    // One access-grant per scope, addressed to the token. Written as the leased
    // admin because the public grants API forbids token-subject grants.
    if (scopes.length > 0) {
      const admin = mintAdminToken(engine.db);
      try {
        const grants = serverClient(admin.token).collection(ACCESS_GRANTS);
        for (const scope of scopes) {
          await grants.create({
            subject_type: 'token',
            subject_id: record.id,
            capability: scope.capability,
            effect: scope.effect === 'deny' ? 'deny' : 'allow',
            target_scope: scope.target_scope,
            target_app: scope.target_app,
            resource_type: scope.resource_type,
            filter: scope.target_scope === 'collection' ? scope.filter : undefined,
          });
        }
      } finally {
        admin.revoke();
      }
    }

    engine.reloadPermissions();
    return c.json({ token: secret, id: record.id }, 201);
  });

  app.delete('/:id', async (c) => {
    const auth = await authFn(c.req.raw);
    if (!auth) return c.json({ error: 'authentication required' }, 401);
    const id = c.req.param('id');

    const hs = serverClient(auth.token);
    const tokenRecord = hs
      .collection(USERS)
      .record(auth.user.id)
      .collection(PERSONAL_ACCESS_TOKENS)
      .record(id);

    // Owner-RLS: the caller can only read (and therefore delete) their own
    // tokens. A miss is a 404 rather than leaking another user's token id.
    try {
      await tokenRecord.get();
    } catch {
      return c.json({ error: 'token not found' }, 404);
    }

    await tokenRecord.delete();
    deleteTokenByPatId(engine.db, id);
    try {
      engine.db
        .query(`DELETE FROM access_grants WHERE subject_type = 'token' AND subject_id = ?`)
        .run(id);
    } catch {
      // access_grants absent (no grants ever created) → nothing to clean up.
    }

    engine.reloadPermissions();
    return c.json({});
  });

  return app;
}
