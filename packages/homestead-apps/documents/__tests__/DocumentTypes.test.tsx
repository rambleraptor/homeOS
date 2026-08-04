/**
 * The supported-document-types catalogue page. Read-only and declaration-driven
 * — it renders whatever `getDocTypes()` returns — so the assertions check that
 * every known type is listed, grouped by category, with its extracted fields.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentTypes } from '../components/DocumentTypes';
import { getDocTypes } from '../doc-types/registry';

function setup() {
  render(
    <MemoryRouter>
      <DocumentTypes />
    </MemoryRouter>,
  );
}

describe('DocumentTypes', () => {
  it('lists a card for every known doc type', () => {
    setup();
    const cards = screen.getAllByTestId('doc-type-card');
    expect(cards).toHaveLength(getDocTypes().length);
    for (const type of getDocTypes()) {
      expect(screen.getByText(type.label)).toBeInTheDocument();
    }
  });

  it("groups the tax forms under a 'Tax' heading", () => {
    setup();
    const groupLabels = screen
      .getAllByTestId('doc-type-group-label')
      .map((el) => el.textContent);
    expect(groupLabels).toContain('Tax');
  });

  it("puts uncategorised types in an 'Other' group, shown last", () => {
    setup();
    const groupLabels = screen
      .getAllByTestId('doc-type-group-label')
      .map((el) => el.textContent);
    expect(groupLabels).toContain('Other');
    expect(groupLabels[groupLabels.length - 1]).toBe('Other');
  });

  it("shows each type's extracted field labels", () => {
    setup();
    const w2 = getDocTypes().find((t) => t.id === 'form-w2');
    expect(w2).toBeDefined();
    const card = screen
      .getAllByTestId('doc-type-card')
      .find((el) => el.getAttribute('data-doc-type') === 'form-w2');
    expect(card).toBeDefined();
    const firstFieldLabel = Object.values(w2!.fields)[0]!.label;
    expect(within(card!).getByText(firstFieldLabel)).toBeInTheDocument();
  });

  it('links back to the documents index', () => {
    setup();
    expect(screen.getByTestId('doc-types-back')).toHaveAttribute('href', '/documents');
  });
});
