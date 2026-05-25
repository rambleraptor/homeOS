/**
 * Browser-side singleton of the typed `HomesteadClient`.
 *
 * Hooks and components import `client` from this module to issue typed
 * requests:
 *
 *   import { client } from '@rambleraptor/homestead-core/api/client';
 *   const todos = await client.todos.list();
 *
 * Wraps the same `/api/aep` proxy and the same auth store as the legacy
 * `aepbase.*` functions, so reads/writes round-trip through the same
 * transport regardless of which surface the caller picks. Phase 3 will
 * sweep remaining call sites onto this surface; the legacy shim then
 * goes away.
 */

import { createClient } from '@rambleraptor/homestead-aep-client';
import { authStore } from './aepbase';

export const client = createClient({
  baseUrl: '/api/aep',
  auth: { getToken: () => authStore.token || null },
});

export type { HomesteadClient } from '@rambleraptor/homestead-aep-client';
