/**
 * Reference-id normalisation.
 *
 * A stored reference is documented as "the id", but the codebase has written
 * both forms over time — a bare `abc123` and a pathed `users/abc123` — and the
 * engine itself tolerates either (its `_owner` backfill strips the prefix before
 * comparing). Anything that matches ids against each other has to normalise
 * first or it will silently miss.
 */

/** Strip a `<plural>/` prefix off a stored reference id. */
export function bareId(value: string | undefined | null): string {
  if (!value) return '';
  const slash = value.lastIndexOf('/');
  return slash === -1 ? value : value.slice(slash + 1);
}
