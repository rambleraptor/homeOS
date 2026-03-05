/**
 * Hook to fetch a single action by ID
 */

import { useQuery } from '@tanstack/react-query';
import { pb } from '@/core/api/pocketbase';
import type { Action } from '../types';

export function useAction(actionId: string) {
  return useQuery({
    queryKey: ['actions', 'detail', actionId],
    queryFn: async () => {
      return await pb.collection('actions').getOne<Action>(actionId);
    },
    enabled: !!actionId,
  });
}
