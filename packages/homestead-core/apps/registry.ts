/**
 * App Registry
 *
 * The list of apps served by an instance lives in the operator's
 * `homestead.config.ts`. The frontend boot calls
 * {@link initializeAppRegistry} once with the full app list; every
 * helper here reads from the resulting singleton.
 *
 * This file deliberately imports zero `AppConfig` instances of its own:
 * the always-installed core apps (settings/users/superuser) are
 * passed in by the consumer. That keeps `import` of this app a
 * zero-cost type-only operation, which matters for test mocking — eager
 * loading of app components would freeze hook bindings before a test
 * file's `vi.mock` calls could take effect.
 *
 * Nested apps: a parent app can declare `children: AppConfig[]`
 * to group related sub-features (e.g. `gamesApp` owns `minigolf`,
 * `pictionary`, `bridge`). Only the parent goes in the config list; the
 * registry walks `children` for route/widget aggregation, validation,
 * `app-flags` schema generation, and `getApp(id)` lookups, so a
 * nested app gets its own `enabled` flag (and any other declared
 * flags) and can be gated independently of its parent.
 */

import type {
  DashboardWidget,
  AppConfig,
  AppFlagDef,
  AppRegistry,
  AppRoute,
  UserSettingDef,
} from './types';
import type {
  ResourceCustomMethod,
  ResourceDefinition,
} from '../resources/types';
import {
  BUILTIN_ENABLED_TAGS_FLAG_KEY,
  DEFAULT_APP_VISIBILITY,
  APP_VISIBILITY_OPTIONS,
  type AppVisibility,
} from '../settings/visibility';
import { logger } from '../utils/logger';

class AppRegistryImpl implements AppRegistry {
  apps: AppConfig[];

  constructor(apps: AppConfig[]) {
    // Sort by navOrder
    this.apps = [...apps].sort(
      (a, b) => (a.web?.navOrder || 100) - (b.web?.navOrder || 100),
    );

    this.validateApps();
  }

  /**
   * Validate IDs, base paths, and parent/child relationships across
   * the whole tree. Walks `children` recursively so nested apps
   * share the same id/path namespace as top-level apps.
   */
  private validateApps(): void {
    const ids = new Set<string>();
    const paths = new Set<string>();

    const visit = (mod: AppConfig, parent: AppConfig | null): void => {
      if (ids.has(mod.id)) {
        logger.warn(`Duplicate app ID detected: ${mod.id}`, { appId: mod.id });
      }
      ids.add(mod.id);

      // Headless apps (no `web`) declare no base path, so skip all
      // path-shape and nesting checks for them.
      if (mod.web) {
        if (paths.has(mod.web.basePath)) {
          logger.warn(`Duplicate base path detected: ${mod.web.basePath}`, { basePath: mod.web.basePath });
        }
        paths.add(mod.web.basePath);

        if (!mod.web.basePath.startsWith('/')) {
          logger.warn(`App "${mod.id}" base path should start with /`, {
            appId: mod.id,
            basePath: mod.web.basePath,
          });
        }

        if (parent?.web && !mod.web.basePath.startsWith(parent.web.basePath + '/')) {
          logger.warn(
            `Child app "${mod.id}" base path "${mod.web.basePath}" must be nested under parent "${parent.id}" (${parent.web.basePath})`,
            { appId: mod.id, parentId: parent.id },
          );
        }
      }

      for (const child of mod.children ?? []) {
        visit(child, mod);
      }
    };

    for (const mod of this.apps) {
      visit(mod, null);
    }
  }

  /**
   * Get a specific app by ID. Walks `children` so nested apps
   * are reachable; their flags live in the same id namespace as their
   * parents, so flag consumers (and the Flag Management UI) need to
   * resolve a child's `AppConfig` to render its name and metadata.
   */
  getApp(id: string): AppConfig | undefined {
    const visit = (mod: AppConfig): AppConfig | undefined => {
      if (mod.id === id) return mod;
      for (const child of mod.children ?? []) {
        const hit = visit(child);
        if (hit) return hit;
      }
      return undefined;
    };
    for (const mod of this.apps) {
      const hit = visit(mod);
      if (hit) return hit;
    }
    return undefined;
  }

  /**
   * Get apps that should appear in the sidebar navigation
   */
  getNavigationApps(): AppConfig[] {
    return this.apps.filter(
      (m) => !!m.web && m.web.showInNav !== false && m.web.placement !== 'topbar',
    );
  }

  /**
   * Get apps that should render as icon buttons in the top bar.
   * Already sorted by navOrder (the constructor sorts the full list).
   */
  getTopBarApps(): AppConfig[] {
    return this.apps.filter(
      (m) => m.web?.placement === 'topbar' && m.web.showInNav !== false,
    );
  }

  /**
   * Get all routes from all apps, including nested children.
   */
  getAllRoutes(): AppRoute[] {
    const collect = (mod: AppConfig): AppRoute[] => [
      ...(mod.web?.routes ?? []),
      ...(mod.children ?? []).flatMap(collect),
    ];
    return this.apps.flatMap(collect);
  }

  /**
   * Get app statistics
   */
  getStats() {
    return {
      total: this.apps.length,
      inNavigation: this.apps.filter((m) => !!m.web && m.web.showInNav !== false).length,
    };
  }
}

let _appRegistry: AppRegistryImpl | undefined;

/**
 * Initialize the app registry. Must be called once at app startup,
 * before any helper below is invoked. The frontend's
 * `src/apps/registry.ts` shim handles this side effect on import.
 *
 * Pass the operator-supplied app list. The shim is also responsible
 * for prepending the always-installed core apps (settings, users,
 * superuser); this file does not pull them in by name so test setup can
 * boot the registry without dragging every app's component tree
 * into the app cache.
 *
 * Idempotent across hot-reloads in dev (overwrites the singleton).
 * Tests can call this to install a synthetic config.
 */
export function initializeAppRegistry(apps: AppConfig[]): void {
  _appRegistry = new AppRegistryImpl(apps);
}

/**
 * Reset the singleton. Test-only — used by suites that want to
 * verify behaviour before {@link initializeAppRegistry} runs.
 */
export function resetAppRegistry(): void {
  _appRegistry = undefined;
}

/**
 * Singleton accessor. Throws if {@link initializeAppRegistry} has
 * not been called yet — that almost always means an import order bug
 * (the frontend bootstrap must run before any app-registry helper).
 */
export function getAppRegistry(): AppRegistryImpl {
  if (!_appRegistry) {
    throw new Error(
      'App registry not initialized. The app shim at ' +
        '`packages/homestead-app/src/apps/registry.ts` must run before any ' +
        'registry helper is called.',
    );
  }
  return _appRegistry;
}

/**
 * Singleton instance of the app registry. Lazy-resolved so the
 * value is read after {@link initializeAppRegistry} runs.
 */
export const appRegistry: AppRegistry = {
  get apps() {
    return getAppRegistry().apps;
  },
  getApp: (id) => getAppRegistry().getApp(id),
  getNavigationApps: () => getAppRegistry().getNavigationApps(),
  getTopBarApps: () => getAppRegistry().getTopBarApps(),
};

/**
 * Helper function to get all apps
 */
export function getAllApps(): AppConfig[] {
  return getAppRegistry().apps;
}

/**
 * Helper function to get app by ID
 */
export function getAppById(id: string): AppConfig | undefined {
  return getAppRegistry().getApp(id);
}

/**
 * Helper function to get apps for navigation
 */
export function getNavigationApps(): AppConfig[] {
  return getAppRegistry().getNavigationApps();
}

/**
 * Helper function to get apps placed on the top bar
 */
export function getTopBarApps(): AppConfig[] {
  return getAppRegistry().getTopBarApps();
}

/**
 * Helper function to get all routes
 */
export function getAllRoutes(): AppRoute[] {
  return getAppRegistry().getAllRoutes();
}

/**
 * Helper function to check if an app exists
 */
export function appExists(id: string): boolean {
  return getAppRegistry().getApp(id) !== undefined;
}

/**
 * A widget paired with the id of the app that declared it. The
 * appId rides along so consumers (dashboard, widget settings) can
 * gate visibility through `useAppEnabledPredicate` without having
 * to maintain a separate widget→app index.
 */
export type RegisteredDashboardWidget = DashboardWidget & {
  appId: string;
};

/**
 * Collect all dashboard widgets contributed by registered apps,
 * sorted by their declared `order` (default 100). Each widget is
 * tagged with its owning app id so consumers can filter out
 * widgets for apps the current viewer can't access.
 */
export function getAllDashboardWidgets(): RegisteredDashboardWidget[] {
  const collect = (mod: AppConfig): RegisteredDashboardWidget[] => [
    ...(mod.web?.widgets ?? []).map((w) => ({ ...w, appId: mod.id })),
    ...(mod.children ?? []).flatMap(collect),
  ];
  return getAppRegistry()
    .apps.flatMap(collect)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/**
 * Reserved key for the built-in `enabled` flag every app gets.
 * App-declared flags cannot override this name.
 */
export const BUILTIN_ENABLED_FLAG_KEY = 'enabled';

// Re-export the tags flag key so consumers don't need to pull it from
// the visibility app directly. Keeps the registry as the single
// source of truth for "what built-in flags does every app get?".
export { BUILTIN_ENABLED_TAGS_FLAG_KEY };

/**
 * Keys auto-injected by the registry. App-declared flags using
 * these names are dropped with a warning so the gating contract stays
 * consistent across the app.
 */
const RESERVED_FLAG_KEYS: readonly string[] = [
  BUILTIN_ENABLED_FLAG_KEY,
  BUILTIN_ENABLED_TAGS_FLAG_KEY,
];

function builtinEnabledFlagDef(
  defaultValue: AppVisibility,
): AppFlagDef {
  return {
    type: 'enum',
    label: 'App enabled for',
    description:
      "Who can use this app. 'superusers' restricts it to superusers; 'all' makes it available to every signed-in user; 'none' hides it from everyone (including superusers); 'tagged' restricts it to users whose account tags overlap the 'enabled_tags' list.",
    options: APP_VISIBILITY_OPTIONS,
    default: defaultValue,
  };
}

function builtinEnabledTagsFlagDef(): AppFlagDef {
  return {
    type: 'string',
    label: 'Allowed tags',
    description:
      "Comma-separated list of account tags allowed to use this app. Only consulted when 'enabled' is set to 'tagged'. A user passes if any of their account tags appears in this list.",
    default: '',
  };
}

/**
 * Collect every declared flag across all registered apps — top-level
 * and nested — keyed by app id. Consumed by the settings UI, the
 * aepbase schema syncer, and the `useAppFlag` hook.
 *
 * Every app (including children) automatically receives a built-in
 * `enabled` flag (see `BUILTIN_ENABLED_FLAG_KEY`) so it can be gated
 * independently. App-declared flags of the same name are ignored
 * with a warning so the audience knob stays consistent across the app.
 */
export function getAllAppFlagDefs(): Record<
  string,
  Record<string, AppFlagDef>
> {
  const out: Record<string, Record<string, AppFlagDef>> = {};
  const visit = (mod: AppConfig): void => {
    const declared = mod.flags ?? {};
    for (const reserved of RESERVED_FLAG_KEYS) {
      if (reserved in declared) {
        logger.warn(
          `App "${mod.id}" declares a reserved flag "${reserved}"; built-in definition takes precedence.`,
          { appId: mod.id },
        );
      }
    }
    out[mod.id] = {
      ...declared,
      [BUILTIN_ENABLED_FLAG_KEY]: builtinEnabledFlagDef(
        mod.defaultEnabled ?? DEFAULT_APP_VISIBILITY,
      ),
      [BUILTIN_ENABLED_TAGS_FLAG_KEY]: builtinEnabledTagsFlagDef(),
    };
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of getAppRegistry().apps) {
    visit(mod);
  }
  return out;
}

/**
 * Collect every declared per-user setting across all registered
 * apps — top-level and nested — keyed by app id. Consumed by
 * the user-settings schema syncer and the `useUserSetting` hook.
 *
 * Unlike {@link getAllAppFlagDefs}, there is no built-in setting:
 * per-user audience gating is irrelevant (the `enabled` flag already
 * lives at the app-flag layer).
 */
export function getAllUserSettingDefs(): Record<
  string,
  Record<string, UserSettingDef>
> {
  const out: Record<string, Record<string, UserSettingDef>> = {};
  const visit = (mod: AppConfig): void => {
    const declared = mod.userSettings;
    if (declared && Object.keys(declared).length > 0) {
      out[mod.id] = { ...declared };
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of getAppRegistry().apps) {
    visit(mod);
  }
  return out;
}

/**
 * Collect apps that should appear on the user Settings page —
 * either because they declare per-user settings or because they
 * supply a custom `settingsWidget`. Returns apps in nav order so
 * the page renders deterministically.
 */
export function getAllSettingsWidgets(): {
  appId: string;
  app: AppConfig;
}[] {
  const out: { appId: string; app: AppConfig }[] = [];
  const visit = (mod: AppConfig): void => {
    const hasSettings =
      !!mod.web?.settingsWidget ||
      (mod.userSettings && Object.keys(mod.userSettings).length > 0);
    if (hasSettings) {
      out.push({ appId: mod.id, app: mod });
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of getAppRegistry().apps) {
    visit(mod);
  }
  return out;
}

/**
 * Collect every aepbase resource definition declared by registered
 * apps — top-level and nested. Consumed by the instrumentation
 * hook to push schemas to aepbase on server boot, and by the e2e
 * bootstrap. Order matches app registration; the runner topo-sorts
 * by `parents` before applying.
 */
export function getAllResourceDefs(): ResourceDefinition[] {
  const out: ResourceDefinition[] = [];
  const visit = (mod: AppConfig): void => {
    for (const def of mod.resources ?? []) {
      out.push(def);
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of getAppRegistry().apps) {
    visit(mod);
  }
  return out;
}

/**
 * Same traversal as {@link getAllResourceDefs}, but pairs each
 * definition with the owning app so callers can read
 * `app.web.offlineOverrides` and `app.id` while iterating. Used by
 * the offline mutation factory's auto-registration loop.
 */
export function getAllResourceDefsWithApp(): {
  app: AppConfig;
  def: ResourceDefinition;
}[] {
  const out: { app: AppConfig; def: ResourceDefinition }[] = [];
  const visit = (mod: AppConfig): void => {
    for (const def of mod.resources ?? []) {
      out.push({ app: mod, def });
    }
    for (const child of mod.children ?? []) {
      visit(child);
    }
  };
  for (const mod of getAppRegistry().apps) {
    visit(mod);
  }
  return out;
}

/**
 * Resolve a single AEP-136 custom method by `(plural, verb)`. Scans every
 * declared resource definition (top-level and nested) for one whose plural
 * matches and that declares the verb under `customMethods`. Used by the
 * sidecar's `/api/v1/aep` gateway to dispatch `POST /<plural>:<verb>` calls.
 */
export function getResourceCustomMethod(
  plural: string,
  verb: string,
): ResourceCustomMethod | undefined {
  for (const def of getAllResourceDefs()) {
    if (def.plural === plural) {
      const method = def.customMethods?.[verb];
      if (method) return method;
    }
  }
  return undefined;
}

/**
 * Collect every declared custom method across all registered resources,
 * flattened to a `${plural}:${verb}` key. Useful for diagnostic UIs,
 * the CLI, and tests.
 */
export function getAllResourceCustomMethods(): Record<string, ResourceCustomMethod> {
  const out: Record<string, ResourceCustomMethod> = {};
  for (const def of getAllResourceDefs()) {
    for (const [verb, method] of Object.entries(def.customMethods ?? {})) {
      out[`${def.plural}:${verb}`] = method;
    }
  }
  return out;
}

/**
 * Default export retained for callers that imported the registry
 * object directly. Prefer the named helpers above for new code.
 */
export default appRegistry;
