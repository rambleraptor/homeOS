/**
 * Credential-conformance matrix.
 *
 * Homestead has one enforcement point (`engine/enforce.ts`) and several doors
 * into it: engine CRUD, the `/api/aep` gateway (the CLI's and the SPA's door),
 * the AI chat's tool executor, and the MCP server. The invariant this file
 * exists to defend is simple:
 *
 *   **A credential's authority is a property of the credential, not of the
 *   surface it is presented to.**
 *
 * So for every (credential, operation) pair, every surface that *accepts* the
 * credential must reach the same allow/deny verdict. A surface may legitimately
 * refuse a credential outright (`unauthenticated` — MCP only takes
 * audience-bound OAuth tokens, for instance); that is a statement about which
 * door the credential fits, not about what it may do once inside, so those rows
 * are excluded from the agreement check and asserted separately.
 *
 * When this file fails, it is telling you that one door enforces something the
 * others do not — which means the thing it enforces is a suggestion, and the
 * other doors are the real permission model.
 */

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  SURFACES,
  makeConformanceHarness,
  type ConformanceHarness,
  type Credential,
  type Verdict,
} from './harness';

/** Operations the matrix exercises against the shared `book` collection. */
const OPERATIONS = ['read', 'write'] as const;
type Operation = (typeof OPERATIONS)[number];

/**
 * The credentials under test, and what each one's scope *says* it may do.
 * `expected` is the intent the credential was minted with — the matrix checks
 * both that the surfaces agree with each other and that they agree with this.
 */
const EXPECTED: Record<string, Record<Operation, Verdict>> = {
  // An ordinary login: full authority of its user under the open baseline.
  session: { read: 'allow', write: 'allow' },
  // A PAT granted `read` on `book` and nothing else.
  'pat-read': { read: 'allow', write: 'deny' },
  // A PAT granted `write` on `book` (write implies read in the capability order).
  'pat-write': { read: 'allow', write: 'allow' },
  // An OAuth token the client authorized for `homestead:read` only.
  'oauth-read': { read: 'allow', write: 'deny' },
  // An OAuth token authorized for `homestead:write`.
  'oauth-write': { read: 'allow', write: 'allow' },
  // Break-glass.
  superuser: { read: 'allow', write: 'allow' },
};

let h: ConformanceHarness;

beforeEach(async () => {
  h = await makeConformanceHarness();
});

afterEach(() => {
  h?.dispose();
});

/** Run one operation across every surface, keyed by surface name. */
async function sweep(
  credential: Credential,
  op: Operation,
): Promise<Record<string, Verdict>> {
  const out: Record<string, Verdict> = {};
  for (const surface of SURFACES) {
    out[surface.name] = await surface[op](h, credential);
  }
  return out;
}

/** Render a sweep as a stable one-line summary for failure messages. */
function describeSweep(results: Record<string, Verdict>): string {
  return Object.entries(results)
    .map(([surface, verdict]) => `${surface}=${verdict}`)
    .join(' ');
}

describe('credential conformance across downstream surfaces', () => {
  for (const label of Object.keys(EXPECTED)) {
    for (const op of OPERATIONS) {
      test(`${label} / ${op}: every surface that accepts it agrees`, async () => {
        const credential = h.credentials[label]!;
        const results = await sweep(credential, op);

        // Surfaces that refused the credential outright are a separate question
        // (see the authentication-reach test below), so drop them here.
        const answering = Object.entries(results).filter(
          ([, verdict]) => verdict !== 'unauthenticated',
        );
        expect(
          answering.length,
          `no surface accepted ${label} — ${describeSweep(results)}`,
        ).toBeGreaterThan(0);

        const distinct = new Set(answering.map(([, verdict]) => verdict));
        expect(
          [...distinct],
          `surfaces disagree for ${label}/${op} — ${describeSweep(results)}`,
        ).toHaveLength(1);

        expect(
          [...distinct][0],
          `wrong verdict for ${label}/${op} — ${describeSweep(results)}`,
        ).toBe(EXPECTED[label]![op]);
      });
    }
  }

  test('MCP accepts only audience-bound OAuth tokens', async () => {
    // Not a permission statement — a statement about which door each credential
    // fits. Asserted explicitly so the exclusion above stays honest: if MCP ever
    // starts accepting a session token or a PAT, that credential rejoins the
    // agreement check and this test is what tells you it happened.
    const reach: Record<string, Verdict> = {};
    for (const label of Object.keys(EXPECTED)) {
      reach[label] = await SURFACES.find((s) => s.name === 'mcp')!.read(
        h,
        h.credentials[label]!,
      );
    }
    expect(reach['oauth-read']).not.toBe('unauthenticated');
    expect(reach['oauth-write']).not.toBe('unauthenticated');
    expect(reach.session).toBe('unauthenticated');
    expect(reach['pat-read']).toBe('unauthenticated');
    expect(reach['pat-write']).toBe('unauthenticated');
    expect(reach.superuser).toBe('unauthenticated');
  });
});
