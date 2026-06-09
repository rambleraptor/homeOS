import { useMutation } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';

interface GroceryNotificationResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export function useSendGroceryNotification() {
  return useMutation({
    // Notifications make no sense queued — fail fast offline.
    networkMode: 'online',
    mutationFn: async () => {
      return aepbase.customMethod<GroceryNotificationResponse>(
        'groceries',
        'send-notification',
      );
    },
  });
}
