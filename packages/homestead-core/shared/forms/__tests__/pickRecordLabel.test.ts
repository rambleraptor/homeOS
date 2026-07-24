import { describe, expect, it } from 'vitest';
import { pickRecordLabel } from '../pickRecordLabel';

describe('pickRecordLabel', () => {
  it('prefers title', () => {
    expect(pickRecordLabel({ id: '1', title: 'My Todo', name: 'ignored' })).toBe(
      'My Todo',
    );
  });

  it('falls back to name, trimming a resource path', () => {
    expect(pickRecordLabel({ id: '1', name: 'people/abc123' })).toBe('abc123');
    expect(pickRecordLabel({ id: '1', name: 'Kitchen' })).toBe('Kitchen');
  });

  it('uses display_name then email for user-like records', () => {
    expect(pickRecordLabel({ id: '1', display_name: 'Ada' })).toBe('Ada');
    expect(pickRecordLabel({ id: '1', email: 'ada@example.com' })).toBe(
      'ada@example.com',
    );
  });

  it('falls back to the id when no display field is present', () => {
    expect(pickRecordLabel({ id: 'xyz' })).toBe('xyz');
  });

  it('ignores blank/whitespace display fields', () => {
    expect(pickRecordLabel({ id: 'xyz', title: '   ', name: '' })).toBe('xyz');
  });
});
