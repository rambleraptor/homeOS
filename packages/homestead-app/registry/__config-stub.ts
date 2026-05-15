/**
 * Type-checking stub for the `@homestead-config` alias.
 *
 * Consumer apps shadow this with their own `homestead.config.ts` via the
 * `@homestead-config` path alias in their `tsconfig.json`:
 *
 *     "paths": { "@homestead-config": ["./homestead.config.ts"] }
 *
 * The package itself never resolves to this stub in real builds — it's
 * here purely so the registry type-checks standalone (e.g. when running
 * `tsc --noEmit` inside `packages/homestead-app/`).
 */

import type { HomesteadConfig } from './config';

const stub: HomesteadConfig = { modules: [] };
export default stub;
