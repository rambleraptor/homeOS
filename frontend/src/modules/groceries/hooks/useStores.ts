/**
 * Stores Query Hook
 *
 * Fetches all stores from PocketBase (online) or IndexedDB (offline)
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryClient';
import { Collections, getCollection } from '@/core/api/pocketbase';
import { useOnlineStatus } from '@/core/hooks/useOnlineStatus';
import { getStoresLocally, saveStoresLocally } from '../utils/offline-storage';
import type { Store } from '../types';

export function useStores() {
  const isOnline = useOnlineStatus();

  return useQuery({
    queryKey: queryKeys.module('groceries').detail('stores'),
    queryFn: async () => {
      // When offline, return cached data from IndexedDB
      if (!isOnline) {
        const cachedStores = await getStoresLocally();
        return cachedStores;
      }

      // When online, fetch from server and cache locally
      const stores = await getCollection<Store>(Collections.STORES).getFullList({
        sort: 'sort_order,name',
      });

      // Save to IndexedDB for offline use
      await saveStoresLocally(stores);

      return stores;
    },
    staleTime: isOnline ? 5 * 60 * 1000 : Infinity, // Never stale when offline
    gcTime: isOnline ? 10 * 60 * 1000 : Infinity, // Don't garbage collect when offline
    refetchOnWindowFocus: isOnline, // Only refetch when online
  });
}
