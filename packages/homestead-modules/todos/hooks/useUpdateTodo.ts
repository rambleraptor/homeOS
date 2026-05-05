import { useResourceUpdate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Todo } from '../types';

/**
 * Generic todo update — pass any subset of mutable fields under `data`.
 * Replaces the per-field hooks (`useUpdateTodoStatus`, `useToggleTodoInMain`)
 * that previously wrapped this same mutation.
 */
export function useUpdateTodo() {
  return useResourceUpdate<Todo, Partial<Todo>>('todos', 'todo');
}
