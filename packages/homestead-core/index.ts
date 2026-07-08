/**
 * `@rambleraptor/homestead-core` public entry point.
 *
 * `package.json` points `main`/`types` here, so the bare specifier
 * `import { ... } from '@rambleraptor/homestead-core'` resolves to this
 * barrel. It intentionally re-exports only the **authoring contract types**
 * — the surface an app author or operator writes against — and stays
 * side-effect free (type-only re-exports drag no React/server runtime into
 * the bare entry).
 *
 * Everything else in the package is reached via its deep path
 * (e.g. `@rambleraptor/homestead-core/api/aepbase`,
 * `@rambleraptor/homestead-core/auth`), which is the primary, documented
 * import style. This barrel exists so the package has a valid, discoverable
 * root entry rather than a dangling `main` pointing at a missing file.
 */

// App-authoring contract (AppConfig, AppRoute, AppFlagDef, widgets, …)
export type * from './apps/types';

// Operator instance config (HomesteadConfig, AuthConfig, OAuthConfig, AiConfig, …)
export type * from './apps/config';

// aepbase resource-definition authoring types (ResourceDefinition, FieldDef, …)
export type * from './resources/types';
