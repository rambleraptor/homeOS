import { describe, expect, it } from 'vitest';
import { groupVaccinesByPerson } from '../utils/groupByPerson';
import type { Vaccine } from '../types';

function makeVaccine(id: string, name: string, person?: string): Vaccine {
  return {
    id,
    path: `vaccines/${id}`,
    name,
    person,
    create_time: '2026-01-01T00:00:00Z',
    update_time: '2026-01-01T00:00:00Z',
  };
}

const NAMES = new Map([
  ['p1', 'Jamie'],
  ['p2', 'Alex'],
]);

describe('groupVaccinesByPerson', () => {
  it('returns no groups for an empty list', () => {
    expect(groupVaccinesByPerson([], NAMES)).toEqual([]);
  });

  it('returns one anonymous group when no series names a person', () => {
    const vaccines = [makeVaccine('a', 'Tdap'), makeVaccine('b', 'Flu')];
    const groups = groupVaccinesByPerson(vaccines, NAMES);
    expect(groups).toHaveLength(1);
    expect(groups[0].personId).toBeNull();
    expect(groups[0].vaccines.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('groups by person sorted by name, unassigned last', () => {
    const vaccines = [
      makeVaccine('a', 'Tdap', 'p1'),
      makeVaccine('b', 'Flu'),
      makeVaccine('c', 'Flu', 'p2'),
      makeVaccine('d', 'MMR', 'p1'),
    ];
    const groups = groupVaccinesByPerson(vaccines, NAMES);
    expect(
      groups.map((g) => ({ name: g.personName, ids: g.vaccines.map((v) => v.id) })),
    ).toEqual([
      { name: 'Alex', ids: ['c'] },
      { name: 'Jamie', ids: ['a', 'd'] },
      { name: null, ids: ['b'] },
    ]);
  });

  it('sorts a person with an unresolvable id after named people', () => {
    const vaccines = [
      makeVaccine('a', 'Tdap', 'p-gone'),
      makeVaccine('b', 'Flu', 'p1'),
    ];
    const groups = groupVaccinesByPerson(vaccines, NAMES);
    expect(groups.map((g) => g.personName)).toEqual(['Jamie', null]);
    expect(groups[1].personId).toBe('p-gone');
  });
});
