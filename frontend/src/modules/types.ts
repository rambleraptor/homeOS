/**
 * Module System Types
 *
 * This file defines the contract that every module must follow.
 * All modules registered in the system must implement the HomeModule interface.
 */

import type { RouteObject } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { UserRole } from '../core/auth/types';

/**
 * Permission levels for module access
 */
export interface ModulePermissions {
  read: boolean;
  write: boolean;
  admin: boolean;
}

/**
 * Core Module Configuration
 * Every module must export a config object that implements this interface
 */
export interface HomeModule {
  /**
   * Unique identifier for the module (lowercase, no spaces)
   * Example: 'dashboard', 'chores', 'meal_planner'
   */
  id: string;

  /**
   * Display name shown in navigation and UI
   * Example: 'Dashboard', 'Chores', 'Meal Planner'
   */
  name: string;

  /**
   * Short description of module functionality
   */
  description: string;

  /**
   * Lucide icon component for navigation
   */
  icon: LucideIcon;

  /**
   * Minimum required role to access this module
   * Users with lower roles will not see this module
   */
  requiredRole: UserRole;

  /**
   * Base path for module routes (must start with /)
   * Example: '/dashboard', '/chores'
   */
  basePath: string;

  /**
   * React Router route definitions for this module
   * These will be automatically integrated into the main router
   */
  routes: RouteObject[];

  /**
   * Whether this module should appear in the main navigation
   * @default true
   */
  showInNav?: boolean;

  /**
   * Navigation order (lower numbers appear first)
   * @default 100
   */
  navOrder?: number;

  /**
   * Whether this module is enabled
   * Can be used for feature flags
   * @default true
   */
  enabled?: boolean;

  /**
   * Additional module-specific metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Module Registry
 * Central registry of all available modules in the system
 */
export interface ModuleRegistry {
  modules: HomeModule[];
  getModule: (id: string) => HomeModule | undefined;
  getModulesByRole: (role: UserRole) => HomeModule[];
  getNavigationModules: (role: UserRole) => HomeModule[];
}

/**
 * Per-user module permission override
 */
export interface ModulePermissionOverride {
  id: string;
  user: string;
  module_id: string;
  enabled: boolean;
  permissions?: ModulePermissions;
  created: string;
  updated: string;
}

/**
 * Role definition with permissions matrix
 */
export interface RoleDefinition {
  id: string;
  role: UserRole;
  name: string;
  description: string;
  permissions: {
    modules: Record<string, ModulePermissions>;
    system: {
      manageUsers: boolean;
      viewAuditLog: boolean;
    };
  };
  created: string;
  updated: string;
}

/**
 * Helper type for module component props
 */
export interface ModuleComponentProps {
  moduleId?: string;
  [key: string]: unknown;
}

/**
 * Module initialization hook result
 */
export interface ModuleHook<T = unknown> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
