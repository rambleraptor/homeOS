/**
 * Change the current user's password via `POST /api/auth/change-password`.
 *
 * The server verifies the current password, applies the shared password policy,
 * and revokes every session minted under the old password — handing this caller
 * a fresh one, which the aepbase client stores. That means a password change
 * signs out other devices (and anyone who had stolen a token) without signing
 * out the tab doing the changing.
 *
 * This used to re-authenticate client-side and then `PATCH /users/{id}`, which
 * only *looked* like it required the old password: the engine accepted the
 * patch from any bearer token. `PATCH /users/{id}` is superuser-only for
 * passwords now, so this route is the sole self-service path.
 */

import { useMutation } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';

export interface ChangePasswordData {
  oldPassword: string;
  password: string;
  passwordConfirm: string;
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      if (data.password !== data.passwordConfirm) {
        throw new Error('New password and confirmation do not match');
      }
      await aepbase.changePassword(data.oldPassword, data.password);
    },
  });
}
