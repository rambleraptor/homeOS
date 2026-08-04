import type { Person } from '../types';

/** Lowercase, trim, and collapse internal whitespace for name comparison. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * The distinct word tokens of a name: normalized, split on whitespace, with
 * punctuation stripped (so "Robert J. Smith" → {robert, j, smith}). Empty words
 * are dropped.
 */
function nameTokens(name: string): Set<string> {
  const tokens = new Set<string>();
  for (const raw of normalize(name).split(' ')) {
    const word = raw.replace(/[^a-z0-9]/g, '');
    if (word) tokens.add(word);
  }
  return tokens;
}

/**
 * Whether `inner` is a *strict* subset of `outer` — every token of `inner`
 * appears in `outer`, and `outer` has strictly more. Requires `inner` to carry
 * at least two tokens, so a bare first name (or a one-word nickname) never
 * vacuums up unrelated full names; that stays the job of exact matching.
 */
function isStrictSubset(inner: Set<string>, outer: Set<string>): boolean {
  if (inner.size < 2 || inner.size >= outer.size) return false;
  for (const token of inner) {
    if (!outer.has(token)) return false;
  }
  return true;
}

export interface MatchPersonOptions {
  /**
   * When no exact match exists, also match a directory person whose full name
   * (or an alias) is a strict subset of the extracted name's word tokens — so a
   * printed legal name like "Jane Marie Doe" folds into the directory's
   * "Jane Doe". Still unambiguous: a subset that fits two people yields no
   * match. Off by default (exact matching only), because callers that write a
   * durable person link want the stricter behavior.
   */
  tokenSubset?: boolean;
}

/**
 * Resolve a printed/typed name to a single person by matching it against each
 * person's `name` and `aliases` (case-insensitive, whitespace-normalized).
 *
 * Exact matches win: a name equal to a person's name or alias resolves to that
 * person. With `tokenSubset` enabled and no exact match, a longer printed name
 * also folds into the directory person whose name it contains (see
 * {@link MatchPersonOptions.tokenSubset}).
 *
 * Returns the match only when it is unambiguous — a name that matches zero or
 * more than one person yields `undefined`, so callers can safely auto-fill a
 * link and leave genuinely ambiguous cases to the user.
 */
export function matchPersonByName(
  name: string,
  people: Person[],
  options: MatchPersonOptions = {},
): Person | undefined {
  const target = normalize(name);
  if (!target) return undefined;

  const exact = people.filter((person) =>
    [person.name, ...person.aliases].some((n) => normalize(n) === target),
  );
  // Exact matching decides on its own — an exact hit (or an exact ambiguity)
  // never falls through to the looser token-subset pass.
  if (exact.length > 0) return exact.length === 1 ? exact[0] : undefined;

  if (!options.tokenSubset) return undefined;

  const printed = nameTokens(name);
  const subset = people.filter((person) =>
    [person.name, ...person.aliases].some((n) => isStrictSubset(nameTokens(n), printed)),
  );
  return subset.length === 1 ? subset[0] : undefined;
}
