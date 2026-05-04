import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { NOTIFICATIONS } from '../resources';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import type { Notification } from '../types';

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const userId = aepbase.getCurrentUser()?.id;
      if (!userId) throw new Error('User not authenticated');
      return aepbase.update<Notification>(
        NOTIFICATIONS,
        id,
        { read: true, read_at: new Date().toISOString() },
        { parent: [USERS, userId] },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.module('notifications').all() });
    },
  });
}
