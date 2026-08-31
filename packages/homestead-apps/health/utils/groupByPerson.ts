import type { Vaccine } from '../types';

/** One rendered section of the Health home: a person's series. */
export interface PersonGroup {
  /** Person id, or null for series with no subject. */
  personId: string | null;
  /** Resolved display name; null for the unassigned group or an unknown id. */
  personName: string | null;
  vaccines: Vaccine[];
}

/**
 * Group series by the person they belong to, for the sectioned Health home.
 *
 * - No series carries a person → one anonymous group (the flat list; no
 *   headers rendered).
 * - Otherwise: one group per person sorted by display name (unknown ids —
 *   e.g. a person deleted between fetches — sort last among named groups),
 *   with the unassigned series in a trailing group.
 *
 * Series order within a group is preserved from the input (the list hook
 * sorts by name).
 */
export function groupVaccinesByPerson(
  vaccines: readonly Vaccine[],
  personNames: ReadonlyMap<string, string>,
): PersonGroup[] {
  if (!vaccines.some((v) => v.person)) {
    return vaccines.length
      ? [{ personId: null, personName: null, vaccines: [...vaccines] }]
      : [];
  }

  const byPerson = new Map<string, Vaccine[]>();
  const unassigned: Vaccine[] = [];
  for (const vaccine of vaccines) {
    if (!vaccine.person) {
      unassigned.push(vaccine);
      continue;
    }
    const group = byPerson.get(vaccine.person);
    if (group) group.push(vaccine);
    else byPerson.set(vaccine.person, [vaccine]);
  }

  const named: PersonGroup[] = [...byPerson.entries()]
    .map(([personId, group]) => ({
      personId,
      personName: personNames.get(personId) ?? null,
      vaccines: group,
    }))
    .sort((a, b) => {
      if (a.personName === null) return b.personName === null ? 0 : 1;
      if (b.personName === null) return -1;
      return a.personName.localeCompare(b.personName);
    });

  return unassigned.length
    ? [...named, { personId: null, personName: null, vaccines: unassigned }]
    : named;
}
