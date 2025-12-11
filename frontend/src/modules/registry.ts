/**
 * Module Registry
 *
 * CENTRAL MODULE REGISTRATION
 * ===========================
 * This is the ONLY file you need to modify to add a new module to HomeOS.
 *
 * To add a new module:
 * 1. Create your module directory in src/modules/your-module/
 * 2. Implement the module.config.ts file
 * 3. Import and register it in the MODULES array below
 * 4. That's it! The module will automatically appear in navigation and routing.
 *
 * Example:
 * ```
 * import { dashboardModule } from './dashboard/module.config';
 * import { choresModule } from './chores/module.config';
 *
 * const MODULES: HomeModule[] = [
 *   dashboardModule,
 *   choresModule,
 * ];
 * ```
 */

import { HomeModule, ModuleRegistry } from './types';
import { UserRole } from '../core/auth/types';
import { hasRoleAccess } from '../core/permissions/rbac';

// =============================================================================
// IMPORT YOUR MODULES HERE
// =============================================================================

// Import modules as they are created
import { dashboardModule } from './dashboard/module.config';
// import { choresModule } from './chores/module.config';
// import { mealsModule } from './meals/module.config';

// =============================================================================
// REGISTER MODULES HERE
// =============================================================================

/**
 * Array of all registered modules in the system.
 * Add your module to this array to make it available in the app.
 */
const MODULES: HomeModule[] = [
  dashboardModule,
  // choresModule,
  // mealsModule,

  // Add your modules here...
];

// =============================================================================
// MODULE REGISTRY IMPLEMENTATION
// (You don't need to modify anything below this line)
// =============================================================================

class ModuleRegistryImpl implements ModuleRegistry {
  private modules: HomeModule[];

  constructor(modules: HomeModule[]) {
    // Filter out disabled modules and sort by navOrder
    this.modules = modules
      .filter((m) => m.enabled !== false)
      .sort((a, b) => (a.navOrder || 100) - (b.navOrder || 100));

    this.validateModules();
  }

  /**
   * Validate that all modules have unique IDs and base paths
   */
  private validateModules(): void {
    const ids = new Set<string>();
    const paths = new Set<string>();

    for (const module of this.modules) {
      if (ids.has(module.id)) {
        console.warn(`Duplicate module ID detected: ${module.id}`);
      }
      ids.add(module.id);

      if (paths.has(module.basePath)) {
        console.warn(`Duplicate base path detected: ${module.basePath}`);
      }
      paths.add(module.basePath);

      // Validate base path starts with /
      if (!module.basePath.startsWith('/')) {
        console.warn(`Module "${module.id}" base path should start with /`);
      }
    }
  }

  /**
   * Get all registered modules
   */
  get modules(): HomeModule[] {
    return this._modules;
  }

  set modules(value: HomeModule[]) {
    this._modules = value;
  }

  private _modules: HomeModule[] = [];

  /**
   * Get a specific module by ID
   */
  getModule(id: string): HomeModule | undefined {
    return this.modules.find((m) => m.id === id);
  }

  /**
   * Get modules accessible by a specific role
   */
  getModulesByRole(role: UserRole): HomeModule[] {
    return this.modules.filter((m) => hasRoleAccess(role, m.requiredRole));
  }

  /**
   * Get modules that should appear in navigation for a specific role
   */
  getNavigationModules(role: UserRole): HomeModule[] {
    return this.modules.filter(
      (m) => m.showInNav !== false && hasRoleAccess(role, m.requiredRole)
    );
  }

  /**
   * Get all routes from all modules
   */
  getAllRoutes(): HomeModule['routes'] {
    return this.modules.flatMap((m) => m.routes);
  }

  /**
   * Get routes accessible by a specific role
   */
  getRoutesByRole(role: UserRole): HomeModule['routes'] {
    return this.modules
      .filter((m) => hasRoleAccess(role, m.requiredRole))
      .flatMap((m) => m.routes);
  }

  /**
   * Get module statistics
   */
  getStats() {
    return {
      total: this.modules.length,
      byRole: {
        admin: this.getModulesByRole('admin').length,
        member: this.getModulesByRole('member').length,
        viewonly: this.getModulesByRole('viewonly').length,
      },
      inNavigation: this.modules.filter((m) => m.showInNav !== false).length,
    };
  }
}

/**
 * Singleton instance of the module registry
 */
export const moduleRegistry = new ModuleRegistryImpl(MODULES);

/**
 * Helper function to get all modules
 */
export function getAllModules(): HomeModule[] {
  return moduleRegistry.modules;
}

/**
 * Helper function to get module by ID
 */
export function getModuleById(id: string): HomeModule | undefined {
  return moduleRegistry.getModule(id);
}

/**
 * Helper function to get modules for navigation
 */
export function getNavigationModules(role: UserRole): HomeModule[] {
  return moduleRegistry.getNavigationModules(role);
}

/**
 * Helper function to get all routes
 */
export function getAllRoutes(): HomeModule['routes'] {
  return moduleRegistry.getAllRoutes();
}

/**
 * Helper function to check if a module exists
 */
export function moduleExists(id: string): boolean {
  return moduleRegistry.getModule(id) !== undefined;
}

/**
 * Export the registry as default
 */
export default moduleRegistry;
