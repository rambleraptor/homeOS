/**
 * The Home documents page: a read-only, grouped view over the Documents list,
 * narrowed to the Home doc types. `useDocuments` is mocked so the test drives
 * the list directly and asserts the narrowing, grouping, and empty state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Document } from '../../documents/types';

const useDocuments = vi.fn();
vi.mock('../../documents/hooks/useDocuments', () => ({
  useDocuments: () => useDocuments(),
}));

import { HomeDocuments } from '../components/HomeDocuments';

const doc = (id: string, title: string, docType?: string): Document =>
  ({ id, title, metadata: docType ? { doc_type: docType } : undefined }) as Document;

function setup() {
  render(
    <MemoryRouter>
      <HomeDocuments />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useDocuments.mockReset();
});

describe('HomeDocuments', () => {
  it('shows only home documents, grouped by type', () => {
    useDocuments.mockReturnValue({
      data: [
        doc('1', 'Fridge manual', 'appliance-manual'),
        doc('2', 'Dishwasher plan', 'warranty'),
        doc('3', 'W-2', 'form-w2'), // not a home type
        doc('4', 'Vet bill', 'medical-receipt'), // not a home type
        doc('5', 'Scan', undefined), // still being read
      ],
      isLoading: false,
      isError: false,
    });
    setup();

    // The two home docs render; the non-home ones don't.
    expect(screen.getByText('Fridge manual')).toBeInTheDocument();
    expect(screen.getByText('Dishwasher plan')).toBeInTheDocument();
    expect(screen.queryByText('W-2')).not.toBeInTheDocument();
    expect(screen.queryByText('Vet bill')).not.toBeInTheDocument();
    expect(screen.queryByText('Scan')).not.toBeInTheDocument();

    // Each surviving doc sits under its type's group.
    expect(
      within(screen.getByTestId('home-documents-group-appliance-manual')).getByText(
        'Fridge manual',
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('home-documents-group-warranty')).getByText(
        'Dishwasher plan',
      ),
    ).toBeInTheDocument();
  });

  it('shows the empty state when no home documents are present', () => {
    useDocuments.mockReturnValue({
      data: [doc('3', 'W-2', 'form-w2')],
      isLoading: false,
      isError: false,
    });
    setup();
    expect(screen.getByTestId('home-documents-empty')).toBeInTheDocument();
  });

  it('shows a spinner while loading', () => {
    useDocuments.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    setup();
    expect(screen.getByTestId('home-documents-loading')).toBeInTheDocument();
  });
});
