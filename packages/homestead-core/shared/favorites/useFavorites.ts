/**
 * `useFavorites` — the current user's starred records for one resource.
 *
 * Favorites are stored as polymorphic `favorite` rows under the signed-in user
 * (`/users/{me}/favorites`), each naming a `target_resource` + `target_id`. This
 * hook reads the slice for one resource and exposes a fast membership set plus a
 * `toggle` that stars/unstars a record (create-or-delete). Any picker can lean
 * on it to float starred records to the top and offer an in-place star control —
 * see `ReferenceField` (`favoriteIds` / `onToggleFavorite`) and `PersonSelector`.
 */

import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS, FAVORITES } from '@rambleraptor/homestead-core/resources/builtins';

export interface Favorite {
  id: string;
  target_resource: string;
  target_id: string;
  create_time?: string;
  update_time?: string;
}

export interface UseFavoritesResult {
  /** Bare ids of the records the current user has starred for this resource. */
  favoriteIds: Set<string>;
  isFavorite: (id: string) => boolean;
  /** Star an un-starred record, or unstar a starred one. */
  toggle: (id: string) => void;
  isLoading: boolean;
}

const favoritesKey = (userId: string, resource: string) =>
  ['favorites', userId, resource] as const;

export function useFavorites(resource: string): UseFavoritesResult {
  const queryClient = useQueryClient();
  const userId = aepbase.getCurrentUser()?.id ?? '';

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: favoritesKey(userId, resource),
    enabled: !!userId,
    queryFn: async () => {
      const all = await aepbase.list<Favorite>(FAVORITES, { parent: [USERS, userId] });
      return all.filter((f) => f.target_resource === resource);
    },
  });

  // target_id -> favorite row id, so toggle knows which record to delete.
  const idByTarget = useMemo(
    () => new Map(favorites.map((f) => [f.target_id, f.id])),
    [favorites],
  );
  const favoriteIds = useMemo(
    () => new Set(favorites.map((f) => f.target_id)),
    [favorites],
  );

  const mutation = useMutation({
    mutationFn: async (targetId: string) => {
      const existing = idByTarget.get(targetId);
      if (existing) {
        await aepbase.remove(FAVORITES, existing, { parent: [USERS, userId] });
      } else {
        await aepbase.create<Favorite>(
          FAVORITES,
          { target_resource: resource, target_id: targetId },
          { parent: [USERS, userId] },
        );
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: favoritesKey(userId, resource) }),
  });

  return {
    favoriteIds,
    isFavorite: useCallback((id: string) => favoriteIds.has(id), [favoriteIds]),
    toggle: useCallback((id: string) => mutation.mutate(id), [mutation]),
    isLoading,
  };
}
