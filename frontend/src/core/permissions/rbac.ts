/**
 * Role-Based Access Control (RBAC) Configuration
 *
 * This file defines the permission hierarchy and utility functions
 * for checking user permissions throughout the application.
 */

import type { UserRole } from '../auth/types';

/**
 * Role hierarchy levels (higher number = more permissions)
 */
export const ROLE_LEVELS: Record<UserRole, number> = {
  viewonly: 1,
  member: 2,
  admin: 3,
};

/**
 * Check if a user role meets the minimum required role
 */
export function hasRoleAccess(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole];
}

/**
 * Check if user is admin
 */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}

/**
 * Check if user is member or higher
 */
export function isMemberOrHigher(role: UserRole): boolean {
  return hasRoleAccess(role, 'member');
}

/**
 * Get role display name
 */
export function getRoleDisplayName(role: UserRole): string {
  const displayNames: Record<UserRole, string> = {
    admin: 'Admin (Parent)',
    member: 'Member (Family)',
    viewonly: 'View Only (Guest)',
  };
  return displayNames[role];
}

/**
 * Get role description
 */
export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    admin: 'Full system access - can manage users and all modules',
    member: 'Standard access - can use and edit most features',
    viewonly: 'Read-only access - can view but not modify content',
  };
  return descriptions[role];
}

/**
 * Permission action types
 */
export type PermissionAction = 'read' | 'write' | 'admin';

/**
 * Check if user can perform action based on role defaults
 */
export function canPerformAction(
  userRole: UserRole,
  action: PermissionAction
): boolean {
  switch (action) {
    case 'admin':
      return isAdmin(userRole);
    case 'write':
      return isMemberOrHigher(userRole);
    case 'read':
      return true; // All authenticated users can read
    default:
      return false;
  }
}

/**
 * Default permissions per role
 */
export const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    read: true,
    write: true,
    admin: true,
  },
  member: {
    read: true,
    write: true,
    admin: false,
  },
  viewonly: {
    read: true,
    write: false,
    admin: false,
  },
} as const;

/**
 * Get default permissions for a role
 */
export function getDefaultPermissions(role: UserRole) {
  return DEFAULT_ROLE_PERMISSIONS[role];
}
