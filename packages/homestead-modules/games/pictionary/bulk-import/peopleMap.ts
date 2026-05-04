/**
 * Shared people-name → id loader used by the Pictionary bulk import.
 * Both the preview-time field validators (via `usePeopleNameMap`) and
 * the save-time `useBulkImportPictionary` hook resolve players against
 * this same lowercased-name map.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { PEOPLE } from '../../../people/resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';

interface PersonRecord {
  id: string;
  name: string;
}

export type PeopleByName = Map<string, string>;

export async function loadPeopleMap(): Promise<PeopleByName> {
  const people = await aepbase.list<PersonRecord>(PEOPLE);
  const map: PeopleByName = new Map();
  for (const p of people) {
    map.set(p.name.toLowerCase(), p.id);
  }
  return map;
}

export function usePeopleNameMap() {
  return useQuery({
    queryKey: [...queryKeys.module('people').list(), 'name-map'] as const,
    queryFn: loadPeopleMap,
  });
}
