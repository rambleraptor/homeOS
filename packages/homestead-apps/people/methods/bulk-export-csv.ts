/**
 * People CSV export — serializer and the joining source.
 *
 * Server-only (under `methods/`, so the client build stubs it out).
 *
 * This is the inverse of `./bulk-import-csv.ts`. The importer's saver writes a
 * person plus an address (in a sibling resource, linked through
 * `person-shared-data`) plus a partner link; the exporter's source walks that
 * same graph backwards and flattens each person into one row. Because both sides
 * share {@link personCsvSchema}'s column list, a file exported here re-imports
 * cleanly.
 */

import { createCsvSerializer } from '@rambleraptor/homestead-core/server/bulk-export/csv';
import type {
  BulkExportSource,
  BulkExportContext,
} from '@rambleraptor/homestead-core/resources/bulk-export/types';
import { serverClient } from '@rambleraptor/homestead-core/server/client';
import { ADDRESSES, PEOPLE, PERSON_SHARED_DATA } from '../resources';
import { personCsvSchema, type PersonCsvData } from './bulk-import-csv';

/** Columns, in the import template's order — so export ⇄ import round-trips. */
const columns = [
  ...personCsvSchema.requiredFields,
  ...personCsvSchema.optionalFields,
].map((field) => ({ name: field.name, description: field.description }));

interface PersonRecord {
  id: string;
  name: string;
}
interface AddressRecord {
  id: string;
  line1?: string;
  wifi_network?: string;
  wifi_password?: string;
}
interface SharedDataRecord {
  id: string;
  person_a: string;
  person_b?: string;
  address_id?: string;
}

/**
 * Flatten every person into a row: their name, the address hanging off their
 * shared-data record, and their partner's name. One list per collection, joined
 * in memory — the same three collections the importer wrote.
 */
export const source: BulkExportSource<PersonCsvData> = async ({
  ctx,
  filter,
}: {
  ctx: BulkExportContext;
  filter?: string;
}) => {
  const hs = serverClient(ctx.auth.token);
  const [people, shared, addresses] = await Promise.all([
    hs.collection<PersonRecord>(PEOPLE).listAll(filter ? { filter } : undefined),
    hs.collection<SharedDataRecord>(PERSON_SHARED_DATA).listAll(),
    hs.collection<AddressRecord>(ADDRESSES).listAll(),
  ]);

  const addressById = new Map(addresses.map((a) => [a.id, a]));
  const nameById = new Map(people.map((p) => [p.id, p.name]));
  // Every shared-data record each person appears in, from either side.
  const linksByPerson = new Map<string, SharedDataRecord[]>();
  for (const link of shared) {
    for (const id of [link.person_a, link.person_b]) {
      if (!id) continue;
      const list = linksByPerson.get(id) ?? [];
      list.push(link);
      linksByPerson.set(id, list);
    }
  }

  return people.map((person) => {
    const links = linksByPerson.get(person.id) ?? [];
    const withAddress = links.find((l) => l.address_id);
    const address = withAddress?.address_id
      ? addressById.get(withAddress.address_id)
      : undefined;
    const partnerLink = links.find(
      (l) => l.person_a && l.person_b && (l.person_a === person.id || l.person_b === person.id),
    );
    const partnerId = partnerLink
      ? partnerLink.person_a === person.id
        ? partnerLink.person_b
        : partnerLink.person_a
      : undefined;

    return {
      name: person.name,
      address: address?.line1 || undefined,
      wifi_network: address?.wifi_network || undefined,
      wifi_password: address?.wifi_password || undefined,
      partner_name: partnerId ? nameById.get(partnerId) : undefined,
    };
  });
};

export default createCsvSerializer<PersonCsvData>(columns);
