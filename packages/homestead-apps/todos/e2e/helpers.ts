/**
 * Todos E2E helpers — seed todos and projects via the aepbase REST API.
 */

import { aepCreate, aepList, aepRemove } from '../../../../tests/e2e/utils/aepbase-helpers';

export type TodoStatus = 'pending' | 'do_later' | 'completed' | 'cancelled';

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

export interface ListTemplateRecord {
  id: string;
  name: string;
}

export async function createListTemplate(
  token: string,
  data: { name: string },
): Promise<ListTemplateRecord> {
  return aepCreate<ListTemplateRecord>(token, 'list-templates', {
    name: data.name,
  });
}

export async function addTemplateItem(
  token: string,
  templateId: string,
  title: string,
): Promise<{ id: string; title: string }> {
  return aepCreate<{ id: string; title: string }>(
    token,
    'template-items',
    { title },
    ['list-templates', templateId],
  );
}

export async function deleteAllListTemplates(token: string) {
  const items = await aepList<{ id: string }>(token, 'list-templates');
  for (const item of items) {
    // Force the cascade so child template-items are removed with the parent.
    await aepRemove(token, 'list-templates', item.id, undefined, true);
  }
}
