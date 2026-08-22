/**
 * The four reasons the documents index can have nothing to show. Presentational
 * — the reason and the handlers come from the page — so each case is rendered
 * directly and checked for the copy and the action that resolves it.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentsEmptyState } from '../components/DocumentsEmptyState';

describe('DocumentsEmptyState', () => {
  it('keeps the fresh-library state on its own testid', () => {
    render(<DocumentsEmptyState reason="library" />);
    const panel = screen.getByTestId('documents-empty');
    expect(panel).toHaveAttribute('data-empty-reason', 'library');
    expect(panel).toHaveTextContent('No documents yet');
  });

  it('offers no action for a fresh library — the dropzone above is the action', () => {
    render(<DocumentsEmptyState reason="library" />);
    expect(screen.queryByTestId('documents-empty-action')).not.toBeInTheDocument();
  });

  it('clears the filters from the no-matches state', async () => {
    const user = userEvent.setup();
    const onClearFilters = vi.fn();
    render(<DocumentsEmptyState reason="filters" onClearFilters={onClearFilters} />);

    const panel = screen.getByTestId('documents-no-matches');
    expect(panel).toHaveAttribute('data-empty-reason', 'filters');
    await user.click(screen.getByTestId('documents-empty-action'));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('names the empty collection and says how to file into it', async () => {
    const user = userEvent.setup();
    const onShowAll = vi.fn();
    render(
      <DocumentsEmptyState
        reason="collection"
        collectionName="Taxes 2025"
        onShowAll={onShowAll}
      />,
    );

    const panel = screen.getByTestId('documents-no-matches');
    expect(panel).toHaveTextContent('Nothing filed in Taxes 2025 yet');
    expect(panel).toHaveTextContent(/Edit/);
    await user.click(screen.getByTestId('documents-empty-action'));
    expect(onShowAll).toHaveBeenCalled();
  });

  it('falls back to unnamed copy when the collection name is still loading', () => {
    render(<DocumentsEmptyState reason="collection" onShowAll={vi.fn()} />);
    expect(screen.getByTestId('documents-no-matches')).toHaveTextContent(
      'Nothing filed here yet',
    );
  });

  it('reports an empty Unfiled folder as everything being filed', () => {
    render(<DocumentsEmptyState reason="unfiled" onShowAll={vi.fn()} />);
    const panel = screen.getByTestId('documents-no-matches');
    expect(panel).toHaveAttribute('data-empty-reason', 'unfiled');
    expect(panel).toHaveTextContent('Everything is filed');
  });

  it('hides the action when the page supplies no handler for it', () => {
    render(<DocumentsEmptyState reason="filters" />);
    expect(screen.queryByTestId('documents-empty-action')).not.toBeInTheDocument();
  });
});
