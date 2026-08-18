/**
 * The index row, checked where the colour system actually meets the list: a
 * recognised document wears its category's tile, and one the app couldn't place
 * stays neutral. Unit-testing the wiring rather than the tone map (see
 * categories.test.ts) — it's the join that silently regresses.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentListItem } from '../components/DocumentListItem';
import { categoryTone } from '../categories';
import type { Document } from '../types';

function renderRow(document: Partial<Document>) {
  render(
    <MemoryRouter>
      <DocumentListItem
        document={{ id: 'd1', path: 'documents/d1', title: 'A document', ...document }}
      />
    </MemoryRouter>,
  );
  return screen.getByTestId('document-card');
}

/** The tile is the first child span — the colour-bearing element in the row. */
function tileClass(card: HTMLElement): string {
  return card.querySelector('span')?.className ?? '';
}

describe('DocumentListItem', () => {
  it("gives a parsed document its category's tile", () => {
    const card = renderRow({
      parse_status: 'parsed',
      metadata: { doc_type: 'form-w2' },
    });
    expect(tileClass(card)).toContain(categoryTone('tax').surface);
  });

  it('gives a medical document a different tile from a tax one', () => {
    const card = renderRow({
      parse_status: 'parsed',
      metadata: { doc_type: 'lab-result' },
    });
    const tile = tileClass(card);
    expect(tile).toContain(categoryTone('medical').surface);
    expect(tile).not.toContain(categoryTone('tax').surface);
  });

  it('leaves a document that matched no type on the neutral file glyph', () => {
    const card = renderRow({
      parse_status: 'unmatched',
      mime_type: 'application/pdf',
      metadata: { doc_type: 'unknown' },
    });
    expect(tileClass(card)).not.toContain(categoryTone('tax').surface);
  });

  it('does not mark a document that was already parsed on arrival as revealing', () => {
    const card = renderRow({
      parse_status: 'parsed',
      metadata: { doc_type: 'form-w2' },
    });
    expect(card).not.toHaveAttribute('data-revealing');
  });
});
