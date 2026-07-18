import { useQuery } from '@tanstack/react-query';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { DOCUMENTS } from '../resources';
import { documentKeys } from './useDocuments';
import type { Document } from '../types';

/**
 * A single document, for the detail page.
 *
 * Polls while the document is still being read so the detail page catches the
 * background classify result, mirroring the list's behaviour.
 */
export function useDocument(id: string | null) {
  return useQuery({
    queryKey: documentKeys.detail(id ?? ''),
    queryFn: async (): Promise<Document> => {
      if (!id) throw new Error('Document id is required');
      return aepbase.get<Document>(DOCUMENTS, id);
    },
    enabled: !!id,
    refetchInterval: (query) =>
      query.state.data?.parse_status === 'pending' ? 2000 : false,
  });
}
