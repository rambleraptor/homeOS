/**
 * Client-side permission mirror (design §10). UX only — the engine is
 * authoritative; this just lets the SPA avoid showing actions/rows the server
 * would deny. It runs the *same* `resolve()` the server enforces with (imported
 * from ./resolve), over a context the server hands down at `/api/permissions/me`.
 */

import { resolve, type Grant, type Verb } from './resolve';

export interface PermissionContext {
  /** Whether enforcement is actually on — the client only restricts when it is. */
  enforced: boolean;
  /** The caller's group ids. */
  groupIds: string[];
  /**
   * The caller's group *names* — feeds app-gating's `tagged` visibility mirror
   * (§9.2). Populated regardless of `enforced`, since app gating is independent
   * of permission enforcement.
   */
  groupNames: string[];
  /** Every applicable grant (role bundles already expanded server-side). */
  grants: Grant[];
}

export interface CanOptions {
  /** The record being addressed, for a record-level check. */
  recordId?: string;
  /** The record's owner id, when the caller knows it (client rarely has `_owner`). */
  owner?: string;
  /** The app owning the resource, for app-scope grants (optional). */
  appId?: string | null;
}

/**
 * Fetch the caller's permission context (mirrors the engine's gatherFor). The
 * client can't enumerate its own group memberships over REST, so the server
 * assembles this. Returns undefined on any failure — `canWith` then stays
 * permissive.
 */
export async function fetchPermissionContext(
  token: string | null | undefined,
): Promise<PermissionContext | undefined> {
  if (!token) return undefined;
  try {
    const res = await fetch('/api/permissions/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    return (await res.json()) as PermissionContext;
  } catch {
    return undefined;
  }
}

/**
 * UX capability check. Permissive when enforcement is off or the context is
 * missing (the server allows everything then), so the UI never hides more than
 * the server denies. Filter grants aren't evaluated client-side (no
 * `filterEval`) — `can()` is conservative for filter-granted access, and the
 * server remains the authority.
 */
export function canWith(
  ctx: PermissionContext | undefined,
  userId: string,
  isSuperuser: boolean,
  verb: Verb,
  resourceType: string,
  opts: CanOptions = {},
): boolean {
  if (!ctx || !ctx.enforced || isSuperuser) return true;
  const decision = resolve(
    { isSuperuser },
    {
      verb,
      resourceType,
      appId: opts.appId ?? null,
      recordId: opts.recordId,
      recordOwner: opts.owner,
    },
    { userId, groupIds: new Set(ctx.groupIds) },
    ctx.grants,
  );
  return decision.allow;
}
