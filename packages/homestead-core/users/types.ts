import type { UserType } from '@rambleraptor/homestead-core/auth/types';

export interface ManagedUser {
  id: string;
  email: string;
  display_name?: string;
  type?: UserType;
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
