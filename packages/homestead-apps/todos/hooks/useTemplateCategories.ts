/**
 * Template Categories Query Hook.
 *
 * A child of list-templates in aepbase, addressed via the URL
 * (`/list-templates/{id}/template-categories`). Ordered by `position`
 * (ascending), create_time tie-break — reusing the project-category sorter.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { LIST_TEMPLATES, TEMPLATE_CATEGORIES } from '../resources';
import type { TemplateCategory } from '../types';
import { sortCategories } from './useCategories';

export function templateCategoriesKey(templateId: string | null) {
  return [
    ...queryKeys.app('todos').all(),
    'template-categories',
    templateId || '',
  ];
}

export function useTemplateCategories(templateId: string | null) {
  return useQuery({
    queryKey: templateCategoriesKey(templateId),
    queryFn: async (): Promise<TemplateCategory[]> => {
      if (!templateId) return [];
      const cats = await aepbase.list<TemplateCategory>(TEMPLATE_CATEGORIES, {
        parent: [LIST_TEMPLATES, templateId],
      });
      return sortCategories(cats);
    },
    enabled: !!templateId,
  });
}
