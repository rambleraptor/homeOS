/**
 * Escalation conformance: does a narrow credential *stay* narrow?
 *
 * The matrix in `matrix.test.ts` asks whether the surfaces agree with each
 * other. These tests ask the prior question — whether a credential's scope is a
 * boundary at all, or only a boundary in the places that happen to check it.
 * Four places had to be made to hold it, and each is pinned here:
 *
 *  1. **The user subtree.** `router.ts` skips the owner-side grant pass for
 *     resources parented to `user`, because owner visibility would wrongly hide
 *     a record created *for* a user by someone else. The credential ceiling is
 *     a separate question and must not be skipped with it.
 *
 *  2. **Token minting.** `/api/tokens` bounds a new token by its *owner's*
 *     authority, which says nothing about the credential doing the minting, so
 *     minting is reserved for interactive sessions.
 *
 *  3. **Externally-authenticated MCP callers.** The route mints a token for an
 *     identity a gateway authenticator resolved; that token has to carry the
 *     identity's scope, or filtering the tool list by it decides nothing.
 *
 *  4. **Custom methods.** The dispatcher authenticates and nothing more, so the
 *     ceiling reaches a handler only through the token it forwards.
 *
 * The first two chain: without them, any leaked read-only credential became
 * full account access.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { Hono } from 'hono';
import { call } from '../engine/helpers';
import { makeMcpRoute } from '../../src/routes/mcp';
import { MCP_SCOPE_READ } from '../../src/auth/scopes';
import { mintTokenForUser } from '../../src/bootstrap';
import { getAccessTokenBinding } from '../../src/auth/storage';
import { dispatchCustomMethod } from '@rambleraptor/homestead-core/resources/custom-methods/dispatcher';
import { authenticate } from '@rambleraptor/homestead-core/server/aepbase';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import type { CustomMethodContext } from '@rambleraptor/homestead-core/resources/types';
import type { RequestAuthenticator } from '../../src/auth/authenticator';
import {
  AUTH_CFG,
  BOOK_DEF,
  definePatResource,
  makeConformanceHarness,
  mintPatWithScope,
  verdictFromError,
  verdictOf,
  type ConformanceHarness,
  type Verdict,
} from './harness';

let h: ConformanceHarness;

beforeEach(async () => {
  h = await makeConformanceHarness();
  await definePatResource(h.t);
});

afterEach(() => {
  h?.dispose();
});

describe('a scoped credential inside its owner’s user subtree', () => {
  test('a read-only PAT cannot write to a user-parented collection', async () => {
    const pat = h.credentials['pat-read']!;

    // Control: the same token is correctly refused on a top-level collection,
    // so any difference below is about the resource's shape, not the token.
    const topLevel = await call(h.t.engine, 'POST', '/books', {
      token: pat.token,
      body: { title: 'refused' },
    });
    expect(verdictOf(topLevel.status)).toBe('deny');

    // The same refusal must hold inside the owner's own subtree. A token
    // scoped to read one collection has no grant that authorizes this write.
    const subtree = await call(
      h.t.engine,
      'POST',
      `/users/${pat.userId}/personal-access-tokens`,
      { token: pat.token, body: { name: 'escalated', token_prefix: 'hsd_pat_aaaaaa' } },
    );
    expect(
      verdictOf(subtree.status),
      'a read-scoped PAT wrote into its owner’s user subtree — the token-side ' +
        'grant intersection is not applied to user-parented resources',
    ).toBe('deny');
  });

  test('a read-only OAuth token cannot write to a user-parented collection', async () => {
    const oauth = h.credentials['oauth-read']!;
    const res = await call(
      h.t.engine,
      'POST',
      `/users/${oauth.userId}/personal-access-tokens`,
      { token: oauth.token, body: { name: 'escalated', token_prefix: 'hsd_pat_bbbbbb' } },
    );
    expect(verdictOf(res.status)).toBe('deny');
  });
});

describe('minting a token is bounded by the minting credential', () => {
  /** Ask `/api/tokens` for a token with blanket manage-everything authority. */
  async function mintUnrestricted(token: string, name: string): Promise<Response> {
    return h.tokens.request('/api/tokens', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        scopes: [{ capability: 'manage', target_scope: 'all' }],
      }),
    });
  }

  test('a read-only PAT cannot mint a broader token', async () => {
    const res = await mintUnrestricted(h.credentials['pat-read']!.token, 'escalated-pat');
    expect(
      verdictOf(res.status),
      'a read-scoped PAT minted a manage-everything token for its owner — ' +
        'minting is bounded by the owner’s authority, not the caller’s',
    ).toBe('deny');
  });

  test('a read-only OAuth token cannot mint a broader token', async () => {
    const res = await mintUnrestricted(h.credentials['oauth-read']!.token, 'escalated-oauth');
    expect(
      verdictOf(res.status),
      'a homestead:read OAuth token minted a manage-everything PAT — the MCP ' +
        'read scope is a tool filter, not an authorization boundary',
    ).toBe('deny');
  });

  test('even a manage-everything PAT cannot mint a token', async () => {
    // The engine-level ceiling would already stop a *narrow* token here, so this
    // pins the route's own rule independently: minting is reserved for an
    // interactive session, and a delegated credential is refused however broadly
    // it was scoped. Without this, widening the grants on a PAT would quietly
    // hand it the ability to mint successors.
    const broad = await mintPatWithScope(h, 'pat-broad', 'manage', 'all');
    const res = await mintUnrestricted(broad, 'escalated-broad');
    expect(verdictOf(res.status)).toBe('deny');
  });

  test('an ordinary session can still mint a token', async () => {
    // The guard above must not break the legitimate path: a user logged in
    // interactively is exactly who is supposed to be creating tokens.
    const res = await mintUnrestricted(h.credentials.session!.token, 'legitimate');
    expect(res.status).toBe(201);
  });
});

describe('an externally-authenticated MCP caller', () => {
  /**
   * An authenticator that resolves every request to the harness user with a
   * fixed scope. Stands in for a gateway provider (Cloudflare Access and
   * friends) that reports a *scoped* identity — none in the tree does today,
   * which is exactly why this needs a test: the route mints a fresh token for
   * such a caller, and a token minted without that scope would be unattenuated
   * at every door while the tool list pretended otherwise.
   */
  function scopedAuthenticator(email: string, scope: string): RequestAuthenticator {
    return {
      name: 'test-scoped-gateway',
      authenticate: async () => ({ email, scope }),
    };
  }

  test('a scoped identity maps to a token the engine holds to that scope', async () => {
    // The token the route would mint for such a caller. Asserting on it
    // directly, rather than through a tools/call, is deliberate: a read scope
    // leaves `create_book` unregistered, so an MCP write comes back as an error
    // whether or not the credential itself is bounded. The question here is
    // what the credential can do at the door MCP *doesn't* guard.
    const minted = mintTokenForUser(h.t.engine.db, h.userId, MCP_SCOPE_READ);
    try {
      const read = await call(h.t.engine, 'GET', '/books', { token: minted.token });
      expect(verdictOf(read.status)).toBe('allow');

      const write = await call(h.t.engine, 'POST', '/books', {
        token: minted.token,
        body: { title: 'nope' },
      });
      expect(
        verdictOf(write.status),
        'a token minted for a read-scoped external identity could still write — ' +
          'the identity\u2019s scope is not reaching the minted credential',
      ).toBe('deny');
    } finally {
      minted.revoke();
    }
  });

  test('revoking a scoped mint leaves no binding behind', async () => {
    const minted = mintTokenForUser(h.t.engine.db, h.userId, MCP_SCOPE_READ);
    expect(getAccessTokenBinding(h.t.engine.db, minted.token)?.scope).toBe(MCP_SCOPE_READ);
    minted.revoke();
    expect(getAccessTokenBinding(h.t.engine.db, minted.token)).toBeNull();
  });

  test('the route accepts a scoped identity and serves its in-scope tools', async () => {
    const app = new Hono();
    app.route(
      '/api/mcp',
      makeMcpRoute(h.t.engine, AUTH_CFG, () => [BOOK_DEF], {
        authenticators: [scopedAuthenticator('member@example.com', MCP_SCOPE_READ)],
      }),
    );
    const res = await app.request('/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'read_book', arguments: {} },
      }),
    });
    expect(res.status).toBe(200);
    // Proves the identity mapped to a real user and the minted token worked —
    // without which the scope assertions above would be vacuous.
    expect(await res.text()).not.toContain('isError');
  });
});

describe('the custom-method door', () => {
  /**
   * AEP-136 custom methods are dispatched after an authentication check and
   * nothing else — the dispatcher has no notion of authorization, so a handler's
   * authority is whatever the token it was handed can do. That makes the ceiling
   * transitive rather than enforced *here*, which holds only while handlers do
   * their writes with the caller's own token.
   *
   * This pins that: a handler faithfully using `serverClient(ctx.auth.token)` is
   * bounded by the credential, so a read-scoped token cannot write through a
   * custom method. It does *not* pin the general case — a handler that mints its
   * own admin token still escapes, and no test can catch that from out here.
   */
  async function invokeWriter(token: string): Promise<Verdict> {
    let handlerVerdict: Verdict | undefined;
    const res = await dispatchCustomMethod({
      request: new Request('http://localhost:8090/api/aep/books:stock', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      }),
      path: '/books:stock',
      resolveMethod: (plural, verb) =>
        plural === 'books' && verb === 'stock'
          ? {
              target: 'collection' as const,
              description: 'Add a book to the shelf.',
              request: { type: 'object', properties: {} },
              load: async () => ({
                default: async (ctx: CustomMethodContext) => {
                  try {
                    await serverClient(ctx.auth.token)
                      .collection('books')
                      .create({ title: 'via custom method' });
                    handlerVerdict = 'allow';
                  } catch (err) {
                    // HomesteadError surfaces the engine's code, not `.status`.
                    handlerVerdict = verdictFromError((err as Error).message);
                  }
                  return Response.json({ ok: handlerVerdict === 'allow' });
                },
              }),
            }
          : undefined,
      authenticate,
      passthrough: async () => new Response('not dispatched', { status: 500 }),
    });
    expect(res.status).toBe(200); // the method itself dispatched
    if (!handlerVerdict) throw new Error('handler never ran');
    return handlerVerdict;
  }

  test('a write-scoped credential writes through a custom method', async () => {
    expect(await invokeWriter(h.credentials['oauth-write']!.token)).toBe('allow');
  });

  test('a read-scoped credential is refused inside the handler', async () => {
    expect(
      await invokeWriter(h.credentials['oauth-read']!.token),
      'a read-scoped token wrote through a custom method — the credential ' +
        'ceiling is not reaching writes made with the forwarded token',
    ).toBe('deny');
  });
});
