import { test, expect } from 'bun:test';
import { needsUpdate } from './update.ts';

test('needsUpdate is false only when the two commits match', () => {
  expect(needsUpdate('abc123', 'abc123')).toBe(false);
  expect(needsUpdate('abc123', 'def456')).toBe(true);
  expect(needsUpdate('', 'def456')).toBe(true);
});
