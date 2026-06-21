import type { UserType } from '@rambleraptor/homestead-core/auth/types';

export interface ManagedUser {
  id: string;
  email: string;
  display_name?: string;
  type?: UserType;
  /**
   * Account tags, sourced from the parented `account-tag` child
   * resource and merged in by `useUsers`. Not stored on the user
   * record itself (aepbase's user schema is fixed).
   */
  tags?: string[];
  create_time?: string;
  update_time?: string;
}

export interface UserFormData {
  email: string;
  display_name: string;
  type: UserType;
  tags: string[];
  password?: string;
}
