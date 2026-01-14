import { Collections, getCollection } from '@/core/api/pocketbase';
import { logger } from '@/core/utils/logger';
import type { GroceryItem, Store } from '../types';
import {
  getPendingMutations,
  clearPendingMutations,
  type PendingMutation,
} from '../utils/offline-storage';

export interface SyncResult {
  success: boolean;
  mutation: PendingMutation;
  result?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- Result can be any PocketBase record type
  error?: Error;
}

/**
 * Sync all pending mutations to the server
 * @returns Array of sync results for each mutation
 */
export async function syncPendingMutations(): Promise<SyncResult[]> {
  logger.info('Starting offline sync...');

  const mutations = await getPendingMutations();

  if (mutations.length === 0) {
    logger.info('No pending mutations to sync');
    return [];
  }

  logger.info(`Syncing ${mutations.length} pending mutations`);

  // Sort by timestamp to ensure operations are applied in order
  const sorted = mutations.sort((a, b) => a.timestamp - b.timestamp);

  const results: SyncResult[] = [];

  for (const mutation of sorted) {
    try {
      logger.info(
        `Syncing ${mutation.type} on ${mutation.collection}`,
        { itemId: mutation.itemId || 'new item' }
      );

      let result;

      switch (mutation.collection) {
        case 'groceries':
          result = await syncGroceryMutation(mutation);
          break;
        case 'stores':
          result = await syncStoreMutation(mutation);
          break;
        default:
          throw new Error(`Unknown collection: ${mutation.collection}`);
      }

      results.push({ success: true, mutation, result });
      logger.info(`Successfully synced ${mutation.type} mutation`);
    } catch (error) {
      logger.error(`Failed to sync ${mutation.type} mutation:`, error);
      results.push({
        success: false,
        mutation,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Clear successfully synced mutations
  const successfulIds = results.filter((r) => r.success).map((r) => r.mutation.id);

  if (successfulIds.length > 0) {
    await clearPendingMutations(successfulIds);
    logger.info(`Cleared ${successfulIds.length} successfully synced mutations`);
  }

  const failedCount = results.filter((r) => !r.success).length;
  if (failedCount > 0) {
    logger.warn(`${failedCount} mutations failed to sync and will be retried later`);
  }

  return results;
}

/**
 * Sync a grocery item mutation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncGroceryMutation(mutation: PendingMutation): Promise<any> {
  const collection = getCollection<GroceryItem>(Collections.GROCERIES);

  switch (mutation.type) {
    case 'create':
      // For creates, we need to strip out the temporary ID
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created, updated, ...createData } = mutation.data;
      return await collection.create(createData);

    case 'update':
      if (!mutation.itemId) {
        throw new Error('Update mutation missing itemId');
      }
      // Skip updates for items with temporary IDs (they'll be created instead)
      if (mutation.itemId.startsWith('temp_')) {
        logger.warn(`Skipping update for temporary item: ${mutation.itemId}`);
        return null;
      }
      return await collection.update(mutation.itemId, mutation.data);

    case 'delete':
      if (!mutation.itemId) {
        throw new Error('Delete mutation missing itemId');
      }
      // Skip deletes for items with temporary IDs
      if (mutation.itemId.startsWith('temp_')) {
        logger.warn(`Skipping delete for temporary item: ${mutation.itemId}`);
        return null;
      }
      return await collection.delete(mutation.itemId);

    default:
      throw new Error(`Unknown mutation type: ${mutation.type}`);
  }
}

/**
 * Sync a store mutation
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncStoreMutation(mutation: PendingMutation): Promise<any> {
  const collection = getCollection<Store>(Collections.STORES);

  switch (mutation.type) {
    case 'create':
      // For creates, we need to strip out the temporary ID
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, created, updated, ...createData } = mutation.data;
      return await collection.create(createData);

    case 'update':
      if (!mutation.itemId) {
        throw new Error('Update mutation missing itemId');
      }
      if (mutation.itemId.startsWith('temp_')) {
        logger.warn(`Skipping update for temporary store: ${mutation.itemId}`);
        return null;
      }
      return await collection.update(mutation.itemId, mutation.data);

    case 'delete':
      if (!mutation.itemId) {
        throw new Error('Delete mutation missing itemId');
      }
      if (mutation.itemId.startsWith('temp_')) {
        logger.warn(`Skipping delete for temporary store: ${mutation.itemId}`);
        return null;
      }
      return await collection.delete(mutation.itemId);

    default:
      throw new Error(`Unknown mutation type: ${mutation.type}`);
  }
}
