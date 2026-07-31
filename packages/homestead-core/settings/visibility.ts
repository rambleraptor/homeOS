/**
 * Shared visibility enum for app-level gating.
 *
 * Every app automatically exposes an `enabled` flag backed by this
 * enum (see `getAllAppFlagDefs` in `@rambleraptor/homestead-core/apps/registry`). The
 * `useIsAppEnabled` hook turns a stored value here into a yes/no
 * decision for the current viewer.
 *
 * The `'tagged'` option pairs with the auto-injected `enabled_tags`
 * flag: when an admin sets an app's visibility to `'tagged'`, only
 * members of the groups named in `enabled_tags` (any-of) can use the
 * app. (§9.2 repurposed this flag's contents from account-tag names to
 * group names; the key is kept for compatibility.)
 */

export const APP_VISIBILITY_OPTIONS = [
  'superusers',
  'all',
  'none',
  'tagged',
] as const;

export type AppVisibility = (typeof APP_VISIBILITY_OPTIONS)[number];

export const DEFAULT_APP_VISIBILITY: AppVisibility = 'all';

/**
 * Key of the auto-injected sibling flag holding the comma-separated
 * list of group names allowed when visibility is `'tagged'`. Stored as
 * a string because the flag system only supports primitive types. (The
 * key name predates §9.2, which repurposed the contents from account-tag
 * names to group names; kept as-is so the stored column survives.)
 */
export const BUILTIN_ENABLED_TAGS_FLAG_KEY = 'enabled_tags';

/**
 * Split a comma-separated list string into a deduped array of non-empty
 * trimmed names. Used to parse the `enabled_tags` flag (group names).
 */
export function parseTagList(raw: string | undefined | null): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const tag = part.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Format a tag-name array into the comma-separated string stored in
 * the `enabled_tags` flag. Empty entries are dropped; duplicates are
 * preserved in caller order but only the first occurrence is kept.
 */
export function formatTagList(tags: readonly string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out.join(',');
}
