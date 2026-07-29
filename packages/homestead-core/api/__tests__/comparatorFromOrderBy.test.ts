import { describe, expect, test } from 'vitest';
import { comparatorFromOrderBy } from '../resourceHooks';

interface Row {
  name?: string;
  create_time?: string;
  checked?: boolean;
  pages?: number;
}

/** Sort a copy of `rows` and return the values of `field` in order. */
function sortedBy<T>(rows: T[], orderBy: string, field: keyof T): unknown[] {
  return [...rows].sort(comparatorFromOrderBy<T>(orderBy)).map((r) => r[field]);
}

describe('comparatorFromOrderBy', () => {
  test('ascending string order by default', () => {
    const rows: Row[] = [{ name: 'Cherry' }, { name: 'Apple' }, { name: 'Banana' }];
    expect(sortedBy(rows, 'name', 'name')).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  test('- prefix reverses (newest-first create_time)', () => {
    const rows: Row[] = [
      { create_time: '2024-01-01T00:00:00Z' },
      { create_time: '2024-03-01T00:00:00Z' },
      { create_time: '2024-02-01T00:00:00Z' },
    ];
    expect(sortedBy(rows, '-create_time', 'create_time')).toEqual([
      '2024-03-01T00:00:00Z',
      '2024-02-01T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
  });

  test('numeric fields compare as numbers, not strings', () => {
    const rows: Row[] = [{ pages: 100 }, { pages: 20 }, { pages: 3 }];
    // Lexical string sort would give 100 < 20 < 3; numeric must give 3,20,100.
    expect(sortedBy(rows, 'pages', 'pages')).toEqual([3, 20, 100]);
  });

  test('booleans sort false-first ascending (matches "unchecked first")', () => {
    const rows: Row[] = [{ checked: true }, { checked: false }, { checked: true }];
    expect(sortedBy(rows, 'checked', 'checked')).toEqual([false, true, true]);
  });

  test('multi-field: primary then tiebreaker', () => {
    const rows: Row[] = [
      { checked: true, name: 'Apple' },
      { checked: false, name: 'Zebra' },
      { checked: false, name: 'Apple' },
    ];
    const sorted = [...rows].sort(comparatorFromOrderBy<Row>('checked,name'));
    expect(sorted.map((r) => [r.checked, r.name])).toEqual([
      [false, 'Apple'],
      [false, 'Zebra'],
      [true, 'Apple'],
    ]);
  });

  test('whitespace around fields and the - is insignificant', () => {
    const rows: Row[] = [{ name: 'B' }, { name: 'A' }];
    expect(sortedBy(rows, ' name ', 'name')).toEqual(['A', 'B']);
    expect(sortedBy(rows, '- name', 'name')).toEqual(['B', 'A']);
  });

  test('nullish values sort first ascending, last descending', () => {
    const rows: Row[] = [{ name: 'B' }, {}, { name: 'A' }];
    expect(sortedBy(rows, 'name', 'name')).toEqual([undefined, 'A', 'B']);
    expect(sortedBy(rows, '-name', 'name')).toEqual(['B', 'A', undefined]);
  });
});
