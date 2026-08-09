import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  initializeAppRegistry,
  resetAppRegistry,
} from '../../../apps/registry';
import { createCsvSerializer } from '../csv';
import type { AppConfig } from '../../../apps/types';
import type {
  CustomMethodContext,
  ResourceDefinition,
} from '../../../resources/types';
import type { BulkExportSource } from '../../../resources/bulk-export/types';

// The default source lists the resource's own collection through the server
// client; stub it so that path is observable without the engine.
const listAll = vi.fn(async (_opts?: unknown): Promise<unknown[]> => [
  { id: 'r1', name: 'Row A' },
  { id: 'r2', name: 'Row B' },
]);
const collection = vi.fn((_plural: string) => ({ listAll }));
vi.mock('../../client', () => ({ serverClient: () => ({ collection }) }));

const { default: bulkExport } = await import('../handler');

function defWith(source?: BulkExportSource): ResourceDefinition {
  return {
    singular: 'thing',
    plural: 'things',
    fields: { name: { type: 'string', required: true } },
    bulkExport: {
      formats: [
        {
          id: 'csv',
          label: 'CSV',
          mimeType: 'text/csv',
          extension: 'csv',
          load: async () => ({ default: createCsvSerializer(['name']) }),
        },
      ],
      ...(source ? { source: async () => ({ source }) } : {}),
    },
  };
}

function register(def: ResourceDefinition): void {
  const app: AppConfig = { id: 'things', name: 'Things', description: 't', resources: [def] };
  initializeAppRegistry([app]);
}

function ctx(url: string): CustomMethodContext {
  return {
    request: new Request(url),
    auth: { token: 't', user: { id: 'u', path: 'users/u', email: 'a@b.c' } },
    plural: 'things',
    verb: 'bulk-export',
    target: 'collection',
    parent: [],
  };
}

afterEach(() => {
  resetAppRegistry();
  vi.clearAllMocks();
});

describe('bulk-export handler', () => {
  it('streams the CSV with attachment headers, defaulting the format and filename', async () => {
    register(defWith(async () => [{ name: 'Ada' }, { name: 'Grace' }]));
    const res = await bulkExport(ctx('http://x/api/aep/things:bulk-export'));

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv');
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="things.csv"');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.text()).toBe('name\r\nAda\r\nGrace\r\n');
  });

  it('falls back to listing the resource collection when no source is declared', async () => {
    register(defWith());
    const res = await bulkExport(
      ctx('http://x/api/aep/things:bulk-export?filter=' + encodeURIComponent('name = "A"')),
    );

    expect(collection).toHaveBeenCalledWith('things');
    expect(listAll).toHaveBeenCalledWith({ filter: 'name = "A"' });
    expect(await res.text()).toBe('name\r\nRow A\r\nRow B\r\n');
  });

  it('passes the request filter through to a custom source', async () => {
    const source = vi.fn(async () => [{ name: 'x' }]);
    register(defWith(source));
    await bulkExport(ctx('http://x/api/aep/things:bulk-export?filter=active'));

    expect(source).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'active', ctx: expect.objectContaining({ plural: 'things' }) }),
    );
  });

  it('passes a record-selection filter through to the default source', async () => {
    // Selection travels as an `id in [...]` filter, not a bespoke param.
    register(defWith());
    await bulkExport(
      ctx('http://x/api/aep/things:bulk-export?filter=' + encodeURIComponent('id in ["r2"]')),
    );
    expect(listAll).toHaveBeenCalledWith({ filter: 'id in ["r2"]' });
  });

  it('honors a filename override, sanitizing path separators', async () => {
    register(defWith(async () => []));
    const res = await bulkExport(
      ctx('http://x/api/aep/things:bulk-export?filename=' + encodeURIComponent('a/b/roster.csv')),
    );
    expect(res.headers.get('Content-Disposition')).toBe('attachment; filename="a-b-roster.csv"');
  });

  it('rejects an unknown format with 400', async () => {
    register(defWith(async () => []));
    const res = await bulkExport(ctx('http://x/api/aep/things:bulk-export?format=xlsx'));
    expect(res.status).toBe(400);
  });

  it('404s a resource that does not support bulk export', async () => {
    register({ singular: 'plain', plural: 'plains', fields: {} } as ResourceDefinition);
    const res = await bulkExport({
      ...ctx('http://x/api/aep/plains:bulk-export'),
      plural: 'plains',
    });
    expect(res.status).toBe(404);
  });
});
