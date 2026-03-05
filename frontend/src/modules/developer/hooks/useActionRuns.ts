/**
 * Hook to fetch runs for a specific action
 */

import { useQuery } from '@tanstack/react-query';
import { pb } from '@/core/api/pocketbase';
import type { ActionRun } from '../types';

export function useActionRuns(actionId: string) {
  return useQuery({
    queryKey: ['actions', 'runs', actionId],
    queryFn: async () => {
      return await pb.collection('action_runs').getFullList<ActionRun>({
        filter: `action = "${actionId}"`,
        sort: '-created',
      });
    },
    enabled: !!actionId,
  });
}
