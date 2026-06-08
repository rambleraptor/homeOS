/**
 * Module System Types
 *
 * This file defines the contract that every module must follow.
 * All modules registered in the system must implement the HomeModule interface.
 */

import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ModuleFilterDecl } from '../shared/filters/types';
import type { ResourceDefinition } from '../resources/types';
import type { ModuleVisibility } from '../settings/visibility';
import type { ResourceMutationOpts } from '../api/registerResourceMutationDefaults';

/**
 * A lazily-loaded React component. The thunk resolves to either a module
 * namespace with a `default` export or the component itself, so both
 * `() => import('./Foo')` (default export) and
 * `() => import('./Foo').then(m => m.Foo)` (named export) are valid.
 *
 * Declaring components this way keeps `module.config.ts` free of eager
 * React/component imports: client consumers wrap the thunk in
 * `React.lazy` (see `modules/lazy.tsx`) and the catch-all server route
 * resolves it with `await`. This both enables per-module code-splitting
 * and lets a non-React consumer import a config without dragging the
 * component graph (and its browser-only side effects) into scope.
 */
export type LazyComponent<P = unknown> = () => Promise<
  { default: ComponentType<P> } | ComponentType<P>
>;

/**
 * A lazily-loaded Lucide icon. Resolves directly to the icon component,
 * e.g. `() => import('lucide-react').then(m => m.ShoppingCart)`.
 */
export type LazyIcon = () => Promise<LucideIcon>;

/**
 * A widget a module contributes to the dashboard. The component is
 * responsible for its own data fetching and chrome (typically a
 * `SectionCard`); the dashboard just lays widgets out in `order`.
 */
export interface DashboardWidget {
  /** Stable id, unique across all modules. */
  id: string;
  /**
   * Human-readable label shown in the dashboard customization UI.
   * Falls back to `id` when omitted.
   */
  label?: string;
  /** Self-contained widget component (lazily loaded). Receives no props. */
  component: LazyComponent;
  /** Lower numbers render first. Defaults to 100. */
  order?: number;
}

/**
 * Props passed to a route's component when the catch-all router renders it.
 * `params` carries values captured from `:name` segments in `ModuleRoute.path`.
 * Optional so components that don't take params (the common case) can be
 * assigned directly without a wrapping adapter.
 */
export interface ModuleRouteProps {
  params?: Record<string, string>;
}

/**
 * Route definition consumed by the single catch-all renderer at
 * `app/(app)/[[...slug]]/page.tsx`. The component is declared inline so a
 * module is fully self-describing — no per-route page file is needed.
 */
export interface ModuleRoute {
  /**
   * Path relative to the module's basePath. Empty string for the index
   * route. Use `:name` segments for dynamic params (e.g. `:id`).
   */
  path: string;

  /**
   * Whether this is the index route
   */
  index?: boolean;

  /**
   * Component rendered at this route (lazily loaded). Receives resolved
   * `:name` params.
   */
  component: LazyComponent<ModuleRouteProps>;

  /**
   * Optional gates wrapping the component. Names resolve to wrapper
   * components in `homestead-core/modules/router/gates`.
   */
  gates?: Array<'enabled' | 'superuser'>;

  /**
   * True when the path uses dynamic params (`:id`) and should not be
   * statically prerendered by `generateStaticParams`.
   */
  dynamic?: boolean;
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
   * Lucide icon for navigation (lazily loaded). Client consumers render
   * it via `<ModuleIcon icon={...} />`.
   */
  icon: LazyIcon;

  /**
   * Optional custom icon used when this app is added to a device's home
   * screen (PWA install). A URL/path to a square raster image (PNG, ideally
   * 512×512). When set, navigating anywhere within this app swaps the
   * document's `apple-touch-icon` and web app manifest so an "Add to Home
   * Screen" uses this image — and the app's own name and start path —
   * instead of the shared Homestead icon. Apps that omit it fall back to the
   * global Homestead home-screen icon.
   *
   * Example: `homeScreenIcon: '/module-icons/groceries.png'`
   */
  homeScreenIcon?: string;

  /**
   * Base path for module routes (must start with /)
   * Example: '/dashboard', '/chores'
   */
  basePath: string;

  /**
   * Route definitions for this module
   * Routes are now defined by the Next.js App Router file structure
   */
  routes: ModuleRoute[];

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
   * Section/category for grouping modules in navigation
   * Modules without a section will be displayed at the end
   */
  section?: string;

  /**
   * Whether this module is enabled
   * Can be used for feature flags
   * @default true
   */
  enabled?: boolean;

  /**
   * Default audience for the built-in `enabled` flag that the registry
   * auto-injects for every module. Controls who can see/use the module
   * until an admin overrides the flag in the Flag Management UI.
   * @default 'all'
   */
  defaultEnabled?: ModuleVisibility;

  /**
   * Additional module-specific metadata
   */
  metadata?: Record<string, unknown>;

  /**
   * Optional filterable fields for the module's list view. A shared
   * `<FilterBar>` renders one input per decl and the list is filtered
   * in-memory client-side — no server round-trip.
   */
  filters?: ModuleFilterDecl[];

  /**
   * Optional module-scoped flags. Each entry declares a typed knob
   * that a household member can tweak from the settings UI.
   *
   * The registry flattens all declared flags across modules into a
   * single aepbase-backed singleton (`module-flags` resource) whose
   * field names are `${moduleId_snake}__${key}`.
   */
  flags?: Record<string, ModuleFlagDef>;

  /**
   * Optional per-user settings owned by this module. Same shape as
   * `flags`, but values are scoped to the signed-in user instead of
   * being household-wide. Declarations are flattened into the
   * `user-preference` resource (one record per user, parented under
   * `/users/{id}/preferences/{id}`) with field names
   * `${moduleId_snake}__${key}`.
   *
   * The settings page renders a section per module that has either
   * `userSettings` or `settingsWidget`. When only `userSettings` is
   * declared, an auto-generated form is rendered.
   */
  userSettings?: Record<string, UserSettingDef>;

  /**
   * Optional custom React component shown on the user Settings page in
   * place of the auto-generated form. Use this when a module's per-user
   * settings need bespoke UI (e.g. a picker that depends on other
   * resources, or grouped controls). The component receives no props
   * and reads/writes its own state via `useUserSetting`.
   */
  settingsWidget?: LazyComponent;

  /**
   * Optional aepbase resource definitions owned by this module. The
   * registry aggregates them across all modules (including children)
   * and the Next.js instrumentation hook applies them to aepbase via
   * `/aep-resource-definitions` on server boot. Each `singular` must
   * be globally unique.
   */
  resources?: ResourceDefinition[];

  /**
   * Per-resource overrides applied when the offline mutation factory
   * auto-registers create/update/delete defaults. Key is the resource
   * `singular`. `false` skips auto-registration entirely (escape hatch
   * for modules with bespoke mutation logic). An object merges into
   * `ResourceMutationOpts` — useful for non-standard cache keys,
   * cascade deletes, custom optimistic shapes, or legacy mutation-key
   * aliases during migrations.
   */
  offlineOverrides?: Record<string, ResourceOverride | false>;

  /**
   * Optional widgets this module contributes to the dashboard. Each
   * widget is an independent React component that owns its own data
   * fetching and presentation.
   */
  widgets?: DashboardWidget[];

  /**
   * Server-side endpoints are declared as AEP-136 custom methods on the
   * module's resource definitions (`ResourceDefinition.customMethods`),
   * not on the module itself — they live on the resource they act on and
   * are addressed as `POST /<plural>:<verb>`. See
   * `core/resources/types.ts#ResourceCustomMethod`.
   */

  /**
   * Optional sub-modules. When set, this module is a container —
   * the registry validates each child's `basePath` is a prefix-match
   * of the parent's, aggregates child routes and dashboard widgets,
   * and a generic `<NestedModuleLanding>` renders cards for each
   * child on the parent's index page. Children get their own `enabled`
   * flag (and any other declared flags) and can be reached via
   * `getModule(id)`, so each nested page can be gated independently.
   * Children still stay out of top-level navigation: the parent owns
   * the sidebar placement.
   */
  children?: HomeModule[];
}

/**
 * Per-resource overrides for the offline mutation factory.
 *
 * The factory derives almost everything from convention — list cache key,
 * mutation keys, optimistic shape, request body. Modules only need an
 * override when they have something the convention can't express:
 * `parentPath` for nested resources, `cascadeDelete` for cross-resource
 * effects on delete.
 */
export type ResourceOverride = Partial<
  Pick<ResourceMutationOpts, 'parentPath' | 'cascadeDelete'>
>;

/**
 * Runtime value a flag can hold. Matches `ModuleFlagDef.type`
 * one-to-one — `enum` flags store their selected option as a string.
 */
export type ModuleFlagValue = string | number | boolean;

/**
 * Declarative description of a single module flag. The settings UI
 * renders the right input widget based on `type`; the aepbase schema
 * syncer converts `type` into a JSON-schema property.
 *
 * `description` is required so the Flag Management admin UI can always
 * show an operator what a flag does before they toggle it.
 */
export type ModuleFlagDef =
  | {
      type: 'string';
      label: string;
      description: string;
      default?: string;
    }
  | {
      type: 'number';
      label: string;
      description: string;
      default?: number;
    }
  | {
      type: 'boolean';
      label: string;
      description: string;
      default?: boolean;
    }
  | {
      type: 'enum';
      label: string;
      description: string;
      options: readonly string[];
      default?: string;
    };

/**
 * Runtime value a per-user setting can hold. Matches `UserSettingDef.type`
 * one-to-one — `enum` settings store their selected option as a string.
 */
export type UserSettingValue = string | number | boolean;

/**
 * Declarative description of a single per-user module setting.
 * Structurally identical to `ModuleFlagDef` — the only difference is
 * scope (per-user vs. household). Aliasing avoids drift between the two
 * declaration shapes; the rendering and schema-encoding helpers operate
 * on the same union.
 */
export type UserSettingDef = ModuleFlagDef;

/**
 * Module Registry
 * Central registry of all available modules in the system
 */
export interface ModuleRegistry {
  modules: HomeModule[];
  getModule: (id: string) => HomeModule | undefined;
  getNavigationModules: () => HomeModule[];
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
