/**
 * Todos E2E helpers — seed todos and projects via the aepbase REST API.
 */

import { aepCreate, aepList, aepRemove } from '../../../../tests/e2e/utils/aepbase-helpers';

export type TodoStatus =
  | 'pending'
  | 'in_progress'
  | 'do_later'
  | 'completed'
  | 'cancelled';

export interface TodoRecord {
  id: string;
  title: string;
  status: TodoStatus;
  project?: string;
  in_main?: boolean;
}

export async function createTodo(
  token: string,
  data: {
    title: string;
    status?: TodoStatus;
    project_id?: string;
    in_main?: boolean;
  },
): Promise<TodoRecord> {
  return aepCreate<TodoRecord>(token, 'todos', {
    title: data.title,
    status: data.status ?? 'pending',
    ...(data.project_id ? { project: `projects/${data.project_id}` } : {}),
    ...(data.in_main !== undefined ? { in_main: data.in_main } : {}),
  });
}

export async function deleteAllTodos(token: string) {
  const items = await aepList<{ id: string }>(token, 'todos');
  for (const item of items) {
    await aepRemove(token, 'todos', item.id);
  }
}

export interface ProjectRecord {
  id: string;
  name: string;
}

export async function createProject(
  token: string,
  data: { name: string },
): Promise<ProjectRecord> {
  return aepCreate<ProjectRecord>(token, 'projects', { name: data.name });
}

export async function deleteAllProjects(token: string) {
  const items = await aepList<{ id: string }>(token, 'projects');
  for (const item of items) {
    await aepRemove(token, 'projects', item.id);
  }
}
