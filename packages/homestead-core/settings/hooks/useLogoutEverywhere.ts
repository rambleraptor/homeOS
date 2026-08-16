/**
 * Sign out every other device (`POST /api/auth/logout-all`).
 *
 * The server drops all of the user's sessions and issues this caller a fresh
 * one, so the tab the button was clicked from stays signed in. Personal access
 * tokens are separate credentials and keep working — revoke those from the
 * Connections tab.
 */

import { useMutation } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';

export function useLogoutEverywhere() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      await aepbase.logoutEverywhere();
    },
  });
}
