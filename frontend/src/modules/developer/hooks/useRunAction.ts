/**
 * Hook to run an action
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { pb } from '@/core/api/pocketbase';

export function useRunAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (actionId: string) => {
      const response = await fetch(`/api/actions/${actionId}/run`, {
        method: 'POST',
        headers: {
          'Authorization': pb.authStore.token,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to run action');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate actions to refresh last_run_at
      queryClient.invalidateQueries({ queryKey: ['actions'] });
    },
  });
}
