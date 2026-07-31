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
import { TYPE_SUPERUSER, type User } from './types';
import type { PermissionStore } from './permission-store';
import {
  computeVisibility,
  resolve,
  type PermissionMode,
  type Verb,
  type Visibility,
} from './permissions';

export interface EnforceContext {
  store: PermissionStore;
  /** Collection plural → owning app id (for app-scope grant matching). */
  appIdFor: (plural: string) => string | null;
  mode: PermissionMode;
}

/** The capability a method requires (delete folds into write; §3.2). */
export function verbForMethod(method: string, isDownload = false): Verb {
  if (isDownload) return 'read';
  switch (method) {
    case 'GET':
      return 'read';
    case 'POST':
    case 'PATCH':
    case 'PUT':
    case 'DELETE':
      return 'write';
    default:
      return 'read';
  }
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
    recordId?: string;
    recordPath?: string;
  },
): void {
  const { caller } = opts;
  if (!caller) return; // no auth context (unit tests); auth middleware enforces presence

  const { principals, grants } = ctx.store.gatherFor(caller.id);
  const recordOwner = opts.recordPath ? ownerOf(db, opts.plural, opts.recordPath) : undefined;

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
  );

  if (decision.allow) return;

  if (ctx.mode === 'shadow') {
    logShadow(ctx, opts.verb, opts.resourceType, opts.recordId, caller.id, decision.reason);
    return;
  }
  throw new HttpError(403, 'you do not have access to this resource');
}

/**
 * Compute the LIST visibility clause for the current caller, or `null` for no
 * restriction. Only applied when the mode is `on`; `shadow`/superuser return
 * null (unrestricted) so lists are never silently trimmed before enforcement.
 */
export function listVisibilityClause(
  ctx: EnforceContext,
  opts: { caller: User | null; resourceType: string; plural: string },
): { sql: string; params: (string | number)[] } | null {
  const { caller } = opts;
  if (ctx.mode !== 'on' || !caller) return null;
  if (caller.type === TYPE_SUPERUSER) return null; // break-glass: sees everything

  const { principals, grants } = ctx.store.gatherFor(caller.id);
  const visibility = computeVisibility(
    { resourceType: opts.resourceType, appId: ctx.appIdFor(opts.plural) },
    principals,
    grants,
  );
  return visibilityToSql(visibility, caller.id);
}

/**
 * Translate a Visibility verdict into a SQL fragment over the resource table.
 * Filter clauses (allow/deny) are Phase 4 — none exist from the baseline, so
 * they're logged and skipped here (conservatively for `only`, permissively for
 * `all-except`).
 */
function visibilityToSql(
  v: Visibility,
  callerId: string,
): { sql: string; params: (string | number)[] } | null {
  switch (v.mode) {
    case 'all':
      return null;
    case 'none':
      return { sql: '0', params: [] };
    case 'all-except': {
      if (v.denyFilters.length) warnFilters();
      if (v.denyRecordIds.length === 0) return null;
      const qs = v.denyRecordIds.map(() => '?').join(', ');
      return { sql: `id NOT IN (${qs})`, params: [...v.denyRecordIds] };
    }
    case 'only': {
      if (v.allowFilters.length || v.denyFilters.length) warnFilters();
      const params: (string | number)[] = [callerId];
      let base = `${OWNER_COLUMN} = ?`;
      if (v.allowRecordIds.length) {
        base += ` OR id IN (${v.allowRecordIds.map(() => '?').join(', ')})`;
        params.push(...v.allowRecordIds);
      }
      let sql = `(${base})`;
      if (v.denyRecordIds.length) {
        sql += ` AND id NOT IN (${v.denyRecordIds.map(() => '?').join(', ')})`;
        params.push(...v.denyRecordIds);
      }
      return { sql, params };
    }
  }
}

let warnedFilters = false;
function warnFilters(): void {
  if (warnedFilters) return;
  warnedFilters = true;
  console.warn(
    '[permissions] filter-scoped grants are not evaluated yet (Phase 4); ignoring filter clauses',
  );
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
