/**
 * Hook to provide user input for awaiting_input runs
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePocketBase } from '@/core/api/pocketbase';

export function useProvideInput() {
  const pb = usePocketBase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ runId, input }: { runId: string; input: Record<string, any> }) => {
      const response = await fetch(`/api/actions/runs/${runId}`, {
        method: 'POST',
        headers: {
          'Authorization': pb.authStore.token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      });

      if (!response.ok) {
        throw new Error('Failed to provide input');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      // Invalidate the run query to refetch updated status
      queryClient.invalidateQueries({ queryKey: ['action-run', variables.runId] });
    },
  });
}
