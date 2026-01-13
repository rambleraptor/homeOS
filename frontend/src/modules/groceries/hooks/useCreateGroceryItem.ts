/**
 * Create Grocery Item Hook
 *
 * Mutation for creating a new grocery item (online or offline)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/core/api/queryClient';
import { Collections, getCollection } from '@/core/api/pocketbase';
import { useOnlineStatus } from '@/core/hooks/useOnlineStatus';
import { logger } from '@/core/utils/logger';
import {
  getGroceriesLocally,
  saveGroceriesLocally,
  addPendingMutation,
} from '../utils/offline-storage';
import type { GroceryItem, GroceryItemFormData } from '../types';

export function useCreateGroceryItem() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();

  return useMutation({
    mutationFn: async (data: GroceryItemFormData) => {
      logger.info(`Creating grocery item: ${data.name} (${isOnline ? 'online' : 'offline'})`);

      // When offline, create temporary item and queue mutation
      if (!isOnline) {
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const tempItem: GroceryItem = {
          id: tempId,
          name: data.name,
          notes: data.notes || '',
          store: data.store || '',
          checked: false,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
        };

        // Add to pending mutations queue
        await addPendingMutation({
          id: crypto.randomUUID(),
          type: 'create',
          collection: 'groceries',
          timestamp: Date.now(),
          data: tempItem,
        });

        logger.info(`Queued offline creation for item: ${tempId}`);
        return tempItem;
      }

      // When online, create via PocketBase
      const item = await getCollection<GroceryItem>(Collections.GROCERIES).create({
        name: data.name,
        notes: data.notes || '',
        store: data.store || '',
        checked: false,
      });

      return item;
    },
    onSuccess: async (newItem) => {
      // Optimistic update: add to local cache if offline
      if (!isOnline) {
        const cached = await getGroceriesLocally();
        await saveGroceriesLocally([...cached, newItem]);
      }

      // Invalidate groceries list to refresh
      queryClient.invalidateQueries({ queryKey: queryKeys.module('groceries').list() });
    },
    onError: (error) => {
      logger.error('Failed to create grocery item', error);
    },
  });
}
