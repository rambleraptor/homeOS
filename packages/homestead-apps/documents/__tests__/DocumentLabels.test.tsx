/**
 * The read view of what a document is connected to. The interesting cases are
 * the resolution ones: ids are stored on the document but the names live in
 * other queries, so a chip has to wait for its list rather than render an id.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { DocumentLabels } from '../components/DocumentLabels';
import { PEOPLE } from '../../people/resources';
import { COLLECTIONS } from '../resources';
import type { Document } from '../types';

const COLLECTION = { id: 'c1', path: 'collections/c1', name: 'Taxes 2024', color: '#ff0000' };
const PERSON = { id: 'p1', name: 'Dana Whitfield' };

beforeEach(() => {
  vi.clearAllMocks();
  // Both hooks fan out over several collections; answer by name and let the
  // rest come back empty.
  vi.mocked(aepbase.list).mockImplementation(((collection: string) => {
    if (collection === COLLECTIONS) return Promise.resolve([COLLECTION]);
    if (collection === PEOPLE) return Promise.resolve([PERSON]);
    return Promise.resolve([]);
  }) as never);
});

async function renderLabels(document: Partial<Document>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Seed the caches directly so the chips render without waiting on the network.
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DocumentLabels document={{ id: 'd1', path: 'documents/d1', ...document }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DocumentLabels', () => {
  it('renders nothing when a document has no tags, collections or people', async () => {
    await renderLabels({});
    expect(screen.queryByTestId('document-labels')).not.toBeInTheDocument();
  });

  it('shows a document’s tags', async () => {
    await renderLabels({ tags: ['annual', 'scanned'] });
    expect(await screen.findByTestId('document-tag-annual')).toBeInTheDocument();
    expect(screen.getByTestId('document-tag-scanned')).toBeInTheDocument();
  });

  it('names the collections a document is filed in', async () => {
    await renderLabels({ collections: ['c1'] });
    expect(await screen.findByTestId('document-collection-c1')).toHaveTextContent(
      'Taxes 2024',
    );
  });

  it('does not render a chip for a collection id it cannot resolve', async () => {
    // A stale id, or a list still in flight — either way an id is not a name.
    await renderLabels({ collections: ['gone'] });
    expect(screen.queryByTestId('document-collection-gone')).not.toBeInTheDocument();
  });

  it('links a person chip to that person', async () => {
    await renderLabels({ people: ['p1'] });
    const chip = await screen.findByTestId('document-person-p1');
    expect(chip).toHaveAttribute('href', '/people/p1');
    expect(chip).toHaveTextContent('Dana Whitfield');
  });
});
