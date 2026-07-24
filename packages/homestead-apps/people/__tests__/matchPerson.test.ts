import { describe, it, expect } from 'vitest';
import { matchPersonByName } from '../utils/matchPerson';
import type { Person } from '../types';

function person(id: string, name: string, aliases: string[] = []): Person {
  return {
    id,
    name,
    aliases,
    addresses: [],
    created_by: 'user-1',
    created: '',
    updated: '',
  };
}

describe('matchPersonByName', () => {
  const people = [
    person('1', 'Robert Smith', ['Bob Smith', 'Bob Jones']),
    person('2', 'Jane Doe'),
  ];

  it('matches on the primary name (case- and space-insensitive)', () => {
    expect(matchPersonByName('  robert   smith ', people)?.id).toBe('1');
  });

  it('matches on an alias', () => {
    expect(matchPersonByName('Bob Jones', people)?.id).toBe('1');
  });

  it('returns undefined when nothing matches', () => {
    expect(matchPersonByName('Someone Else', people)).toBeUndefined();
  });

  it('returns undefined for an empty name', () => {
    expect(matchPersonByName('   ', people)).toBeUndefined();
  });

  it('returns undefined when the name is ambiguous', () => {
    const ambiguous = [person('1', 'Sam'), person('2', 'sam', ['Samuel'])];
    expect(matchPersonByName('Sam', ambiguous)).toBeUndefined();
  });
});
