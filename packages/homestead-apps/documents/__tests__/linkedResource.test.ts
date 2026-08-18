/**
 * Reading back what a post-classify hook created. The parsing has to survive a
 * malformed or unknown value without throwing, because it runs on the detail
 * page of every document and a bad pointer must not take the page down.
 */

import { describe, it, expect } from 'vitest';
import { describeLinkedResource } from '../linkedResource';

describe('describeLinkedResource', () => {
  it('describes an HSA receipt, linking to the app that holds it', () => {
    const linked = describeLinkedResource('hsa-receipts/abc123');
    expect(linked).toMatchObject({
      plural: 'hsa-receipts',
      id: 'abc123',
      label: 'HSA receipt',
      article: 'an',
      href: '/hsa',
    });
  });

  it('links a recipe to its own page', () => {
    expect(describeLinkedResource('recipes/xyz')).toMatchObject({
      id: 'xyz',
      label: 'recipe',
      href: '/recipes/xyz',
    });
  });

  it('guesses the article for a target that does not declare one', () => {
    expect(describeLinkedResource('recipes/x')?.article).toBe('a');
    expect(describeLinkedResource('appliances/x')?.article).toBe('an');
  });

  it('still describes an unmapped target, just without a link', () => {
    // A newly-added post_classify hook whose target nobody registered here:
    // better to say something was created than to say nothing at all.
    const linked = describeLinkedResource('warranty-claims/7');
    expect(linked).toMatchObject({ label: 'warranty claims', id: '7' });
    expect(linked?.href).toBeUndefined();
  });

  it('returns null for an absent value', () => {
    expect(describeLinkedResource(undefined)).toBeNull();
    expect(describeLinkedResource('')).toBeNull();
  });

  it('returns null for a malformed path rather than throwing', () => {
    expect(describeLinkedResource('no-separator')).toBeNull();
    expect(describeLinkedResource('/leading')).toBeNull();
    expect(describeLinkedResource('trailing/')).toBeNull();
  });
});
