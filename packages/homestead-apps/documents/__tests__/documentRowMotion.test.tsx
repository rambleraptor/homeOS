/**
 * The list's motion, checked at the seams where it is wired rather than at the
 * CSS (which the browser owns).
 *
 * Three things can regress silently here: a row that stops animating in, a
 * pending document losing the sheen that distinguishes it from a finished one
 * at list distance, and — the one that actually breaks something — an exiting
 * row staying in the accessibility tree while it collapses toward deletion.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentListItem } from '../components/DocumentListItem';
import { DocumentFileTile } from '../components/DocumentFileTile';
import type { Document } from '../types';

function doc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'd1',
    path: 'documents/d1',
    title: 'A document',
    ...overrides,
  } as Document;
}

function renderRow(props: Partial<React.ComponentProps<typeof DocumentListItem>> = {}) {
  const { container } = render(
    <MemoryRouter>
      <DocumentListItem document={doc(props.document)} {...props} />
    </MemoryRouter>,
  );
  // The animated shell is the outermost element the component renders.
  return container.firstElementChild as HTMLElement;
}

describe('row entrance', () => {
  it('rises into place', () => {
    expect(renderRow().className).toContain('animate-field-rise');
  });

  it('holds its entrance back by the delay the caller sets', () => {
    const shell = renderRow({ enterDelayMs: 66 });
    expect(shell.style.animationDelay).toBe('66ms');
  });

  it('defaults to no delay, so a lone new row does not sit invisible', () => {
    expect(renderRow().style.animationDelay).toBe('0ms');
  });
});

describe('row exit', () => {
  it('collapses instead of rising when it is on its way out', () => {
    const shell = renderRow({ exiting: true });
    expect(shell.className).toContain('animate-row-collapse');
    expect(shell.className).not.toContain('animate-field-rise');
  });

  it('carries no entrance delay while exiting', () => {
    // A leftover delay would hold the collapse back and leave the row sitting
    // there after the delete had already been sent.
    expect(renderRow({ exiting: true }).style.animationDelay).toBe('');
  });

  it('leaves the accessibility tree on the way out', () => {
    // Focus or a screen reader landing on a row that is about to stop existing
    // is the one part of this that is a bug rather than a missing flourish.
    expect(renderRow({ exiting: true })).toHaveAttribute('aria-hidden', 'true');
  });

  it('stays in the accessibility tree while it is a normal row', () => {
    expect(renderRow()).not.toHaveAttribute('aria-hidden');
  });
});

describe('reading shimmer', () => {
  function tile(document: Partial<Document>) {
    const { container } = render(<DocumentFileTile document={doc(document)} />);
    return container.firstElementChild as HTMLElement;
  }

  it('marks a document that is still being read', () => {
    const glyph = tile({ parse_status: 'pending', mime_type: 'application/pdf' });
    expect(glyph).toHaveAttribute('data-reading', 'true');
    expect(glyph.querySelector('.animate-tile-shimmer')).not.toBeNull();
  });

  it('treats a missing status as still reading', () => {
    // An upload that has not been stamped yet arrives with no parse_status.
    expect(tile({ mime_type: 'application/pdf' })).toHaveAttribute('data-reading', 'true');
  });

  it('stops once the document has been read', () => {
    const glyph = tile({ parse_status: 'parsed', metadata: { doc_type: 'form-w2' } });
    expect(glyph).not.toHaveAttribute('data-reading');
    expect(glyph.querySelector('.animate-tile-shimmer')).toBeNull();
  });

  it('does not shimmer a finished outcome that matched nothing', () => {
    // `unmatched` and `failed` are answers, not work in progress — a sheen on
    // either would promise a result that is never coming.
    const unmatched = tile({ parse_status: 'unmatched', mime_type: 'application/pdf' });
    expect(unmatched.querySelector('.animate-tile-shimmer')).toBeNull();

    const failed = tile({ parse_status: 'failed', mime_type: 'image/png' });
    expect(failed.querySelector('.animate-tile-shimmer')).toBeNull();
  });

  it('clips the sheen to the tile', () => {
    const glyph = tile({ parse_status: 'pending', mime_type: 'application/pdf' });
    expect(glyph.className).toContain('overflow-hidden');
    expect(glyph.className).toContain('relative');
  });
});
