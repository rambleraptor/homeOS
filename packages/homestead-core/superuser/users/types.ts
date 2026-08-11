import type { UserType } from '@rambleraptor/homestead-core/auth/types';

export interface ManagedUser {
  id: string;
  email: string;
  display_name?: string;
  type?: UserType;
  create_time?: string;
  update_time?: string;
}

export interface UserFormData {
  email: string;
  display_name: string;
  type: UserType;
  password?: string;
  /**
   * The role-bearing group to add a new (regular) user to, chosen as an "access
   * level" in the create form. Empty/undefined leaves them in the open-household
   * default. Ignored for superusers (they break-glass past data restrictions).
   */
  groupId?: string;
}
