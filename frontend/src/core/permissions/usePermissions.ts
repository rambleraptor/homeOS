/**
 * usePermissions Hook
 *
 * Hook for checking user permissions in components.
 * Provides utility functions for permission checks.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/useAuth';
import { UserRole } from '../auth/types';
import { ModulePermissions, RoleDefinition, ModulePermissionOverride } from '../../modules/types';
import { hasRoleAccess, isAdmin, getDefaultPermissions, PermissionAction } from './rbac';
import { getCollection, Collections } from '../api/pocketbase';
import { queryKeys } from '../api/queryClient';

export function usePermissions() {
  const { user } = useAuth();

  // Fetch role definitions
  const { data: roleDefinitions } = useQuery({
    queryKey: queryKeys.roles.all(),
    queryFn: async () => {
      const roles = await getCollection<RoleDefinition>(Collections.USER_ROLES).getFullList();
      return roles;
    },
    enabled: !!user,
  });

  // Fetch user-specific module permission overrides
  const { data: permissionOverrides } = useQuery({
    queryKey: queryKeys.modulePermissions.byUser(user?.id || ''),
    queryFn: async () => {
      if (!user) return [];
      const perms = await getCollection<ModulePermissionOverride>(
        Collections.MODULE_PERMISSIONS
      ).getFullList({
        filter: `user="${user.id}"`,
      });
      return perms;
    },
    enabled: !!user,
  });

  /**
   * Check if user meets minimum role requirement
   */
  const hasRole = useMemo(
    () => (requiredRole: UserRole) => {
      if (!user) return false;
      return hasRoleAccess(user.role, requiredRole);
    },
    [user]
  );

  /**
   * Check if user is admin
   */
  const userIsAdmin = useMemo(() => {
    if (!user) return false;
    return isAdmin(user.role);
  }, [user]);

  /**
   * Get permissions for a specific module
   */
  const getModulePermissions = useMemo(
    () => (moduleId: string): ModulePermissions => {
      if (!user) {
        return { read: false, write: false, admin: false };
      }

      // Check for user-specific override first
      const override = permissionOverrides?.find((p) => p.module_id === moduleId);
      if (override) {
        if (!override.enabled) {
          return { read: false, write: false, admin: false };
        }
        if (override.permissions) {
          return override.permissions;
        }
      }

      // Check role definition
      const roleDefinition = roleDefinitions?.find((r) => r.role === user.role);
      if (roleDefinition?.permissions.modules[moduleId]) {
        return roleDefinition.permissions.modules[moduleId];
      }

      // Fall back to default role permissions
      return getDefaultPermissions(user.role);
    },
    [user, permissionOverrides, roleDefinitions]
  );

  /**
   * Check if user can perform an action on a module
   */
  const canAccessModule = useMemo(
    () => (moduleId: string, action: PermissionAction = 'read'): boolean => {
      if (!user) return false;

      const permissions = getModulePermissions(moduleId);

      switch (action) {
        case 'admin':
          return permissions.admin;
        case 'write':
          return permissions.write || permissions.admin;
        case 'read':
          return permissions.read || permissions.write || permissions.admin;
        default:
          return false;
      }
    },
    [user, getModulePermissions]
  );

  /**
   * Check if module is enabled for user
   */
  const isModuleEnabled = useMemo(
    () => (moduleId: string): boolean => {
      if (!user) return false;

      const override = permissionOverrides?.find((p) => p.module_id === moduleId);
      if (override !== undefined) {
        return override.enabled;
      }

      // By default, modules are enabled if user has read access
      return canAccessModule(moduleId, 'read');
    },
    [user, permissionOverrides, canAccessModule]
  );

  /**
   * Get all system permissions for current user
   */
  const systemPermissions = useMemo(() => {
    if (!user) {
      return {
        manageUsers: false,
        viewAuditLog: false,
      };
    }

    const roleDefinition = roleDefinitions?.find((r) => r.role === user.role);
    if (roleDefinition) {
      return roleDefinition.permissions.system;
    }

    // Default system permissions based on role
    if (isAdmin(user.role)) {
      return {
        manageUsers: true,
        viewAuditLog: true,
      };
    }

    return {
      manageUsers: false,
      viewAuditLog: false,
    };
  }, [user, roleDefinitions]);

  return {
    user,
    hasRole,
    isAdmin: userIsAdmin,
    getModulePermissions,
    canAccessModule,
    isModuleEnabled,
    systemPermissions,
  };
}

/**
 * Hook to check a specific permission
 */
export function useHasPermission(requiredRole: UserRole): boolean {
  const { hasRole } = usePermissions();
  return hasRole(requiredRole);
}

/**
 * Hook to check module access
 */
export function useModuleAccess(moduleId: string, action: PermissionAction = 'read'): boolean {
  const { canAccessModule } = usePermissions();
  return canAccessModule(moduleId, action);
}
