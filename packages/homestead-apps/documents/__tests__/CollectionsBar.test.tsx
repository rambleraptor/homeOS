/**
 * The collections chip row. The data layer is mocked out — what's under test is
 * the bar's own behaviour: the counts on each chip, and the fact that the
 * per-collection actions live in a menu on the selected chip rather than in a
 * row of links that appears (and reflows the page) on selection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollectionsBar, UNFILED } from '../components/CollectionsBar';
import type { Collection, Document } from '../types';

const collections: Collection[] = [
  { id: 'c1', name: 'Taxes 2025', color: '#aa0000', description: 'Everything for April' },
  { id: 'c2', name: 'Warranties' },
] as Collection[];

const documents = [
  { id: 'd1', collections: ['c1'] },
  { id: 'd2', collections: ['c1', 'c2'] },
  { id: 'd3', collections: [] },
] as Document[];

const canManage = vi.fn(() => true);

vi.mock('../hooks/useCollections', () => ({
  useCollections: () => ({ data: collections }),
  useDeleteCollection: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@rambleraptor/homestead-core/permissions/useCan', () => ({
  useCan: () => canManage,
}));

function setup(selected: string | null = null) {
  const onSelect = vi.fn();
  render(
    <CollectionsBar documents={documents} selected={selected} onSelect={onSelect} />,
  );
  return { onSelect, user: userEvent.setup() };
}

beforeEach(() => {
  canManage.mockReturnValue(true);
});

describe('CollectionsBar', () => {
  it('counts the documents filed in each collection, and the unfiled ones', () => {
    setup();
    expect(screen.getByTestId('collection-chip-c1')).toHaveTextContent('2');
    expect(screen.getByTestId('collection-chip-c2')).toHaveTextContent('1');
    expect(screen.getByTestId('collection-chip-unfiled')).toHaveTextContent('1');
  });

  it('reports a chosen collection', async () => {
    const { user, onSelect } = setup();
    await user.click(screen.getByTestId('collection-chip-c1'));
    expect(onSelect).toHaveBeenCalledWith('c1');
  });

  it('reports the unfiled scope', async () => {
    const { user, onSelect } = setup();
    await user.click(screen.getByTestId('collection-chip-unfiled'));
    expect(onSelect).toHaveBeenCalledWith(UNFILED);
  });

  it('offers no actions menu while nothing is selected', () => {
    setup();
    expect(screen.queryByTestId('collection-menu')).not.toBeInTheDocument();
  });

  it('puts one actions menu on the selected chip, closed until asked', () => {
    setup('c1');
    expect(screen.getAllByTestId('collection-menu')).toHaveLength(1);
    expect(screen.queryByTestId('collection-menu-items')).not.toBeInTheDocument();
    // The actions are inside the menu, so nothing has been added to the bar's
    // own height by selecting a collection.
    expect(screen.queryByTestId('collection-rename')).not.toBeInTheDocument();
  });

  it('opens the menu with rename, share, and delete', async () => {
    const { user } = setup('c1');
    await user.click(screen.getByTestId('collection-menu'));
    expect(screen.getByTestId('collection-rename')).toBeInTheDocument();
    expect(screen.getByTestId('collection-share')).toBeInTheDocument();
    expect(screen.getByTestId('collection-delete')).toBeInTheDocument();
  });

  it('hides share from someone who cannot manage documents', async () => {
    canManage.mockReturnValue(false);
    const { user } = setup('c1');
    await user.click(screen.getByTestId('collection-menu'));
    expect(screen.queryByTestId('collection-share')).not.toBeInTheDocument();
    expect(screen.getByTestId('collection-rename')).toBeInTheDocument();
  });

  it('confirms before deleting, and says the documents survive', async () => {
    const { user } = setup('c1');
    await user.click(screen.getByTestId('collection-menu'));
    await user.click(screen.getByTestId('collection-delete'));
    expect(screen.getByText(/The documents in it are kept/)).toBeInTheDocument();
  });

  it('closes the menu when another chip is selected', async () => {
    const { user } = setup('c1');
    await user.click(screen.getByTestId('collection-menu'));
    await user.click(screen.getByTestId('collection-chip-all'));
    expect(screen.queryByTestId('collection-menu-items')).not.toBeInTheDocument();
  });

  it("shows the selected collection's description", () => {
    setup('c1');
    expect(screen.getByTestId('collection-description')).toHaveTextContent(
      'Everything for April',
    );
  });

  it('shows no description line for a collection without one', () => {
    setup('c2');
    expect(screen.queryByTestId('collection-description')).not.toBeInTheDocument();
  });
});
