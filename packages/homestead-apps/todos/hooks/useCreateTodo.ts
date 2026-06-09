import { useResourceCreate } from '@rambleraptor/homestead-core/api/resourceHooks';
import type { Todo, TodoStatus } from '../types';

interface CreateTodoBody {
  title: string;
  status: TodoStatus;
  /** aepbase resource path, e.g. `projects/{id}`. Omit for main scope. */
  project?: string;
}

export function useCreateTodo() {
  return useResourceCreate<Todo, CreateTodoBody>('todos', 'todo');
}
