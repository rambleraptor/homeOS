/**
 * "View as user" (permission preview) — pure identity-override helper.
 *
 * A superuser can preview the app as another user to debug that user's access.
 * The whole client access surface — nav visibility (`useAppVisible`), the
 * `can()` mirror (`useCan`), and the route gates (`SuperuserGate`,
 * `PermissionGate`) — derives from `useAuth().user`'s `id`, `type`, and
 * `permissions`. Overriding exactly those fields flips every gate to the
 * target user's access without touching any call site.
 *
 * This is a *client-side visibility preview only*: the aepbase client keeps
 * signing requests with the real superuser's token, so data still loads with
 * the superuser's own access and the server stays authoritative. What changes
 * is which apps/pages/actions the UI offers — the thing a superuser is
 * actually debugging when they ask "does this user have the right access?".
 */

import type { PermissionContext } from '../permissions/client';
import type { User, UserType } from './types';

/**
 * The target identity a superuser is previewing. Carries the display fields
 * (so the chrome reads as that user) plus the permission-relevant fields the
 * gates resolve against.
 */
export interface ViewAsIdentity {
  id: string;
  /** Display name for the banner and header (falls back to email). */
  name: string;
  email: string;
  type: UserType;
  /** The target's server-resolved permission context (from `/api/permissions/user/:id`). */
  permissions: PermissionContext | undefined;
}

/**
 * The user the app should render as. When a preview is active, the real
 * superuser's record is returned with its identity fields overridden by the
 * target's — critically `id`, `type`, and `permissions`, which the gates read.
 * When no preview is active (or there is no logged-in user), the real user is
 * returned unchanged.
 */
export function computeEffectiveUser(
  realUser: User | null,
  viewAs: ViewAsIdentity | null,
): User | null {
  if (!realUser || !viewAs) return realUser;
  return {
    ...realUser,
    id: viewAs.id,
    name: viewAs.name,
    email: viewAs.email,
    type: viewAs.type,
    permissions: viewAs.permissions,
    // The preview never inherits the superuser's own preferences-derived
    // display state — those belong to the real account, not the target.
    avatar: undefined,
  };
}
