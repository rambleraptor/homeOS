import { describe, expect, it } from 'vitest';
import { createCsvSerializer, csvEscape, toCsv } from '../csv';
import { parseCsv, type CsvSchema, validateOptionalString, validateRequiredString } from '../../bulk-import/csv';
import type { BulkExportContext } from '../../../resources/bulk-export/types';

const ctx: BulkExportContext = {
  auth: { token: 't', user: { id: 'u', path: 'users/u', email: 'a@b.c' } },
  plural: 'people',
};

describe('csvEscape', () => {
  it('leaves plain values untouched', () => {
    expect(csvEscape('Amazon')).toBe('Amazon');
  });

  it('renders null/undefined as an empty cell', () => {
    expect(csvEscape(null)).toBe('');
    expect(csvEscape(undefined)).toBe('');
  });

  it('quotes and doubles quotes when a value contains a comma, quote, or newline', () => {
    expect(csvEscape('123 Main St, Apt 4')).toBe('"123 Main St, Apt 4"');
    expect(csvEscape('a "quote"')).toBe('"a ""quote"""');
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
  });

  it('joins array values with "; "', () => {
    expect(csvEscape(['Jo', 'Joey'])).toBe('Jo; Joey');
  });
});

describe('createCsvSerializer', () => {
  const serialize = createCsvSerializer<{ name: string; address?: string }>([
    { name: 'name', description: 'Full name' },
    'address',
  ]);

  it('emits a header line in declared column order', () => {
    const csv = serialize.serialize([], ctx) as string;
    expect(csv).toBe('name,address\r\n');
  });

  it('reads each column off the row, escaping as needed', () => {
    const csv = serialize.serialize(
      [{ name: 'Jane Doe', address: '456 Oak Ave, Springfield' }],
      ctx,
    ) as string;
    expect(csv).toBe('name,address\r\nJane Doe,"456 Oak Ave, Springfield"\r\n');
  });

  it('surfaces its columns for the discovery endpoint', () => {
    expect(serialize.columns).toEqual([
      { name: 'name', description: 'Full name' },
      { name: 'address', description: undefined },
    ]);
  });

  it('supports a custom cell accessor', () => {
    const s = createCsvSerializer<{ first: string; last: string }>([
      { name: 'name', value: (r) => `${r.first} ${r.last}` },
    ]);
    expect(s.serialize([{ first: 'Ada', last: 'Lovelace' }], ctx)).toBe('name\r\nAda Lovelace\r\n');
  });
});

describe('export ⇄ import round-trip', () => {
  // A file the serializer emits must re-parse cleanly through the import parser
  // — the whole point of sharing a column list between the two sides.
  interface Row {
    name: string;
    notes?: string;
  }
  const schema: CsvSchema<Row> = {
    requiredFields: [{ name: 'name', required: true, validator: validateRequiredString(200) }],
    optionalFields: [{ name: 'notes', required: false, validator: validateOptionalString(2000) }],
  };
  const serialize = createCsvSerializer<Row>(['name', 'notes']);

  it('preserves values with commas, quotes, and newlines', () => {
    const rows: Row[] = [
      { name: 'Jane Doe', notes: 'Likes: coffee, "tea", and\nlong walks' },
      { name: 'Peter Jones' },
    ];
    const csv = serialize.serialize(rows, ctx) as string;
    const parsed = parseCsv(csv, schema);

    expect(parsed).toHaveLength(2);
    expect(parsed[0].errors).toEqual([]);
    expect(parsed[0].data).toEqual({ name: 'Jane Doe', notes: 'Likes: coffee, "tea", and\nlong walks' });
    expect(parsed[1].data).toEqual({ name: 'Peter Jones' });
  });
});

describe('toCsv', () => {
  it('terminates every record with CRLF, including the last', () => {
    expect(toCsv([{ name: 'a' }], [{ a: 1 } as never])).toMatch(/\r\n$/);
  });
});
