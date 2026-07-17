import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { queryClient, queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { DOCUMENTS } from '../resources';
import type { Document } from '../types';

export const documentKeys = queryKeys.app('documents').resource('document');

/** Newest first. */
export function useDocuments() {
  return useQuery({
    queryKey: documentKeys.list(),
    queryFn: async () => {
      const docs = await aepbase.list<Document>(DOCUMENTS);
      return [...docs].sort((a, b) =>
        (b.create_time ?? '').localeCompare(a.create_time ?? ''),
      );
    },
    /**
     * A document classifies in the background, so a row that's `pending` will
     * change without any local mutation. Poll only while something is in
     * flight — an idle list shouldn't generate traffic.
     */
    refetchInterval: (query) =>
      query.state.data?.some((d) => d.parse_status === 'pending') ? 2000 : false,
  });
}

/** Invalidate every documents query — used after upload/classify/delete. */
export async function invalidateDocuments(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: queryKeys.app('documents').all() });
}
