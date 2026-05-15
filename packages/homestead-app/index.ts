/**
 * Public barrel for `@rambleraptor/homestead-app`.
 *
 * Most consumer code reaches into sub-paths (e.g.
 * `@rambleraptor/homestead-app/pages/RootLayout`,
 * `@rambleraptor/homestead-app/registry/types`), so this barrel is kept
 * intentionally small — it just surfaces the top-level factories an
 * operator wires up in their consumer app once.
 */

export { createNextConfig } from './next-config/createNextConfig';
export { register, onRequestError } from './instrumentation/index';
export type { HomesteadConfig } from './registry/config';
export type { HomeModule, ModuleRoute } from './registry/types';
