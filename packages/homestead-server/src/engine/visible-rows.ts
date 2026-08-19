/**
 * Which collections the caller can currently see at least one row of.
 *
 * The sidebar wants to hide an app the viewer can't use. "Can you read the
 * collection?" is the cheap answer and it's right almost always — but it's the
 * wrong answer for a collection reached through a *filtered* grant (the
 * documents app: you may read your own rows, not the household's). There the
 * grant set alone can't tell "no access" from "access, nothing to show", and the
 * client resolver deliberately refuses to guess: `canWith` passes no
 * `filterEval`, so a filtered grant never matches client-side.
 *
 * So this fills exactly that gap, and only that gap. For each collection it
 * first asks the question the *client* will ask — `resolve()` with no filter
 * evaluation. When the client will already say yes, there is nothing to add and
 * no query runs. Only for the collections it would say no to do we ask the
 * database whether a row is actually visible, reusing the same
 * `listVisibilityClause` that governs LIST so the two can't disagree.
 *
 * The cost therefore scales with how *restricted* a caller is, not with how much
 * data exists: a household member with ordinary access triggers one query per
 * private collection (today: two), and every query is `LIMIT 1` against an
 * indexed `_owner` (see `db.ts`), so it stops at the first hit.
 */

import type { Database } from './sqlite';
import { sanitizeTableName } from './db';
import { listVisibilityClause, type EnforceContext } from './enforce';
import { resolve } from './permissions';
import { TYPE_SUPERUSER, type User } from './types';
import type { Registry } from './registry';

/**
 * Collection singulars the caller has at least one visible row of, limited to
 * those a purely grant-based check would report as unreachable.
 *
 * Returns an empty list for a superuser (the client short-circuits them to full
 * access, so nothing here would be read) and for an unauthenticated caller.
 */
export function collectionsWithVisibleRows(
  ctx: EnforceContext,
  db: Database,
  registry: Registry,
  caller: User | null,
): string[] {
  if (!caller || caller.type === TYPE_SUPERUSER) return [];

  const gathered = ctx.store.gatherFor(caller.id);
  const out: string[] = [];

  for (const resource of registry.all()) {
    // User-parented resources never reach the grant system — `checkUserScope`
    // governs them by path — and singletons have no rows to count.
    if (resource.parents.includes('user') || resource.singleton) continue;

    // The question the client will ask: `resolve()` with no `filterEval`. When
    // it allows, the client already shows the app and we skip the query.
    const clientDecision = resolve(
      { isSuperuser: false },
      {
        verb: 'read',
        resourceType: resource.singular,
        appId: ctx.appIdFor(resource.plural),
      },
      gathered.principals,
      gathered.grants,
    );
    if (clientDecision.allow) continue;

    if (hasVisibleRow(ctx, db, caller, resource.singular, resource.plural, resource.schema)) {
      out.push(resource.singular);
    }
  }

  return out;
}

/** `SELECT 1 … LIMIT 1` under the caller's LIST visibility clause. */
function hasVisibleRow(
  ctx: EnforceContext,
  db: Database,
  caller: User,
  singular: string,
  plural: string,
  schema: Parameters<typeof listVisibilityClause>[1]['schema'],
): boolean {
  let clause;
  try {
    clause = listVisibilityClause(ctx, { caller, resourceType: singular, plural, schema });
  } catch {
    return false; // an uncompilable filter grants nothing (matches enforcement)
  }
  // `null` means unrestricted. The client-side check above already returned
  // false for this collection, so an unrestricted clause would be contradictory
  // — but if it happens, a row is visible iff the table is non-empty.
  const where = clause === null ? '1' : clause.sql;
  const params = clause === null ? [] : clause.params;
  if (where === '0') return false; // sees nothing; skip the round trip

  try {
    const table = sanitizeTableName(plural);
    const row = db.query(`SELECT 1 FROM ${table} WHERE (${where}) LIMIT 1`).get(...params);
    return !!row;
  } catch {
    // A collection whose table isn't there yet (mid-sync) simply has no rows.
    return false;
  }
}
