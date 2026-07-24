/**
 * Generic "list every record of a collection" hook, used by the reference
 * picker to load a reference field's options. Unlike the per-app list hooks
 * (`useGiftCards`, `usePeople`, …) it is not tied to a single resource — it
 * takes a plural and lists it. The heavy lifting (pagination) lives in
 * `aepbase.list`.
 */

import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import type { AepRecord } from './pickRecordLabel';

interface UseResourceListOptions {
  /**
   * Skip the request. The picker passes `false` while the target plural is
   * unresolved (unknown or parent-scoped reference), so a bad list call is
   * never made.
   */
  enabled?: boolean;
}

/**
 * Fetch every record of `plural`. Returns the React Query result; `data` is a
 * flat array (pagination followed internally). Disabled — and resolves to an
 * empty list — when `plural` is falsy or `enabled` is false.
 */
export function useResourceList(
  plural: string | undefined,
  { enabled = true }: UseResourceListOptions = {},
) {
  return useQuery({
    queryKey: ['resource-list', plural],
    queryFn: () => aepbase.list<AepRecord>(plural as string),
    enabled: Boolean(plural) && enabled,
  });
}
