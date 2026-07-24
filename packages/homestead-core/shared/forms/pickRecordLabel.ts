/**
 * Pick a human-readable label for a fetched record, for display in a
 * reference picker (or anywhere a record needs a one-line name).
 *
 * Mirrors the server-side `pickTitle` used by the chat semantic-search tool
 * (`server/chat/search-tool.ts`) — title, then name (a `people/<id>`-style
 * path is trimmed to its last segment), then a user's `display_name`, then
 * `email`. Unlike the server helper this one always returns *something*: when
 * no display field is present it falls back to the record id, so a picker
 * option is never blank and stays selectable.
 */

/** The minimum shape every aepbase record shares. */
export interface AepRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * Best display label for `record`. Checks `title`, then `name` (path-trimmed),
 * then `display_name`, then `email`, and finally falls back to the record id.
 */
export function pickRecordLabel(record: AepRecord): string {
  const title = record.title;
  if (typeof title === 'string' && title.trim()) return title;

  const name = record.name;
  if (typeof name === 'string' && name.trim()) {
    // `name` may be an aepbase resource path like `people/abc123`; show the
    // last segment when so, otherwise the value itself.
    return name.split('/').filter(Boolean).pop() ?? name;
  }

  const displayName = record.display_name;
  if (typeof displayName === 'string' && displayName.trim()) return displayName;

  const email = record.email;
  if (typeof email === 'string' && email.trim()) return email;

  return record.id;
}
