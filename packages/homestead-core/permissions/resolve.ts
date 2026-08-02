/**
 * The pure permission resolver (design §4 / §4.1), shared verbatim by the
 * server (engine enforcement) and the client (`can()` + nav/list filtering).
 * One source of truth: server `decide` and client `resolveVisibility` used to be
 * two hand-synced copies; this replaces that discipline with literally the same
 * code. Everything here is a pure function of its inputs — no DB, no request,
 * no React, no `process.env`.
 */

// ─────────────────────────── Types (design §14) ───────────────────────────

/** write covers create/update/delete; manage adds granting others' access. */
export type Capability = 'read' | 'write' | 'manage';
export type Verb = Capability; // the required capability a request maps to
export type Effect = 'allow' | 'deny';
export type Scope = 'all' | 'app' | 'collection' | 'record';

/** WHO a grant is addressed to. No `role` subject (clean split, design §11 #10). */
export interface Subject {
  type: 'user' | 'group' | 'everyone';
  id?: string; // required unless type === 'everyone'
}

/** WHERE a grant applies. */
export interface GrantTarget {
  scope: Scope;
  app?: string; // app id, when scope === 'app'
  resource_type?: string; // collection singular, when scope === 'collection' | 'record'
  resource_id?: string; // record id, when scope === 'record'
  filter?: string; // attribute expression, only when scope === 'collection' (Phase 4)
}

export interface Grant {
  subject: Subject;
  capability: Capability;
  effect: Effect;
  target: GrantTarget;
  /**
   * The seeded "everyone can do everything" default (§8.x). It's a *fallback*:
   * the store drops it for any caller who has a conferred role, so a role-group
   * membership defines that person's access outright. The resolver itself treats
   * it like any other grant — suppression happens before resolve() sees it.
   */
  isDefault?: boolean;
}

export interface Decision {
  allow: boolean;
  /** Short machine-readable reason, for shadow-mode logging and debugging. */
  reason: 'superuser' | 'granted' | 'denied' | 'no-grant';
}

/** The caller's expanded principal set: their user id and the groups they're in. */
export interface Principals {
  userId: string;
  groupIds: Set<string>;
}

/** A single-record or create/collection request being authorized. */
export interface AccessRequest {
  verb: Verb;
  resourceType: string; // collection singular being addressed
  appId: string | null; // app that owns resourceType (null for ungated/core)
  recordId?: string; // present for single-record ops (GET/PATCH/DELETE)
  recordOwner?: string | null; // the addressed row's `_owner`, when known
}

/**
 * Evaluate a collection-scope grant's filter against the request. Supplied by
 * Phase 4; until then a filtered grant simply doesn't match (see below).
 */
export type FilterEval = (filter: string, request: AccessRequest) => boolean;

const CAP_RANK: Record<Capability, number> = { read: 1, write: 2, manage: 3 };

// ─────────────────────────── Matching helpers ───────────────────────────

function subjectMatches(subject: Subject, principals: Principals): boolean {
  switch (subject.type) {
    case 'everyone':
      return true;
    case 'user':
      return subject.id === principals.userId;
    case 'group':
      return subject.id !== undefined && principals.groupIds.has(subject.id);
    default:
      return false;
  }
}

function targetMatches(
  target: GrantTarget,
  request: AccessRequest,
  filterEval?: FilterEval,
): boolean {
  switch (target.scope) {
    case 'all':
      return true;
    case 'app':
      return target.app != null && target.app === request.appId;
    case 'collection':
      if (target.resource_type !== request.resourceType) return false;
      if (target.filter) {
        // Phase 1 can't evaluate filters (no record loaded / no compiler here);
        // a filtered grant only matches once Phase 4 supplies `filterEval`.
        return filterEval ? filterEval(target.filter, request) : false;
      }
      return true;
    case 'record':
      return (
        target.resource_type === request.resourceType &&
        target.resource_id != null &&
        target.resource_id === request.recordId
      );
    default:
      return false;
  }
}

// ─────────────────────────── resolve() (design §4) ───────────────────────────

/**
 * Decide a single request. Precedence (design §4): the superuser account is the
 * break-glass override; otherwise deny always wins, then the highest allow
 * among owner / grant / role-derived / everyone; default deny.
 *
 * `grants` is the set the store has gathered as *possibly* applicable — role
 * bundles are expanded into grants addressed to the caller before they get
 * here, so this function only matches by subject and target. It never reaches
 * the DB.
 */
export function resolve(
  caller: { isSuperuser: boolean },
  request: AccessRequest,
  principals: Principals,
  grants: Grant[],
  filterEval?: FilterEval,
): Decision {
  if (caller.isSuperuser) return { allow: true, reason: 'superuser' };

  const required = CAP_RANK[request.verb];
  let allowRank = 0;
  let denyRank = 0;

  // Owner ⇒ manage, as an allow (so a deny still beats it — design §4.2 note).
  if (request.recordOwner && request.recordOwner === principals.userId) {
    allowRank = CAP_RANK.manage;
  }

  for (const g of grants) {
    if (!subjectMatches(g.subject, principals)) continue;
    if (!targetMatches(g.target, request, filterEval)) continue;
    const rank = CAP_RANK[g.capability];
    if (g.effect === 'deny') {
      if (rank > denyRank) denyRank = rank;
    } else if (rank > allowRank) {
      allowRank = rank;
    }
  }

  // Deny always wins: a deny at or above the required capability blocks.
  if (denyRank >= required) return { allow: false, reason: 'denied' };
  if (allowRank >= required) return { allow: true, reason: 'granted' };
  return { allow: false, reason: 'no-grant' };
}

// ─────────────────────── computeVisibility() (design §4.1) ───────────────────────

/**
 * The row-visibility verdict for a LIST over a collection, as a structured
 * predicate the store/SQL layer turns into a WHERE fragment (Phase 3/4):
 *   - `all`        → no restriction (broad-read fast path)
 *   - `none`       → caller sees nothing (a broad deny read applies)
 *   - `all-except` → every row minus the listed record-id / filter denies
 *   - `only`       → owner rows ∪ granted record-ids ∪ allow-filters, minus denies
 * Filter arrays are carried through verbatim; Phase 4 compiles them to SQL.
 */
export type Visibility =
  | { mode: 'all' }
  | { mode: 'none' }
  | { mode: 'all-except'; denyRecordIds: string[]; denyFilters: string[] }
  | {
      mode: 'only';
      ownerAllowed: boolean;
      allowRecordIds: string[];
      allowFilters: string[];
      denyRecordIds: string[];
      denyFilters: string[];
    };

/**
 * Compute LIST visibility for `read` over `resourceType`. Pure over the gathered
 * grants; the superuser bypass is handled by the caller (it never lists through
 * a restricted predicate).
 */
export function computeVisibility(
  request: { resourceType: string; appId: string | null },
  principals: Principals,
  grants: Grant[],
): Visibility {
  let broadAllow = false;
  let broadDeny = false;
  const allowRecordIds = new Set<string>();
  const denyRecordIds = new Set<string>();
  const allowFilters: string[] = [];
  const denyFilters: string[] = [];

  for (const g of grants) {
    if (!subjectMatches(g.subject, principals)) continue;
    // All capabilities include read, so any grant contributes to read visibility.
    const isDeny = g.effect === 'deny';
    const t = g.target;

    if (t.scope === 'all' || (t.scope === 'app' && t.app === request.appId)) {
      if (isDeny) broadDeny = true;
      else broadAllow = true;
    } else if (t.scope === 'collection' && t.resource_type === request.resourceType) {
      if (t.filter) {
        (isDeny ? denyFilters : allowFilters).push(t.filter);
      } else if (isDeny) {
        broadDeny = true;
      } else {
        broadAllow = true;
      }
    } else if (
      t.scope === 'record' &&
      t.resource_type === request.resourceType &&
      t.resource_id != null
    ) {
      (isDeny ? denyRecordIds : allowRecordIds).add(t.resource_id);
    }
  }

  // A broad deny read beats every allow (including owner and record grants):
  // the caller sees nothing from this collection.
  if (broadDeny) return { mode: 'none' };

  const hasDenies = denyRecordIds.size > 0 || denyFilters.length > 0;

  if (broadAllow) {
    if (!hasDenies) return { mode: 'all' };
    return {
      mode: 'all-except',
      denyRecordIds: [...denyRecordIds],
      denyFilters,
    };
  }

  return {
    mode: 'only',
    ownerAllowed: true, // owner may always read their own rows (no broad deny here)
    allowRecordIds: [...allowRecordIds],
    allowFilters,
    denyRecordIds: [...denyRecordIds],
    denyFilters,
  };
}
