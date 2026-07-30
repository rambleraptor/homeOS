/**
 * Unit tests for getAepErrorMessage — the single AEP error → message mapper
 * used by the global mutation error toast and useToast().error().
 *
 * The global setup mocks api/aepbase, so `AepbaseError` here is the mocked
 * class — the same one the helper imports and narrows on, so `instanceof`
 * stays consistent.
 */

import { describe, it, expect } from 'vitest';
import { AepbaseError } from '../aepbase';
import { getAepErrorMessage } from '../errorMessage';

describe('getAepErrorMessage', () => {
  it("prefers the server's message on an AepbaseError", () => {
    const err = new AepbaseError(400, 'missing required fields: merchant', '/x');
    expect(getAepErrorMessage(err)).toBe('missing required fields: merchant');
  });

  it('falls back to a per-code message when an AepbaseError has no message', () => {
    const err = new AepbaseError(403, '', '/x');
    expect(getAepErrorMessage(err)).toBe("You don't have permission to do that.");
  });

  it('uses the generic message for an unmapped code with no message', () => {
    const err = new AepbaseError(418, '', '/x');
    expect(getAepErrorMessage(err)).toBe('Something went wrong. Please try again.');
  });

  it('reports a network hint for a fetch TypeError', () => {
    expect(getAepErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'Network error — check your connection and try again.',
    );
  });

  it('surfaces a plain Error message', () => {
    expect(getAepErrorMessage(new Error('boom'))).toBe('boom');
  });

  it('passes a non-empty string through unchanged', () => {
    expect(getAepErrorMessage('custom message')).toBe('custom message');
  });

  it('falls back to the generic message for unknown values', () => {
    expect(getAepErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
    expect(getAepErrorMessage({ nope: true })).toBe(
      'Something went wrong. Please try again.',
    );
  });
});
