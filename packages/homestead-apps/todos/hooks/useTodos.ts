/**
 * Todos Query Hooks
 *
 * The app draws from two collections: the household-global `todo` (family) and
 * the user-parented `personal-todo` (private to the current user). aepbase has
 * no `sort` query param, so we order client-side. Within each bucket we sort by
 * `create_time` ascending so the oldest item stays at the top — todometer-style.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useResourceList,
  byCreateTimeAsc,
} from '@rambleraptor/homestead-core/api/resourceHooks';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { queryKeys } from '@rambleraptor/homestead-core/api/queryClient';
import { USERS } from '@rambleraptor/homestead-core/resources/builtins';
import { PERSONAL_TODOS, TODOS } from '../resources';
import {
  MAIN_PROJECT_ID,
  type PersonalTodo,
  type ProjectScope,
  type Todo,
  type TodoBuckets,
  type TodoItem,
  type TodoProgress,
} from '../types';

/** The household-global (family) todos. */
export function useTodos() {
  return useResourceList<Todo>('todos', 'todo', TODOS, {
    sort: byCreateTimeAsc,
  });
}

/**
 * The current user's private todos, read from `/users/{me}/personal-todos`.
 * Disabled (and empty) when there's no authenticated user.
 */
export function usePersonalTodos() {
  const userId = aepbase.getCurrentUser()?.id;
  // User-parented reads need the parent path and can't use the generic
  // `useResourceList` (it has no `enabled` and always fetches, which would hit
  // the non-existent top-level `/personal-todos` when logged out). Keyed under
  // the todos app namespace so family mutations' app-wide invalidation refreshes
  // it too.
  return useQuery<PersonalTodo[], Error>({
    queryKey: queryKeys.app('todos').resource('personal-todo').list(),
    enabled: Boolean(userId),
    queryFn: async (): Promise<PersonalTodo[]> => {
      if (!userId) return [];
      const records = await aepbase.list<PersonalTodo>(PERSONAL_TODOS, {
        parent: [USERS, userId],
      });
      return [...records].sort(byCreateTimeAsc);
    },
  });
}

/**
 * Filter the household (family) todo list down to those visible in a given
 * project scope.
 *
 * - Main scope: todos with no `project` field, plus todos pinned via
 *   `in_main=true`.
 * - Project scope: todos whose `project` matches `projects/{scope}`.
 */
export function filterTodosForScope(
  todos: Todo[],
  scope: ProjectScope,
): Todo[] {
  if (scope === MAIN_PROJECT_ID) {
    return todos.filter((t) => !t.project || t.in_main === true);
  }
  const ref = `projects/${scope}`;
  return todos.filter((t) => t.project === ref);
}

/**
 * Merge family + personal todos for a scope into a single tagged list.
 *
 * - Main scope: family todos visible on main (see {@link filterTodosForScope})
 *   plus every personal todo, tagged by origin and re-sorted by create_time so
 *   the two streams interleave chronologically.
 * - Project scope: family todos for that project only — personal todos never
 *   belong to a project, so they don't appear here.
 */
export function mergeTodosForScope(
  family: Todo[],
  personal: PersonalTodo[],
  scope: ProjectScope,
): TodoItem[] {
  if (scope !== MAIN_PROJECT_ID) {
    return filterTodosForScope(family, scope).map((t) => ({
      ...t,
      kind: 'family' as const,
    }));
  }
  const familyItems: TodoItem[] = filterTodosForScope(family, scope).map(
    (t) => ({ ...t, kind: 'family' as const }),
  );
  const personalItems: TodoItem[] = personal.map((t) => ({
    ...t,
    kind: 'personal' as const,
  }));
  return [...familyItems, ...personalItems].sort(byCreateTimeAsc);
}

export function bucketTodos(todos: TodoItem[]): TodoBuckets {
  const active: TodoItem[] = [];
  const doLater: TodoItem[] = [];
  const completed: TodoItem[] = [];
  for (const t of todos) {
    if (t.status === 'do_later') doLater.push(t);
    else if (t.status === 'completed' || t.status === 'cancelled')
      completed.push(t);
    else active.push(t);
  }
  return { active, doLater, completed };
}

/**
 * Derive the completion-bar value from the full todo list.
 *
 * - Cancelled items are excluded from both numerator and denominator.
 * - Completed items contribute to the green segment.
 * - Pending and do_later items count toward the denominator only.
 */
export function computeProgress(todos: TodoItem[]): TodoProgress {
  const denom = todos.filter((t) => t.status !== 'cancelled').length;
  if (denom === 0) return { green: 0 };
  const green =
    (todos.filter((t) => t.status === 'completed').length / denom) * 100;
  return { green };
}

export function useTodoBuckets(scope: ProjectScope = MAIN_PROJECT_ID) {
  const family = useTodos();
  const personal = usePersonalTodos();

  const scoped = useMemo<TodoItem[]>(
    () => mergeTodosForScope(family.data ?? [], personal.data ?? [], scope),
    [family.data, personal.data, scope],
  );
  const buckets = useMemo<TodoBuckets>(() => bucketTodos(scoped), [scoped]);
  const progress = useMemo<TodoProgress>(
    () => computeProgress(scoped),
    [scoped],
  );

  return {
    scoped,
    buckets,
    progress,
    isLoading: family.isLoading || personal.isLoading,
    isError: family.isError || personal.isError,
    error: family.error ?? personal.error,
    refetch: async () => {
      await Promise.all([family.refetch(), personal.refetch()]);
    },
  };
}
