/**
 * The index row, checked where the colour system actually meets the list: a
 * recognised document wears its category's tile, and one the app couldn't place
 * stays neutral. Unit-testing the wiring rather than the tone map (see
 * categories.test.ts) — it's the join that silently regresses.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentListItem } from '../components/DocumentListItem';
import { categoryTone } from '../categories';
import type { Document } from '../types';

type Actions = Partial<{
  onDelete: () => void;
  onRemoveFromCollection: () => void;
  collectionName: string;
}>;

function renderRow(document: Partial<Document>, actions: Actions = {}) {
  render(
    <MemoryRouter>
      <DocumentListItem
        document={{ id: 'd1', path: 'documents/d1', title: 'A document', ...document }}
        {...actions}
      />
    </MemoryRouter>,
  );
  return screen.getByTestId('document-card');
}

/** The tile leads the row's link — the colour-bearing element in the row. */
function tileClass(card: HTMLElement): string {
  return card.querySelector('[data-testid="document-open"] span')?.className ?? '';
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

  it("draws the document type's icon exactly once", () => {
    // It was drawn twice — on the tile and again at the row's trailing edge —
    // which read as two facts rather than one said twice.
    renderRow({ parse_status: 'parsed', metadata: { doc_type: 'form-w2' } });
    expect(screen.getAllByTestId('document-type-icon')).toHaveLength(1);
  });

  it('drops the status badge once the type icon stands in for it', () => {
    renderRow({ parse_status: 'parsed', metadata: { doc_type: 'form-w2' } });
    expect(screen.queryByTestId('document-status')).not.toBeInTheDocument();
  });

  it('keeps the status badge while there is no type icon', () => {
    renderRow({ parse_status: 'pending' });
    expect(screen.getByTestId('document-status')).toBeInTheDocument();
  });

  it('opens the document from the row', () => {
    renderRow({});
    expect(screen.getByTestId('document-open')).toHaveAttribute('href', '/documents/d1');
  });

  describe('actions', () => {
    it('is a plain row, not a swipeable one, without handlers', () => {
      // The Home app renders these rows as a read-only shelf; it must stay one.
      renderRow({});
      expect(screen.queryByTestId('document-card-swipe')).not.toBeInTheDocument();
    });

    it('becomes swipeable once an action is available', () => {
      renderRow({}, { onDelete: vi.fn() });
      expect(screen.getByTestId('document-card-swipe')).toBeInTheDocument();
    });

    it('offers its actions by swipe rather than by button', () => {
      renderRow({}, { onDelete: vi.fn(), onRemoveFromCollection: vi.fn() });
      expect(screen.queryByTestId('document-card-delete')).not.toBeInTheDocument();
      expect(screen.queryByTestId('document-card-remove')).not.toBeInTheDocument();
    });
  });
});