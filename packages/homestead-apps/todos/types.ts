/**
 * Todo App Types
 */

export type TodoStatus = 'pending' | 'do_later' | 'completed' | 'cancelled';

export const TODO_STATUSES: readonly TodoStatus[] = [
  'pending',
  'do_later',
  'completed',
  'cancelled',
] as const;

/**
 * Todo record from aepbase. Matches the shape declared in
 * `packages/homestead-apps/todos/resources.ts`.
 */
export interface Todo {
  id: string;
  path: string;
  title: string;
  status: TodoStatus;
  created_by?: string;
  create_time: string;
  update_time: string;
  /** 'projects/{id}'. Empty/missing means the main project. */
  project?: string;
  /** When true, the todo also appears on the main view. */
  in_main?: boolean;
}

export interface TodoFormData {
  title: string;
}

/**
 * Project record from aepbase.
 */
export interface Project {
  id: string;
  path: string;
  name: string;
  created_by?: string;
  create_time: string;
  update_time: string;
}

/**
 * A reusable checklist template. Instantiating one creates a new project
 * pre-filled with a `pending` todo for each of its items.
 */
export interface ListTemplate {
  id: string;
  path: string;
  name: string;
  created_by?: string;
  create_time: string;
  update_time: string;
}

/**
 * A single item within a {@link ListTemplate}. Stored as a child of the
 * template (`/list-templates/{id}/template-items/{id}`), so the parent id
 * lives in the URL rather than as a stored field.
 */
export interface TemplateItem {
  id: string;
  path: string;
  title: string;
  create_time: string;
  update_time: string;
}

export interface TemplateItemFormData {
  title: string;
}

/**
 * Sentinel id for the implicit main project. The main project is not a real
 * record — it's the union of todos with no `project` field plus todos pinned
 * to main via `in_main=true`.
 */
export const MAIN_PROJECT_ID = '__main__' as const;

/**
 * The currently selected project view. Either `MAIN_PROJECT_ID` or a real
 * project record id.
 */
export type ProjectScope = string;

/**
 * Three buckets the UI splits the list into. `active` covers `pending`;
 * `doLater` covers `do_later`; `completed` covers both `completed` and
 * `cancelled`.
 */
export interface TodoBuckets {
  active: Todo[];
  doLater: Todo[];
  completed: Todo[];
}

/**
 * Progress percentage for the completion bar (0-100). Cancelled items are
 * excluded from the denominator entirely.
 */
export interface TodoProgress {
  green: number;
}
