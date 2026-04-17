import { describe, it, expect } from 'vitest';
import { buildCelFilter } from '../buildCelFilter';
import type { OmniboxFilterDecl } from '../types';

describe('buildCelFilter', () => {
  it('returns undefined when no decls match values', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
    ];
    expect(buildCelFilter(decls, {})).toBeUndefined();
    expect(buildCelFilter(decls, { other: 'x' })).toBeUndefined();
  });

  it('builds a case-insensitive matches() clause for text filters', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
    ];
    expect(buildCelFilter(decls, { name: 'John' })).toBe(
      'name.matches("(?i)John")',
    );
  });

  it('AND-joins multiple whitespace-separated text terms', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
    ];
    expect(buildCelFilter(decls, { name: 'John Doe' })).toBe(
      'name.matches("(?i)John") && name.matches("(?i)Doe")',
    );
  });

  it('escapes regex metacharacters in text values', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
    ];
    // Regex `\.` is escaped once more for the surrounding CEL string literal
    // so the on-the-wire pattern is `\.` after CEL parsing.
    expect(buildCelFilter(decls, { name: 'a.b' })).toBe(
      'name.matches("(?i)a\\\\.b")',
    );
  });

  it('escapes embedded quotes in text values', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
    ];
    // `"` isn't a regex special, but it must be escaped for the CEL string
    // literal — one backslash before the quote.
    expect(buildCelFilter(decls, { name: 'O"Hara' })).toBe(
      'name.matches("(?i)O\\"Hara")',
    );
  });

  it('skips text values that are empty or whitespace only', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
    ];
    expect(buildCelFilter(decls, { name: '   ' })).toBeUndefined();
    expect(buildCelFilter(decls, { name: '' })).toBeUndefined();
  });

  it('builds equality for enum filters and rejects unknown values', () => {
    const decls: OmniboxFilterDecl[] = [
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        values: ['active', 'archived'],
      },
    ];
    expect(buildCelFilter(decls, { status: 'active' })).toBe(
      'status == "active"',
    );
    expect(buildCelFilter(decls, { status: 'bogus' })).toBeUndefined();
  });

  it('builds boolean equality from booleans and from string aliases', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'archived', label: 'Archived', type: 'boolean' },
    ];
    expect(buildCelFilter(decls, { archived: true })).toBe('archived == true');
    expect(buildCelFilter(decls, { archived: false })).toBe(
      'archived == false',
    );
    expect(buildCelFilter(decls, { archived: 'true' })).toBe(
      'archived == true',
    );
    expect(buildCelFilter(decls, { archived: 'maybe' })).toBeUndefined();
  });

  it('builds dateRange clauses with start, end, or both', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'birthday', label: 'Birthday', type: 'dateRange' },
    ];
    expect(
      buildCelFilter(decls, {
        birthday: { start: '2025-01-01', end: '2025-12-31' },
      }),
    ).toBe('birthday >= "2025-01-01" && birthday <= "2025-12-31"');
    expect(buildCelFilter(decls, { birthday: { start: '2025-01-01' } })).toBe(
      'birthday >= "2025-01-01"',
    );
    expect(buildCelFilter(decls, { birthday: { end: '2025-12-31' } })).toBe(
      'birthday <= "2025-12-31"',
    );
    expect(buildCelFilter(decls, { birthday: {} })).toBeUndefined();
  });

  it('AND-joins clauses across multiple filters', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
      {
        key: 'status',
        label: 'Status',
        type: 'enum',
        values: ['active', 'archived'],
      },
    ];
    expect(
      buildCelFilter(decls, { name: 'John', status: 'active' }),
    ).toBe('name.matches("(?i)John") && status == "active"');
  });

  it('uses the `field` override when provided', () => {
    const decls: OmniboxFilterDecl[] = [
      {
        key: 'name',
        label: 'Name',
        type: 'text',
        field: 'profile.display_name',
      },
    ];
    expect(buildCelFilter(decls, { name: 'John' })).toBe(
      'profile.display_name.matches("(?i)John")',
    );
  });

  it('ignores values whose type does not match the decl', () => {
    const decls: OmniboxFilterDecl[] = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'archived', label: 'Archived', type: 'boolean' },
    ];
    expect(
      buildCelFilter(decls, { name: 42, archived: 'sometimes' }),
    ).toBeUndefined();
  });
});
