import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { useFavorites, type Favorite } from '../useFavorites';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

const rows: Favorite[] = [
  { id: 'fav-1', target_resource: 'person', target_id: 'p1' },
  { id: 'fav-2', target_resource: 'person', target_id: 'p2' },
  { id: 'fav-3', target_resource: 'store', target_id: 's1' }, // other resource
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useFavorites', () => {
  it('exposes the current user’s starred ids for the given resource only', async () => {
    vi.mocked(aepbase.list).mockResolvedValue(rows as never);

    const { result } = renderHook(() => useFavorites('person'), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect([...result.current.favoriteIds].sort()).toEqual(['p1', 'p2']);
    expect(result.current.isFavorite('p1')).toBe(true);
    expect(result.current.isFavorite('s1')).toBe(false); // different resource
    // the list was scoped to the signed-in user's favorites collection
    expect(aepbase.list).toHaveBeenCalledWith('favorites', {
      parent: ['users', 'test-user-id'],
    });
  });

  it('stars an un-starred record via create', async () => {
    vi.mocked(aepbase.list).mockResolvedValue([] as never);

    const { result } = renderHook(() => useFavorites('person'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => result.current.toggle('p9'));

    expect(aepbase.create).toHaveBeenCalledWith(
      'favorites',
      { target_resource: 'person', target_id: 'p9' },
      { parent: ['users', 'test-user-id'] },
    );
    expect(aepbase.remove).not.toHaveBeenCalled();
  });

  it('unstars an already-starred record via remove (by favorite row id)', async () => {
    vi.mocked(aepbase.list).mockResolvedValue(rows as never);

    const { result } = renderHook(() => useFavorites('person'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.favoriteIds.has('p1')).toBe(true));

    await act(async () => result.current.toggle('p1'));

    expect(aepbase.remove).toHaveBeenCalledWith('favorites', 'fav-1', {
      parent: ['users', 'test-user-id'],
    });
    expect(aepbase.create).not.toHaveBeenCalled();
  });
});
