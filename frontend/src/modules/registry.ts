/**
 * Module Registry
 *
 * The list of modules served by this instance lives in
 * `frontend/homestead.config.ts`. Edit that file to choose which modules
 * to include — this file just consumes whatever the config exports and
 * exposes navigation/flag/widget helpers over it.
 *
 * Nested modules: a parent module can declare `children: HomeModule[]`
 * to group related sub-features (e.g. `gamesModule` owns `minigolf`,
 * `pictionary`, `bridge`). Only the parent goes in the config list; the
 * registry walks `children` for route/widget aggregation, validation,
 * `module-flags` schema generation, and `getModule(id)` lookups, so a
 * nested module gets its own `enabled` flag (and any other declared
 * flags) and can be gated independently of its parent.
 */

import type {
  DashboardWidget,
  HomeModule,
  ModuleFlagDef,
  ModuleRegistry,
  ModuleWorker,
  UserSettingDef,
} from './types';
import type { ResourceDefinition } from '@rambleraptor/homestead-core/resources/types';
import {
  BUILTIN_ENABLED_TAGS_FLAG_KEY,
  DEFAULT_MODULE_VISIBILITY,
  MODULE_VISIBILITY_OPTIONS,
  type ModuleVisibility,
} from '@rambleraptor/homestead-core/settings/visibility';
import { logger } from '@rambleraptor/homestead-core/utils/logger';
import config from '../../homestead.config';
import { settingsModule } from '@rambleraptor/homestead-core/settings/module.config';
import { superuserModule } from '@rambleraptor/homestead-core/superuser/module.config';

// =============================================================================
// MODULE REGISTRY IMPLEMENTATION
// (You don't need to modify anything below this line)
// =============================================================================

/**
 * Modules the registry always installs, regardless of what the operator
 * lists in `homestead.config.ts`. These cover account management and
 * flag management — surfaces the rest of the app depends on. The
 * `superuser` module owns the `users` and `flag-management` children
 * (see `superuser/module.config.ts`).
 */
const ALWAYS_INSTALLED: HomeModule[] = [
  superuserModule,
  settingsModule,
];

function withCoreModules(userModules: HomeModule[]): HomeModule[] {
  const seen = new Set(userModules.map((m) => m.id));
  const merged = [...userModules];
  for (const core of ALWAYS_INSTALLED) {
    if (!seen.has(core.id)) merged.push(core);
  }
  return merged;
}

class ModuleRegistryImpl implements ModuleRegistry {
  modules: HomeModule[];

  constructor(modules: HomeModule[]) {
    // Filter out disabled modules and sort by navOrder
    this.modules = modules
      .filter((m) => m.enabled !== false)
      .sort((a, b) => (a.navOrder || 100) - (b.navOrder || 100));

    this.validateModules();
  }

  /**
   * Validate IDs, base paths, and parent/child relationships across
   * the whole tree. Walks `children` recursively so nested modules
   * share the same id/path namespace as top-level modules.
   */
  private validateModules(): void {
    const ids = new Set<string>();
    const paths = new Set<string>();

    const visit = (mod: HomeModule, parent: HomeModule | null): void => {
      if (ids.has(mod.id)) {
        logger.warn(`Duplicate module ID detected: ${mod.id}`, { moduleId: mod.id });
      }
      ids.add(mod.id);

      if (paths.has(mod.basePath)) {
        logger.warn(`Duplicate base path detected: ${mod.basePath}`, { basePath: mod.basePath });
      }
      paths.add(mod.basePath);

      if (!mod.basePath.startsWith('/')) {
        logger.warn(`Module "${mod.id}" base path should start with /`, {
          moduleId: mod.id,
          basePath: mod.basePath,
        });
      }

      if (parent && !mod.basePath.startsWith(parent.basePath + '/')) {
        logger.warn(
          `Child module "${mod.id}" base path "${mod.basePath}" must be nested under parent "${parent.id}" (${parent.basePath})`,
          { moduleId: mod.id, parentId: parent.id },
        );
      }

      for (const child of mod.children ?? []) {
        visit(child, mod);
      }
    };

    for (const mod of this.modules) {
      visit(mod, null);
    }
  }

  /**
   * Get a specific module by ID. Walks `children` so nested modules
   * are reachable; their flags live in the same id namespace as their
   * parents, so flag consumers (and the Flag Management UI) need to
   * resolve a child's `HomeModule` to render its name and metadata.
   */
  getModule(id: string): HomeModule | undefined {
    const visit = (mod: HomeModule): HomeModule | undefined => {
      if (mod.id === id) return mod;
      for (const child of mod.children ?? []) {
        const hit = visit(child);
        if (hit) return hit;
      }
      return undefined;
    };
    for (const mod of this.modules) {
      const hit = visit(mod);
      if (hit) return hit;
    }
    return undefined;
  }

  /**
   * Get modules that should appear in navigation
   */
  getNavigationModules(): HomeModule[] {
    return this.modules.filter((m) => m.showInNav !== false);
  }

  /**
   * Get all routes from all modules, including nested children.
   */
  getAllRoutes(): HomeModule['routes'] {
    const collect = (mod: HomeModule): HomeModule['routes'] => [
      ...mod.routes,
      ...(mod.children ?? []).flatMap(collect),
    ];
    return this.modules.flatMap(collect);
  }

  /**
   * Get module statistics
   */
  getStats() {
    return {
      total: this.modules.length,
      inNavigation: this.modules.filter((m) => m.showInNav !== false).length,
    };
  }
}

/**
 * Singleton instance of the module registry, built from the operator's
 * `frontend/homestead.config.ts` plus the always-installed core
 * modules (superuser, settings).
 */
export const moduleRegistry = new ModuleRegistryImpl(
  withCoreModules(config.modules),
);

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
export function getNavigationModules(): HomeModule[] {
  return moduleRegistry.getNavigationModules();
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
 * A widget paired with the id of the module that declared it. The
 * moduleId rides along so consumers (dashboard, widget settings) can
 * gate visibility through `useModuleEnabledPredicate` without having
 * to maintain a separate widget→module index.
 */
export type RegisteredDashboardWidget = DashboardWidget & {
  moduleId: string;
};

/**
 * Collect all dashboard widgets contributed by registered modules,
 * sorted by their declared `order` (default 100). Each widget is
 * tagged with its owning module id so consumers can filter out
 * widgets for modules the current viewer can't access.
 */
export function getAllDashboardWidgets(): RegisteredDashboardWidget[] {
  const collect = (mod: HomeModule): RegisteredDashboardWidget[] => [
    ...(mod.widgets ?? []).map((w) => ({ ...w, moduleId: mod.id })),
    ...(mod.children ?? []).flatMap(collect),
  ];
  return moduleRegistry.modules
    .flatMap(collect)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/**
 * Reserved key for the built-in `enabled` flag every module gets.
 * Module-declared flags cannot override this name.
 */
export const BUILTIN_ENABLED_FLAG_KEY = 'enabled';

// Re-export the tags flag key so consumers don't need to pull it from
// the visibility module directly. Keeps the registry as the single
// source of truth for "what built-in flags does every module get?".
export { BUILTIN_ENABLED_TAGS_FLAG_KEY };

/**
 * Keys auto-injected by the registry. Module-declared flags using
 * these names are dropped with a warning so the gating contract stays
 * consistent across the app.
 */
const RESERVED_FLAG_KEYS: readonly string[] = [
  BUILTIN_ENABLED_FLAG_KEY,
  BUILTIN_ENABLED_TAGS_FLAG_KEY,
];

function builtinEnabledFlagDef(
  defaultValue: ModuleVisibility,
): ModuleFlagDef {
  return {
    type: 'enum',
    label: 'Module enabled for',
    description:
      "Who can use this module. 'superusers' restricts it to superusers; 'all' makes it available to every signed-in user; 'none' hides it from everyone (including superusers); 'tagged' restricts it to users whose account tags overlap the 'enabled_tags' list.",
    options: MODULE_VISIBILITY_OPTIONS,
    default: defaultValue,
  };
}

function builtinEnabledTagsFlagDef(): ModuleFlagDef {
  return {
    type: 'string',
    label: 'Allowed tags',
    description:
      "Comma-separated list of account tags allowed to use this module. Only consulted when 'enabled' is set to 'tagged'. A user passes if any of their account tags appears in this list.",
    default: '',
  };
}

/**
 * Collect every declared flag across all registered modules — top-level
 * and nested — keyed by module id. Consumed by the settings UI, the
 * aepbase schema syncer, and the `useModuleFlag` hook.
 *
 * Every module (including children) automatically receives a built-in
 * `enabled` flag (see `BUILTIN_ENABLED_FLAG_KEY`) so it can be gated
 * independently. Module-declared flags of the same name are ignored
 * with a warning so the audience knob stays consistent across the app.
 */
export function getAllModuleFlagDefs(): Record<
  string,
  Record<string, ModuleFlagDef>
> {
  const out: Record<string, Record<string, ModuleFlagDef>> = {};
  const visit = (mod: HomeModule): void => {
    const declared = mod.flags ?? {};
    for (const reserved of RESERVED_FLAG_KEYS) {
      if (reserved in declared) {
        logger.warn(
          `Module "${mod.id}" declares a reserved flag "${reserved}"; built-in definition takes precedence.`,
          { moduleId: mod.id },
        );
      }
    }
    out[mod.id] = {
      ...declared,
      [BUILTIN_ENABLED_FLAG_KEY]: builtinEnabledFlagDef(
        mod.defaultEnabled ?? DEFAULT_MODULE_VISIBILITY,
      ),
      [BUILTIN_ENABLED_TAGS_FLAG_KEY]: builtinEnabledTagsFlagDef(),
    };
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of moduleRegistry.modules) {
    visit(mod);
  }
  return out;
}

/**
 * Collect every declared per-user setting across all registered
 * modules — top-level and nested — keyed by module id. Consumed by
 * the user-settings schema syncer and the `useUserSetting` hook.
 *
 * Unlike {@link getAllModuleFlagDefs}, there is no built-in setting:
 * per-user audience gating is irrelevant (the `enabled` flag already
 * lives at the module-flag layer).
 */
export function getAllUserSettingDefs(): Record<
  string,
  Record<string, UserSettingDef>
> {
  const out: Record<string, Record<string, UserSettingDef>> = {};
  const visit = (mod: HomeModule): void => {
    const declared = mod.userSettings;
    if (declared && Object.keys(declared).length > 0) {
      out[mod.id] = { ...declared };
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of moduleRegistry.modules) {
    visit(mod);
  }
  return out;
}

/**
 * Collect modules that should appear on the user Settings page —
 * either because they declare per-user settings or because they
 * supply a custom `settingsWidget`. Returns modules in nav order so
 * the page renders deterministically.
 */
export function getAllSettingsWidgets(): {
  moduleId: string;
  module: HomeModule;
}[] {
  const out: { moduleId: string; module: HomeModule }[] = [];
  const visit = (mod: HomeModule): void => {
    const hasSettings =
      !!mod.settingsWidget ||
      (mod.userSettings && Object.keys(mod.userSettings).length > 0);
    if (hasSettings) {
      out.push({ moduleId: mod.id, module: mod });
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of moduleRegistry.modules) {
    visit(mod);
  }
  return out;
}

/**
 * Collect every aepbase resource definition declared by registered
 * modules — top-level and nested. Consumed by the instrumentation
 * hook to push schemas to aepbase on server boot, and by the e2e
 * bootstrap. Order matches module registration; the runner topo-sorts
 * by `parents` before applying.
 */
export function getAllResourceDefs(): ResourceDefinition[] {
  const out: ResourceDefinition[] = [];
  const visit = (mod: HomeModule): void => {
    for (const def of mod.resources ?? []) {
      out.push(def);
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of moduleRegistry.modules) {
    visit(mod);
  }
  return out;
}

/**
 * Same traversal as {@link getAllResourceDefs}, but pairs each
 * definition with the owning module so callers can read
 * `module.offlineOverrides` and `module.id` while iterating. Used by
 * the offline mutation factory's auto-registration loop.
 */
export function getAllResourceDefsWithModule(): {
  module: HomeModule;
  def: ResourceDefinition;
}[] {
  const out: { module: HomeModule; def: ResourceDefinition }[] = [];
  const visit = (mod: HomeModule): void => {
    for (const def of mod.resources ?? []) {
      out.push({ module: mod, def });
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of moduleRegistry.modules) {
    visit(mod);
  }
  return out;
}

/**
 * Resolve a single module worker by `(moduleId, workerName)`. Walks
 * children so nested modules can declare workers under their own id.
 * Used by the catch-all dispatcher at
 * `app/api/modules/[moduleId]/[...path]/route.ts`.
 */
export function getModuleWorker(
  moduleId: string,
  workerName: string,
): ModuleWorker | undefined {
  const mod = moduleRegistry.getModule(moduleId);
  return mod?.workers?.[workerName];
}

/**
 * Collect every declared worker across all registered modules,
 * flattened to a `${moduleId}/${workerName}` key. Useful for
 * diagnostic UIs and tests.
 */
export function getAllModuleWorkers(): Record<string, ModuleWorker> {
  const out: Record<string, ModuleWorker> = {};
  const visit = (mod: HomeModule): void => {
    for (const [name, worker] of Object.entries(mod.workers ?? {})) {
      out[`${mod.id}/${name}`] = worker;
    }
    for (const child of mod.children ?? []) visit(child);
  };
  for (const mod of moduleRegistry.modules) visit(mod);
  return out;
}

/**
 * Export the registry as default
 */
export default moduleRegistry;
