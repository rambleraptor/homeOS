/**
 * Shared visibility enum for module-level gating.
 *
 * Every module automatically exposes an `enabled` flag backed by this
 * enum (see `getAllModuleFlagDefs` in `@rambleraptor/homestead-core/modules/registry`). The
 * `useIsModuleEnabled` hook turns a stored value here into a yes/no
 * decision for the current viewer.
 *
 * The `'tagged'` option pairs with the auto-injected `enabled_tags`
 * flag: when an admin sets a module's visibility to `'tagged'`, only
 * users whose `tags` field intersects `enabled_tags` (any-of) can use
 * the module.
 */

export const MODULE_VISIBILITY_OPTIONS = [
  'superusers',
  'all',
  'none',
  'tagged',
] as const;

export type ModuleVisibility = (typeof MODULE_VISIBILITY_OPTIONS)[number];

export const DEFAULT_MODULE_VISIBILITY: ModuleVisibility = 'all';

/**
 * Key of the auto-injected sibling flag holding the comma-separated
 * list of tags allowed when visibility is `'tagged'`. Stored as a
 * string because the flag system only supports primitive types.
 */
export const BUILTIN_ENABLED_TAGS_FLAG_KEY = 'enabled_tags';

/**
 * Split a comma-separated tag-list string into a deduped array of
 * non-empty trimmed tag names. Used to parse the `enabled_tags` flag
 * and the user's `tags` field.
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
