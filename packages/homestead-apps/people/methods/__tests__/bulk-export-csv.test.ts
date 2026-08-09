import { describe, expect, it, vi } from 'vitest';
import type { BulkExportContext } from '@rambleraptor/homestead-core/resources/bulk-export/types';

// The source reads three collections through the server client; stub it so the
// test drives the join off seeded in-memory data rather than the engine.
const collections: Record<string, unknown[]> = {
  people: [
    { id: 'p1', name: 'Jane Doe' },
    { id: 'p2', name: 'John Doe' },
    { id: 'p3', name: 'Peter Jones' },
  ],
  addresses: [
    { id: 'a1', line1: '123 Main St', wifi_network: 'HomeWiFi', wifi_password: 'pw' },
  ],
  'person-shared-data': [
    { id: 's1', person_a: 'p1', person_b: 'p2', address_id: 'a1' },
  ],
};

const listAll = vi.fn(async (plural: string) => collections[plural] ?? []);

vi.mock('@rambleraptor/homestead-core/server/client', () => ({
  serverClient: () => ({
    collection: (plural: string) => ({ listAll: () => listAll(plural) }),
  }),
}));

const { source } = await import('../bulk-export-csv');

const ctx: BulkExportContext = {
  auth: { token: 't', user: { id: 'u', path: 'users/u', email: 'a@b.c' } },
  plural: 'people',
};

describe('people export source', () => {
  it('flattens each person with their joined address and partner name', async () => {
    const rows = await source({ ctx });
    expect(rows).toEqual([
      {
        name: 'Jane Doe',
        address: '123 Main St',
        wifi_network: 'HomeWiFi',
        wifi_password: 'pw',
        partner_name: 'John Doe',
      },
      {
        // Shares the same address record and is the other half of the couple.
        name: 'John Doe',
        address: '123 Main St',
        wifi_network: 'HomeWiFi',
        wifi_password: 'pw',
        partner_name: 'Jane Doe',
      },
      {
        // No shared-data record: address and partner come back undefined.
        name: 'Peter Jones',
        address: undefined,
        wifi_network: undefined,
        wifi_password: undefined,
        partner_name: undefined,
      },
    ]);
  });
});
