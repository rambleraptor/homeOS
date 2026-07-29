import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { refToId } from '@rambleraptor/homestead-core/resources/references';
import { ADDRESSES, PEOPLE, PERSON_SHARED_DATA } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { Person, PersonSharedData, Address } from '../types';

interface PersonRecord {
  id: string;
  name: string;
  aliases?: string[];
  created_by?: string;
  create_time?: string;
  update_time?: string;
}

function toPerson(
  record: PersonRecord,
  addresses: Address[],
  partner?: Person,
): Person {
  return {
    ...record,
    aliases: record.aliases ?? [],
    created: record.create_time || '',
    updated: record.update_time || '',
    created_by: record.created_by || '',
    addresses,
    partner,
  };
}

// Joins people + person_shared_data + addresses client-side — aepbase doesn't
// support server-side joining. Filtering happens in the list component via
// the shared FilterBar; this hook always returns the full collection.
export function usePeople() {
  return useQuery({
    queryKey: queryKeys.app('people').list(),
    queryFn: async () => {
      const [peopleRecords, allSharedData, allAddresses] = await Promise.all([
        aepbase.list<PersonRecord>(PEOPLE),
        aepbase.list<PersonSharedData>(PERSON_SHARED_DATA),
        aepbase.list<Address>(ADDRESSES),
      ]);

      peopleRecords.sort((a, b) => a.name.localeCompare(b.name));

      // Reference fields (person_a/person_b/address_id/shared_data_id) are
      // stored as `{plural}/{id}` paths; normalize to bare ids for the joins.
      const sharedByPerson = new Map<string, PersonSharedData>();
      for (const sd of allSharedData) {
        sharedByPerson.set(refToId(sd.person_a), sd);
        if (sd.person_b) sharedByPerson.set(refToId(sd.person_b), sd);
      }
      const addressById = new Map(allAddresses.map((a) => [a.id, a]));
      const recordById = new Map(peopleRecords.map((p) => [p.id, p]));

      const addressesFor = (sd?: PersonSharedData): Address[] => {
        if (!sd) return [];
        const primaryId = refToId(sd.address_id);
        const primary = primaryId ? addressById.get(primaryId) : undefined;
        const extras = allAddresses.filter(
          (a) => refToId(a.shared_data_id) === sd.id && a.id !== primaryId,
        );
        return primary ? [primary, ...extras] : extras;
      };

      return peopleRecords.map((record) => {
        const sharedData = sharedByPerson.get(record.id);
        const addresses = addressesFor(sharedData);

        const partnerId = sharedData
          ? refToId(sharedData.person_a) === record.id
            ? refToId(sharedData.person_b)
            : refToId(sharedData.person_a)
          : undefined;
        const partnerRecord = partnerId ? recordById.get(partnerId) : undefined;
        const partner = partnerRecord
          ? toPerson(partnerRecord, addresses)
          : undefined;

        return toPerson(record, addresses, partner);
      });
    },
  });
}
