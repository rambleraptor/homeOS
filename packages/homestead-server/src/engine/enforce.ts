/**
 * Permission enforcement wiring (design §5.3). Bridges the request path to the
 * pure resolver: gathers the caller's grants from the PermissionStore, decides,
 * and either throws 403 (mode `on`), logs the would-be denial (mode `shadow`),
 * or — for LIST — produces a SQL visibility clause.
 *
 * All of this is inert unless `PERMISSIONS_ENFORCED` is set: the router only
 * calls in here when the mode is `on`/`shadow`, and the legacy `checkUserScope`
 * path runs otherwise.
 */

import type { Database } from './sqlite';
import { HttpError } from './errors';
import { OWNER_COLUMN, sanitizeTableName } from './db';
import { compileFilter, type FilterSubject } from './filter';
import { TYPE_SUPERUSER, type Schema, type User } from './types';
import type { PermissionStore } from './permission-store';
import type { Registry } from './registry';
import {
  computeVisibility,
  resolve,
  type AccessRequest,
  type FilterEval,
  type Grant,
  type PermissionMode,
  type Verb,
  type Visibility,
} from './permissions';

/** Caller attributes exposed to a grant filter as `subject.*` (§3.6.1). */
function subjectOf(caller: User): FilterSubject {
  return { id: caller.id, email: caller.email, display_name: caller.display_name };
}

export type AccessModel = 'household' | 'owner' | 'acl';

/**
 * Apply a resource's access model (§7) to the grant set used for *row* access:
 *   - household → all grant scopes apply (the blanket open grant included).
 *   - acl       → the all-scope (open) grant is ignored; app/collection/record apply.
 *   - owner     → all- and app-scope grants ignored; only collection/record apply
 *                 (owner⇒manage still comes from the resolver itself).
 * Denies are always kept — deny wins at every scope. CREATE never calls this
 * (people can always add records they'll own).
 */
function scopedGrants(grants: Grant[], model: AccessModel): Grant[] {
  if (model === 'household') return grants;
  const droppedAllowScopes = model === 'owner' ? new Set(['all', 'app']) : new Set(['all']);
  return grants.filter((g) => g.effect === 'deny' || !droppedAllowScopes.has(g.target.scope));
}

export interface EnforceContext {
  store: PermissionStore;
  /** Collection plural → owning app id (for app-scope grant matching). */
  appIdFor: (plural: string) => string | null;
  mode: PermissionMode;
}

function ownerOf(db: Database, plural: string, path: string): string | null {
  try {
    const row = db
      .query(`SELECT ${OWNER_COLUMN} AS owner FROM ${sanitizeTableName(plural)} WHERE path = ?`)
      .get(path) as { owner: string | null } | null;
    return row?.owner ?? null;
  } catch {
    return null;
  }
}

/**
 * Authorize a single-record or create/singleton request. `recordPath` is set
 * for ops that address an existing row (so we can read its owner); omit it for
 * create. Throws 403 when denied and the mode is `on`; logs and allows in
 * `shadow`.
 */
export function enforceRecordAccess(
  ctx: EnforceContext,
  db: Database,
  opts: {
    caller: User | null;
    verb: Verb;
    resourceType: string;
    plural: string;
    schema: Schema;
    accessModel: AccessModel;
    recordId?: string;
    recordPath?: string;
  },
): void {
  const { caller } = opts;
  if (!caller) return; // no auth context (unit tests); auth middleware enforces presence

  const gathered = ctx.store.gatherFor(caller.id);
  const { principals } = gathered;
  // The access model restricts *row* access (recordPath set); CREATE keeps the
  // full grant set so people can add records they'll own.
  const grants = opts.recordPath ? scopedGrants(gathered.grants, opts.accessModel) : gathered.grants;
  const recordOwner = opts.recordPath ? ownerOf(db, opts.plural, opts.recordPath) : undefined;

  // A collection-scope grant filter (§3.6) matches iff the addressed record
  // satisfies it — evaluated as a SQL guard so it can't drift from LIST.
  const filterEval: FilterEval = (filter) => {
    if (!opts.recordPath) return false; // create/collection: no row to match
    return recordMatchesFilter(db, opts.plural, opts.recordPath, filter, opts.schema, subjectOf(caller));
  };

  const decision = resolve(
    { isSuperuser: caller.type === TYPE_SUPERUSER },
    {
      verb: opts.verb,
      resourceType: opts.resourceType,
      appId: ctx.appIdFor(opts.plural),
      recordId: opts.recordId,
      recordOwner,
    },
    principals,
    grants,
    filterEval,
  );

  if (decision.allow) return;

  if (ctx.mode === 'shadow') {
    logShadow(ctx, opts.verb, opts.resourceType, opts.recordId, caller.id, decision.reason);
    return;
  }
  throw new HttpError(403, 'you do not have access to this resource');
}

/** True iff the addressed row satisfies `filter` (subject.* bound to the caller). */
function recordMatchesFilter(
  db: Database,
  plural: string,
  recordPath: string,
  filter: string,
  schema: Schema,
  subject: FilterSubject,
): boolean {
  let compiled;
  try {
    compiled = compileFilter(filter, schema, { subject });
  } catch {
    logInvalidFilter(filter);
    return false; // a broken filter grants nothing
  }
  try {
    const table = sanitizeTableName(plural);
    const row = db
      .query(`SELECT 1 FROM ${table} WHERE path = ? AND (${compiled.sql}) LIMIT 1`)
      .get(recordPath, ...compiled.params);
    return !!row;
  } catch {
    return false;
  }
}

/**
 * Compute the LIST visibility clause for the current caller, or `null` for no
 * restriction. Only applied when the mode is `on`; `shadow`/superuser return
 * null (unrestricted) so lists are never silently trimmed before enforcement.
 */
export function listVisibilityClause(
  ctx: EnforceContext,
  opts: {
    caller: User | null;
    resourceType: string;
    plural: string;
    schema: Schema;
    accessModel: AccessModel;
  },
): { sql: string; params: (string | number)[] } | null {
  const { caller } = opts;
  if (ctx.mode !== 'on' || !caller) return null;
  if (caller.type === TYPE_SUPERUSER) return null; // break-glass: sees everything

  const gathered = ctx.store.gatherFor(caller.id);
  const { principals } = gathered;
  const grants = scopedGrants(gathered.grants, opts.accessModel);
  const visibility = computeVisibility(
    { resourceType: opts.resourceType, appId: ctx.appIdFor(opts.plural) },
    principals,
    grants,
  );
  return visibilityToSql(visibility, caller.id, opts.schema, subjectOf(caller));
}

/** Compile a grant filter to `(sql, params)`, or null if it can't compile. */
function compiledFilterClause(
  filter: string,
  schema: Schema,
  subject: FilterSubject,
): { sql: string; params: (string | number)[] } | null {
  try {
    const c = compileFilter(filter, schema, { subject });
    return { sql: c.sql, params: [...c.params] };
  } catch {
    logInvalidFilter(filter);
    return null;
  }
}

/**
 * Translate a Visibility verdict into a SQL fragment over the resource table,
 * compiling any filter-grant clauses (§3.6) with `subject.*` bound to the caller.
 * A filter that can't compile is dropped (an allow grants nothing; a deny is
 * skipped and logged) — write-time validation should prevent this.
 */
function visibilityToSql(
  v: Visibility,
  callerId: string,
  schema: Schema,
  subject: FilterSubject,
): { sql: string; params: (string | number)[] } | null {
  const compileMany = (filters: string[]) =>
    filters.map((f) => compiledFilterClause(f, schema, subject)).filter((c): c is NonNullable<typeof c> => c !== null);

  switch (v.mode) {
    case 'all':
      return null;
    case 'none':
      return { sql: '0', params: [] };
    case 'all-except': {
      const parts: string[] = [];
      const params: (string | number)[] = [];
      if (v.denyRecordIds.length) {
        parts.push(`id NOT IN (${v.denyRecordIds.map(() => '?').join(', ')})`);
        params.push(...v.denyRecordIds);
      }
      for (const c of compileMany(v.denyFilters)) {
        parts.push(`NOT (${c.sql})`);
        params.push(...c.params);
      }
      if (parts.length === 0) return null;
      return { sql: parts.join(' AND '), params };
    }
    case 'only': {
      const orParts: string[] = [`${OWNER_COLUMN} = ?`];
      const params: (string | number)[] = [callerId];
      if (v.allowRecordIds.length) {
        orParts.push(`id IN (${v.allowRecordIds.map(() => '?').join(', ')})`);
        params.push(...v.allowRecordIds);
      }
      for (const c of compileMany(v.allowFilters)) {
        orParts.push(`(${c.sql})`);
        params.push(...c.params);
      }
      let sql = `(${orParts.join(' OR ')})`;
      if (v.denyRecordIds.length) {
        sql += ` AND id NOT IN (${v.denyRecordIds.map(() => '?').join(', ')})`;
        params.push(...v.denyRecordIds);
      }
      for (const c of compileMany(v.denyFilters)) {
        sql += ` AND NOT (${c.sql})`;
        params.push(...c.params);
      }
      return { sql, params };
    }
  }
}

// ─────────────── access-grant self-governance (§15.3) ───────────────

/** The ACL machinery governs itself — no grant may target these collections. */
const PROTECTED_GRANT_TARGET_TYPES = new Set([
  'access-grant',
  'role',
  'group',
  'group-membership',
]);

export interface GrantTargetSpec {
  scope?: string;
  app?: string;
  resource_type?: string;
  resource_id?: string;
}

function ownerOfById(db: Database, plural: string, id: string): string | null {
  try {
    const row = db
      .query(`SELECT ${OWNER_COLUMN} AS owner FROM ${sanitizeTableName(plural)} WHERE id = ?`)
      .get(id) as { owner: string | null } | null;
    return row?.owner ?? null;
  } catch {
    return null;
  }
}

/** The "manage on the grant's target" request, shaped by the target's scope. */
function manageRequestForTarget(
  ctx: EnforceContext,
  reg: Registry,
  db: Database,
  target: GrantTargetSpec,
): AccessRequest {
  const pluralOf = (singular?: string) => (singular ? reg.get(singular)?.plural ?? '' : '');
  switch (target.scope) {
    case 'record': {
      const plural = pluralOf(target.resource_type);
      return {
        verb: 'manage',
        resourceType: target.resource_type ?? '',
        appId: ctx.appIdFor(plural),
        recordId: target.resource_id,
        recordOwner: target.resource_id ? ownerOfById(db, plural, target.resource_id) : undefined,
      };
    }
    case 'collection': {
      const plural = pluralOf(target.resource_type);
      return { verb: 'manage', resourceType: target.resource_type ?? '', appId: ctx.appIdFor(plural) };
    }
    case 'app':
      return { verb: 'manage', resourceType: '', appId: target.app ?? null };
    default: // 'all' (or unspecified): manage over everything
      return { verb: 'manage', resourceType: '', appId: null };
  }
}

/**
 * Authorize a write to an `access-grant` (§15.3): superuser, or a caller with
 * `manage` on the grant's target. No grant may target the ACL machinery itself
 * (no grants-on-grants). Requiring manage-on-target also prevents privilege
 * escalation — you can only grant over what you already fully control.
 */
export function enforceGrantWrite(
  ctx: EnforceContext,
  reg: Registry,
  db: Database,
  caller: User | null,
  target: GrantTargetSpec,
): void {
  if (!caller) return;
  if (caller.type === TYPE_SUPERUSER) return; // break-glass

  const deny = (reason: string): boolean => {
    if (ctx.mode === 'shadow') {
      console.info(`[permissions] shadow: would deny grant-write for ${caller.id} (${reason})`);
      return true; // allow through in shadow
    }
    throw new HttpError(403, 'you do not have permission to write this grant');
  };

  if (target.resource_type && PROTECTED_GRANT_TARGET_TYPES.has(target.resource_type)) {
    if (deny('grants-on-grants')) return;
  }

  const { principals, grants } = ctx.store.gatherFor(caller.id);
  const decision = resolve(
    { isSuperuser: false },
    manageRequestForTarget(ctx, reg, db, target),
    principals,
    grants,
  );
  if (decision.allow) return;
  deny('no-manage-on-target');
}

/**
 * De-dupe warnings *per distinct filter*, not globally: an un-compilable filter
 * is fail-open for a deny grant (the deny silently stops applying), so every
 * different broken filter must surface at least once — a single process-wide
 * flag would hide the second one entirely. Bounded so a pathological stream of
 * distinct broken filters can't grow it without limit; past the cap we warn
 * every time rather than going quiet.
 */
const warnedInvalidFilters = new Set<string>();
const WARNED_INVALID_FILTER_CAP = 256;
function logInvalidFilter(filter: string): void {
  if (warnedInvalidFilters.size < WARNED_INVALID_FILTER_CAP) {
    if (warnedInvalidFilters.has(filter)) return;
    warnedInvalidFilters.add(filter);
  }
  console.warn(`[permissions] ignoring un-compilable grant filter: ${JSON.stringify(filter)}`);
}

function logShadow(
  ctx: EnforceContext,
  verb: Verb,
  resourceType: string,
  recordId: string | undefined,
  callerId: string,
  reason: string,
): void {
  void ctx;
  console.info(
    `[permissions] shadow: would deny ${verb} ${resourceType}${recordId ? `/${recordId}` : ''} ` +
      `for ${callerId} (${reason})`,
  );
}
