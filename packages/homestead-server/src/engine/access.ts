/**
 * App-level access gating — port of aepbase/access.go + middleware.go. The
 * static half (which app owns a gated collection, each app's default
 * visibility) now arrives as a plain object built from the app registry
 * in-process; the old AEPBASE_APP_ACCESS env serialization is gone. The
 * dynamic half (current flag values, the caller's account tags) is read live
 * from SQLite behind a short TTL cache.
 *
 * Visibility values mirror APP_VISIBILITY_OPTIONS in
 * packages/homestead-core/settings/visibility.ts — keep the two in sync:
 *   none        → deny everyone (even superusers)
 *   all         → any signed-in user
 *   superusers  → only type=="superuser"
 *   tagged      → caller is a member of a group whose *name* is in the app's
 *                 enabled_tags list (§9.2 — the audience is now group
 *                 membership, replacing the retired account-tags; the flag key
 *                 stays `enabled_tags` for compatibility but holds group names)
 */

import type { Database } from './sqlite';
import type { AccessCheck } from './engine';
import { errorResponse } from './errors';
import { TYPE_SUPERUSER } from './types';

export interface AppAccessConfig {
  /** Collection plural → owning app id. Only gated collections are present. */
  collectionToApp: Record<string, string>;
  /** App id → default visibility, used before any flag value is stored. */
  appDefaults: Record<string, string>;
}

const VISIBILITY_NONE = 'none';
const VISIBILITY_ALL = 'all';
const VISIBILITY_SUPERUSERS = 'superusers';
const VISIBILITY_TAGGED = 'tagged';
const DEFAULT_VISIBILITY = VISIBILITY_ALL;

const KNOWN_VISIBILITIES = new Set([
  VISIBILITY_NONE,
  VISIBILITY_ALL,
  VISIBILITY_SUPERUSERS,
  VISIBILITY_TAGGED,
]);

export const DEFAULT_ACCESS_CACHE_TTL_MS = 5000;

/**
 * Pure port of resolveVisibility (useIsAppEnabled.ts). For `tagged`, the
 * caller passes when any of their group names appears in the app's enabled
 * list (§9.2 — group membership replaced account-tags as the audience).
 */
export function decide(
  vis: string,
  isSuperuser: boolean,
  userGroupNames: string[],
  enabledGroups: string,
): boolean {
  switch (vis) {
    case VISIBILITY_NONE:
      return false;
    case VISIBILITY_SUPERUSERS:
      return isSuperuser;
    case VISIBILITY_TAGGED: {
      const allowed = parseTagSet(enabledGroups);
      if (allowed.size === 0) return false;
      return userGroupNames.some((g) => allowed.has(g));
    }
    default:
      // visibilityAll and any unexpected value, matching the frontend default.
      return true;
  }
}

/** Mirrors parseTagList in settings/visibility.ts. */
export function parseTagSet(raw: string): Set<string> {
  const out = new Set<string>();
  for (const part of raw.split(',')) {
    const tag = part.trim();
    if (tag !== '') out.add(tag);
  }
  return out;
}

/** "gift-cards" + "enabled" → "gift_cards__enabled" (settings/flags.ts). */
export function appFieldName(appId: string, key: string): string {
  return `${appId.replaceAll('-', '_')}__${key}`;
}

/** Strip a `<collection>/` reference prefix to the bare id (`users/u1` → `u1`). */
function bareId(value: string): string {
  const slash = value.lastIndexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}

/**
 * Reads the household app_flags row and per-user group memberships with a TTL
 * cache so gated requests don't fan out queries.
 */
export class AccessStore {
  private flags: Record<string, string> | null = null;
  private flagsAt = 0;
  private groupNames = new Map<string, { names: string[]; at: number }>();

  constructor(
    private db: Database,
    private ttlMs: number = DEFAULT_ACCESS_CACHE_TTL_MS,
  ) {}

  visibility(appId: string, appDefault: string | undefined): { vis: string; enabledTags: string } {
    const flags = this.loadFlags();
    let vis = flags[appFieldName(appId, 'enabled')] ?? '';
    if (vis === '') vis = appDefault ?? '';
    if (!KNOWN_VISIBILITIES.has(vis)) vis = DEFAULT_VISIBILITY;
    return { vis, enabledTags: flags[appFieldName(appId, 'enabled_tags')] ?? '' };
  }

  /**
   * The lone app_flags row as column→value map. Missing table/row (fresh db
   * before first schema sync) yields {} so callers fall back to defaults.
   */
  loadFlags(): Record<string, string> {
    if (this.flags !== null && Date.now() - this.flagsAt < this.ttlMs) {
      return this.flags;
    }
    let flags: Record<string, string> = {};
    try {
      const row = this.db.query('SELECT * FROM app_flags LIMIT 1').get() as Record<
        string,
        unknown
      > | null;
      if (row) {
        for (const [col, val] of Object.entries(row)) {
          if (val !== null && val !== undefined) flags[col] = String(val);
        }
      }
    } catch {
      flags = {}; // table not created yet → defaults
    }
    this.flags = flags;
    this.flagsAt = Date.now();
    return flags;
  }

  /**
   * The names of every group the user belongs to (§9.2). Joins
   * `group_memberships` to `groups`, tolerating both bare and `<collection>/`-
   * prefixed reference ids on either side. A missing table (fresh db before the
   * permissions schema is applied) yields `[]`, so a `tagged` app simply denies.
   */
  userGroupNames(userId: string): string[] {
    const entry = this.groupNames.get(userId);
    if (entry && Date.now() - entry.at < this.ttlMs) return entry.names;
    let names: string[] = [];
    try {
      const bare = bareId(userId);
      const rows = this.db
        .query(
          `SELECT DISTINCT g.name AS name
             FROM group_memberships m
             JOIN "groups" g
               ON (m.group_id = g.id OR m.group_id = 'groups/' || g.id)
            WHERE (m.user = ? OR m.user = 'users/' || ?)`,
        )
        .all(bare, bare) as { name: string | null }[];
      names = rows.map((r) => r.name ?? '').filter((n) => n !== '');
    } catch {
      names = [];
    }
    this.groupNames.set(userId, { names, at: Date.now() });
    return names;
  }
}

/**
 * Build the Engine access hook. Runs after auth, so the caller is resolved;
 * core/built-in collections are never in collectionToApp and pass through.
 */
export function makeAccessCheck(
  db: Database,
  cfg: AppAccessConfig,
  ttlMs: number = DEFAULT_ACCESS_CACHE_TTL_MS,
): AccessCheck {
  const store = new AccessStore(db, ttlMs);
  return (req, segments, caller) => {
    if (req.method === 'OPTIONS') return null;
    const plural = segments[0] ?? '';
    const appId = cfg.collectionToApp[plural];
    if (!appId) return null;

    if (!caller) {
      // Auth should have rejected this already; defensive.
      return errorResponse(401, 'authentication required');
    }

    const { vis, enabledTags } = store.visibility(appId, cfg.appDefaults[appId]);
    if (
      !decide(vis, caller.type === TYPE_SUPERUSER, store.userGroupNames(caller.id), enabledTags)
    ) {
      return errorResponse(403, 'you do not have access to this app');
    }
    return null;
  };
}
