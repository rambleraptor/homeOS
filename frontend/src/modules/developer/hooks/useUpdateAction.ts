/**
 * Hook to update action parameters
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/core/api/pocketbase';
import type { Action } from '../types';

export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, parameters }: { id: string; parameters: Record<string, unknown> }) => {
      return await pb.collection('actions').update<Action>(id, { parameters });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['actions'] });
      queryClient.invalidateQueries({ queryKey: ['actions', 'detail', variables.id] });
    },
  });
}
