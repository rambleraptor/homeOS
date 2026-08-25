/**
 * The two facts the app knew and never said. Both are conditional, and the
 * condition matters: the panel has to disappear entirely for an ordinary
 * hand-uploaded document, which is most of them.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocumentOrigin } from '../components/DocumentOrigin';
import type { Document } from '../types';

function renderOrigin(document: Partial<Document>) {
  render(
    <MemoryRouter>
      <DocumentOrigin document={{ id: 'd1', path: 'documents/d1', ...document }} />
    </MemoryRouter>,
  );
}

describe('DocumentOrigin', () => {
  it('renders nothing for a plain hand-uploaded document', () => {
    renderOrigin({ title: 'A scan' });
    expect(screen.queryByTestId('document-origin')).not.toBeInTheDocument();
  });

  it('says when a document was filed from an email', () => {
    renderOrigin({ source_email_id: 'msg-1' });
    expect(screen.getByTestId('document-origin-email')).toHaveTextContent(
      /from an email attachment/i,
    );
  });

  it('says when the document is the email body itself, not an attachment', () => {
    renderOrigin({ source_email_id: 'msg-1', source_email_attachment: 'body' });
    const origin = screen.getByTestId('document-origin-email');
    expect(origin).toHaveTextContent(/from an email\./i);
    expect(origin).not.toHaveTextContent(/attachment/i);
  });

  it('links to the record a post-classify hook created', () => {
    renderOrigin({ linked_resource: 'recipes/r1' });
    const link = screen.getByTestId('document-origin-link');
    expect(link).toHaveAttribute('href', '/recipes/r1');
    expect(link).toHaveTextContent(/saved as a recipe/i);
  });

  it('uses the right article for a vowel-initial label', () => {
    renderOrigin({ linked_resource: 'hsa-receipts/h1' });
    expect(screen.getByTestId('document-origin-link')).toHaveTextContent(
      /saved as an HSA receipt/i,
    );
  });

  it('shows both facts together when both apply', () => {
    renderOrigin({ source_email_id: 'msg-1', linked_resource: 'hsa-receipts/h1' });
    expect(screen.getByTestId('document-origin-email')).toBeInTheDocument();
    expect(screen.getByTestId('document-origin-link')).toBeInTheDocument();
  });

  it('does not render a link for a malformed pointer', () => {
    renderOrigin({ linked_resource: 'garbage' });
    expect(screen.queryByTestId('document-origin')).not.toBeInTheDocument();
  });
});
