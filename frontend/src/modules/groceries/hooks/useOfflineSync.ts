/**
 * Offline Sync Hook
 *
 * Automatically syncs pending mutations when the browser comes back online
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOnlineStatus } from '@/core/hooks/useOnlineStatus';
import { queryKeys } from '@/core/api/queryClient';
import { logger } from '@/core/utils/logger';
import { useToast } from '@/shared/components/ToastProvider';
import { syncPendingMutations } from '../services/offline-sync';

/**
 * Hook to automatically sync pending offline mutations when coming back online
 */
export function useOfflineSync() {
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const prevOnlineRef = useRef(isOnline);
  const toast = useToast();

  useEffect(() => {
    // Detect transition from offline → online
    const wasOffline = !prevOnlineRef.current;
    const isNowOnline = isOnline;

    if (wasOffline && isNowOnline) {
      logger.info('Detected online status - starting sync');

      syncPendingMutations()
        .then((results) => {
          // Invalidate all queries to fetch fresh data
          queryClient.invalidateQueries({
            queryKey: queryKeys.module('groceries').list(),
          });

          // Show sync results
          const successful = results.filter((r) => r.success);
          const failed = results.filter((r) => !r.success);

          if (failed.length > 0) {
            toast.error(
              `${failed.length} ${failed.length === 1 ? 'item' : 'items'} failed to sync`
            );
          } else if (successful.length > 0) {
            toast.success(
              `${successful.length} ${successful.length === 1 ? 'item' : 'items'} synced successfully`
            );
          }
        })
        .catch((error) => {
          logger.error('Failed to sync pending mutations:', error);
          toast.error('Failed to sync offline changes');
        });
    }

    prevOnlineRef.current = isOnline;
  }, [isOnline, queryClient, toast]);

  return { isOnline };
}
