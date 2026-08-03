/**
 * Todos Query Hook
 *
 * aepbase has no `sort` query param, so we order client-side. Within each
 * bucket we sort by `create_time` ascending so the oldest item stays at the
 * top — todometer-style.
 */

import { useMemo } from 'react';
import {
  useResourceList,
  byCreateTimeAsc,
} from '@rambleraptor/homestead-core/api/resourceHooks';
import { TODOS } from '../resources';
import {
  MAIN_PROJECT_ID,
  type ProjectScope,
  type Todo,
  type TodoBuckets,
  type TodoProgress,
} from '../types';

export function useTodos() {
  return useResourceList<Todo>('todos', 'todo', TODOS, {
    sort: byCreateTimeAsc,
  });
}

/**
 * Filter the full todo list down to those visible in a given project scope.
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

export function bucketTodos(todos: Todo[]): TodoBuckets {
  const active: Todo[] = [];
  const doLater: Todo[] = [];
  const completed: Todo[] = [];
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
export function computeProgress(todos: Todo[]): TodoProgress {
  const denom = todos.filter((t) => t.status !== 'cancelled').length;
  if (denom === 0) return { green: 0 };
  const green =
    (todos.filter((t) => t.status === 'completed').length / denom) * 100;
  return { green };
}

export function useTodoBuckets(scope: ProjectScope = MAIN_PROJECT_ID) {
  const query = useTodos();
  const scoped = useMemo<Todo[]>(
    () => filterTodosForScope(query.data ?? [], scope),
    [query.data, scope],
  );
  const buckets = useMemo<TodoBuckets>(() => bucketTodos(scoped), [scoped]);
  const progress = useMemo<TodoProgress>(
    () => computeProgress(scoped),
    [scoped],
  );
  return { ...query, buckets, progress, scoped };
}
