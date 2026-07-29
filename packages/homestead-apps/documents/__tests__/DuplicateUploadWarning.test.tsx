/**
 * The duplicate-upload warning banner. Presentational — driven by props and
 * reports actions through callbacks — so it's tested directly, wrapped only in a
 * router for its "View existing" link.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { DuplicateUploadWarning } from '../components/DuplicateUploadWarning';
import type { DuplicateUpload } from '../duplicates';
import type { Document } from '../types';

function doc(over: Partial<Document> & { id: string }): Document {
  return { path: `documents/${over.id}`, ...over };
}

const dup: DuplicateUpload = {
  upload: doc({ id: 'b', title: 'receipt (1)', content_hash: 'h1' }),
  original: doc({ id: 'a', title: 'receipt', content_hash: 'h1' }),
};

function setup(duplicates: DuplicateUpload[] = [dup]) {
  const onDelete = vi.fn();
  const onDismiss = vi.fn();
  render(
    <MemoryRouter>
      <DuplicateUploadWarning duplicates={duplicates} onDelete={onDelete} onDismiss={onDismiss} />
    </MemoryRouter>,
  );
  return { onDelete, onDismiss };
}

describe('DuplicateUploadWarning', () => {
  it('renders nothing when there are no duplicates', () => {
    setup([]);
    expect(screen.queryByTestId('document-duplicate-warning')).not.toBeInTheDocument();
  });

  it('names the upload and links to the existing document', () => {
    setup();
    expect(screen.getByText(/“receipt \(1\)” looks like a copy/)).toBeInTheDocument();
    expect(screen.getByTestId('document-duplicate-view')).toHaveAttribute(
      'href',
      '/documents/a',
    );
  });

  it('reports delete and dismiss for the right upload', async () => {
    const { onDelete, onDismiss } = setup();
    await userEvent.click(screen.getByTestId('document-duplicate-delete'));
    await userEvent.click(screen.getByTestId('document-duplicate-dismiss'));
    expect(onDelete).toHaveBeenCalledWith('b');
    expect(onDismiss).toHaveBeenCalledWith('b');
  });

  it('shows a deleting state for the upload being removed', () => {
    render(
      <MemoryRouter>
        <DuplicateUploadWarning
          duplicates={[dup]}
          onDelete={vi.fn()}
          onDismiss={vi.fn()}
          deletingId="b"
        />
      </MemoryRouter>,
    );
    const button = screen.getByTestId('document-duplicate-delete');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Deleting…');
  });
});
