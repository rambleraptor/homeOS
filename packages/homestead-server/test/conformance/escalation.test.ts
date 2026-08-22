/**
 * Escalation conformance: does a narrow credential *stay* narrow?
 *
 * The matrix in `matrix.test.ts` asks whether the surfaces agree with each
 * other. These tests ask the prior question — whether a credential's scope is a
 * boundary at all, or only a boundary in the places that happen to check it.
 * Two places currently do not:
 *
 *  1. **The user subtree.** `router.ts` skips grant enforcement for resources
 *     parented to `user`, because owner-visibility would wrongly hide a record
 *     created *for* a user by someone else. That reasoning is about the
 *     owner-side pass; it takes the token-side intersection down with it.
 *
 *  2. **Token minting.** `/api/tokens` authenticates the caller and then writes
 *     the new token's grants as an admin. It bounds the new token by its
 *     *owner's* authority, never by the authority of the credential doing the
 *     minting — so a narrow credential can mint a broad one for the same user.
 *
 * Chained, those two turn any leaked read-only credential into full account
 * access, which is why they are tested as one concern.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { call } from '../engine/helpers';
import {
  definePatResource,
  makeConformanceHarness,
  mintPatWithScope,
  verdictOf,
  type ConformanceHarness,
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
