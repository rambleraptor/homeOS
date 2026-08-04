/**
 * Categories Query Hook + grouping helpers.
 *
 * Categories are a child of a project in aepbase, addressed via the URL
 * (`/projects/{id}/categories`) rather than a filter, so this keeps a
 * per-parent cache key. Ordered by `position` (ascending), then create_time as
 * a stable tie-break.
 */

import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { CATEGORIES, PROJECTS } from '../resources';
import {
  UNCATEGORIZED_ID,
  type Category,
  type CategoryGroup,
  type TodoItem,
} from '../types';

export function categoriesKey(projectId: string | null) {
  return [...queryKeys.app('todos').all(), 'categories', projectId || ''];
}

/** Stable order: ascending `position`, undefined last, create_time tie-break. */
export function sortCategories<
  T extends { position?: number; create_time: string },
>(categories: T[]): T[] {
  return [...categories].sort((a, b) => {
    const pa = a.position ?? Number.MAX_SAFE_INTEGER;
    const pb = b.position ?? Number.MAX_SAFE_INTEGER;
    if (pa !== pb) return pa - pb;
    return a.create_time.localeCompare(b.create_time);
  });
}

export function useCategories(projectId: string | null) {
  return useQuery({
    queryKey: categoriesKey(projectId),
    queryFn: async (): Promise<Category[]> => {
      if (!projectId) return [];
      const cats = await aepbase.list<Category>(CATEGORIES, {
        parent: [PROJECTS, projectId],
      });
      return sortCategories(cats);
    },
    enabled: !!projectId,
  });
}

/**
 * Group items under their category in category order, with an "Uncategorized"
 * group appended only when it has items. Every declared category is included
 * even when empty (managed categories can be empty — that's an add target).
 * `categories` is assumed already sorted (see {@link sortCategories}); callers
 * that pass an unsorted list should sort first. `getCategoryId` reads the item's
 * category-reference field (`category` on todos, `template_category` on items).
 */
export function groupByCategory<T>(
  items: T[],
  categories: { id: string; name: string }[],
  getCategoryId: (item: T) => string | undefined,
): CategoryGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const c of categories) buckets.set(c.id, []);
  const uncategorized: T[] = [];
  for (const item of items) {
    const cid = getCategoryId(item);
    const bucket = cid ? buckets.get(cid) : undefined;
    if (bucket) bucket.push(item);
    else uncategorized.push(item);
  }
  const groups: CategoryGroup<T>[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    items: buckets.get(c.id) ?? [],
  }));
  if (uncategorized.length > 0) {
    groups.push({ id: UNCATEGORIZED_ID, name: null, items: uncategorized });
  }
  return groups;
}

/** Group todos by their `category` field. See {@link groupByCategory}. */
export function groupTodosByCategory(
  todos: TodoItem[],
  categories: Category[],
): CategoryGroup<TodoItem>[] {
  return groupByCategory(todos, categories, (t) => t.category);
}
