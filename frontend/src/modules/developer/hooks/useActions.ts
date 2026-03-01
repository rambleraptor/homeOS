/**
 * Hook to fetch all actions
 */

import { useQuery } from '@tanstack/react-query';
import { pb } from '@/core/api/pocketbase';
import type { Action } from '../types';

export function useActions() {
  return useQuery({
    queryKey: ['actions'],
    queryFn: async () => {
      const records = await pb.collection('actions').getFullList<Action>({
        sort: '-created',
      });
      return records;
    },
  });
}
