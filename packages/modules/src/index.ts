/**
 * Public entry point for @homestead/modules.
 *
 * The host app composes a registry from the modules it wants enabled.
 * Re-exports the singleton registry helpers (today they back the
 * built-in module set; the createRegistry refactor will replace this
 * with a `bundledModules` array consumers compose themselves).
 */
export {
  moduleRegistry,
  getAllModules,
  getModuleById,
  getNavigationModules,
  getAllRoutes,
  moduleExists,
  getAllDashboardWidgets,
  getAllModuleFlagDefs,
  BUILTIN_ENABLED_FLAG_KEY,
} from './registry';

export type {
  HomeModule,
  ModuleRoute,
  ModuleFlagDef,
  ModuleFlagValue,
  DashboardWidget,
  ModuleRegistry,
  ModuleComponentProps,
  ModuleHook,
} from './types';
