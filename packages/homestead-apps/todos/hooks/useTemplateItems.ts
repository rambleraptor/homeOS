/**
 * Template Items Query Hook
 *
 * Items are a child of list-templates in aepbase, addressed via the URL
 * (`/list-templates/{id}/template-items`) rather than a filter, so this keeps
 * a per-parent cache key. Oldest first, ordered server-side.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { LIST_TEMPLATES, TEMPLATE_ITEMS } from '../resources';
import type { TemplateItem } from '../types';

export function templateItemsKey(templateId: string | null) {
  return [...queryKeys.app('todos').all(), 'template-items', templateId || ''];
}

export function useTemplateItems(templateId: string | null) {
  return useQuery({
    queryKey: templateItemsKey(templateId),
    queryFn: async () => {
      if (!templateId) return [];
      return aepbase.list<TemplateItem>(TEMPLATE_ITEMS, {
        parent: [LIST_TEMPLATES, templateId],
        orderBy: 'create_time',
      });
    },
    enabled: !!templateId,
  });
}
