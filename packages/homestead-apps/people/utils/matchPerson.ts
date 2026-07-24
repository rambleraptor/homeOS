import type { Person } from '../types';

/** Lowercase, trim, and collapse internal whitespace for name comparison. */
function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Resolve a printed/typed name to a single person by matching it against each
 * person's `name` and `aliases` (case-insensitive, whitespace-normalized).
 *
 * Returns the match only when it is unambiguous — a name that matches zero or
 * more than one person yields `undefined`, so callers can safely auto-fill a
 * link and leave genuinely ambiguous cases to the user.
 */
export function matchPersonByName(
  name: string,
  people: Person[],
): Person | undefined {
  const target = normalize(name);
  if (!target) return undefined;

  const matches = people.filter((person) =>
    [person.name, ...person.aliases].some((n) => normalize(n) === target),
  );

  return matches.length === 1 ? matches[0] : undefined;
}
