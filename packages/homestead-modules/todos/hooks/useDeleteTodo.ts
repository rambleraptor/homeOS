import { useResourceDelete } from '@rambleraptor/homestead-core/api/resourceHooks';

export function useDeleteTodo() {
  return useResourceDelete('todos', 'todo');
}
