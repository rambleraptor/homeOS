import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, ListChecks } from 'lucide-react';
import { aepbase } from '@rambleraptor/homestead-core/api/aepbase';
import { SkeletonList } from '@rambleraptor/homestead-core/shared/components/Skeleton';
import { useTodoBuckets } from '../hooks/useTodos';
import { useProjects } from '../hooks/useProjects';
import { useCategories, groupTodosByCategory } from '../hooks/useCategories';
import { useCreateTodo } from '../hooks/useCreateTodo';
import { useCreatePersonalTodo } from '../hooks/useCreatePersonalTodo';
import { useUpdateTodo } from '../hooks/useUpdateTodo';
import { useUpdatePersonalTodo } from '../hooks/useUpdatePersonalTodo';
import {
  SYNTHETIC_TODO_GROCERIES_ID,
  useSyntheticTodos,
} from '../hooks/useSyntheticTodos';
import {
  MAIN_PROJECT_ID,
  type ProjectScope,
  type TodoItem,
  type TodoKind,
  type TodoStatus,
} from '../types';
import { TodoProgressBar } from './TodoProgressBar';
import { AddTodoInput } from './AddTodoInput';
import { TodoRow } from './TodoRow';
import { CategoryManager } from './CategoryManager';
import { CollapsibleSection } from './CollapsibleSection';
import { ProjectSwitcher } from './ProjectSwitcher';

export function TodosHome() {
  const location = useLocation();
  // A freshly instantiated template navigates here with the new project id in
  // location state so we open straight to that list.
  const initialScope =
    (location.state as { scope?: ProjectScope } | null)?.scope ??
    MAIN_PROJECT_ID;
  const [scope, setScope] = useState<ProjectScope>(initialScope);
  const {
    buckets,
    progress,
    scoped,
    isLoading,
    isError,
    error,
  } = useTodoBuckets(scope);
  const projectsQuery = useProjects();
  const synthetic = useSyntheticTodos();
  const create = useCreateTodo();
  const createPersonal = useCreatePersonalTodo();
  const update = useUpdateTodo();
  const updatePersonal = useUpdatePersonalTodo();
  const currentUserId = aepbase.getCurrentUser()?.id;

  const isMain = scope === MAIN_PROJECT_ID;
  // Categories only exist inside a real project list.
  const categoriesQuery = useCategories(isMain ? null : scope);
  const categories = categoriesQuery.data ?? [];
  const hasCategories = !isMain && categories.length > 0;
  // Target category for newly-added todos in this project view.
  const [addCategoryId, setAddCategoryId] = useState('');

  const isUpdating = update.isPending || updatePersonal.isPending;
  const isCreating = create.isPending || createPersonal.isPending;
  // Completion counts share the progress bar's basis: cancelled items are
  // excluded, so `done / total` matches the green percentage exactly.
  const nonCancelled = scoped.filter((t) => t.status !== 'cancelled');
  const doneCount = nonCancelled.filter((t) => t.status === 'completed').length;
  const totalCount = nonCancelled.length;
  const projectsById = new Map(
    (projectsQuery.data ?? []).map((p) => [p.id, p]),
  );

  const handleAdd = async (title: string, kind: TodoKind) => {
    if (kind === 'personal') {
      await createPersonal.mutateAsync({ title, status: 'pending' });
      return;
    }
    await create.mutateAsync({
      title,
      status: 'pending',
      ...(isMain ? {} : { project: `projects/${scope}` }),
      ...(hasCategories && addCategoryId ? { category: addCategoryId } : {}),
    });
  };

  const handleSetStatus = (todo: TodoItem, status: TodoStatus) => {
    if (todo.kind === 'personal') {
      updatePersonal.mutate({ id: todo.id, data: { status } });
      return;
    }
    update.mutate({ id: todo.id, data: { status } });
  };

  const handleTogglePin = (id: string, inMain: boolean) => {
    update.mutate({ id, data: { in_main: inMain } });
  };

  const originLabelFor = (todo: TodoItem): string | undefined => {
    if (!isMain) return undefined;
    if (!todo.project) return undefined;
    const id = todo.project.replace(/^projects\//, '');
    return projectsById.get(id)?.name;
  };

  const togglePinHandlerFor = (todo: TodoItem) => {
    if (isMain) {
      // On main: only show the pin control for todos that originate in a
      // project (so users can unpin them). Native main-only todos shouldn't
      // expose the action.
      if (!todo.project) return undefined;
      return (inMain: boolean) => handleTogglePin(todo.id, inMain);
    }
    return (inMain: boolean) => handleTogglePin(todo.id, inMain);
  };

  // Shared per-row wiring for real (non-synthetic) todos. The family marker and
  // "you" hint only apply on the main mixed view, where personal and family
  // todos are interleaved; inside a project view every row is already family.
  const rowProps = (todo: TodoItem) => ({
    onSetStatus: (status: TodoStatus) => handleSetStatus(todo, status),
    disabled: isUpdating,
    onTogglePin: togglePinHandlerFor(todo),
    pinnedFromLabel: originLabelFor(todo),
    familyMarker: isMain && todo.kind === 'family',
    createdByYou:
      isMain &&
      todo.kind === 'family' &&
      Boolean(currentUserId) &&
      todo.created_by === `users/${currentUserId}`,
  });

  // Active todos grouped by category (project view with categories); the
  // uncategorized group is appended only when it has items.
  const activeGroups = groupTodosByCategory(buckets.active, categories);

  // Synthetic todos only belong on the main view.
  const showSynthetic = isMain;
  const activeCount =
    buckets.active.length + (showSynthetic ? synthetic.length : 0);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <ProjectSwitcher scope={scope} onChange={setScope} />

      <TodoProgressBar
        progress={progress}
        done={doneCount}
        total={totalCount}
      />

      {!isMain && (
        <CategoryManager projectId={scope} categories={categories} />
      )}

      {hasCategories && (
        <div className="flex items-center gap-2 px-1">
          <label
            htmlFor="todos-add-category"
            className="font-body text-sm text-text-muted"
          >
            Add to
          </label>
          <select
            id="todos-add-category"
            data-testid="todos-add-category"
            value={addCategoryId}
            onChange={(e) => setAddCategoryId(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 font-body text-sm text-text-main focus:border-accent-terracotta focus:outline-none"
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <AddTodoInput
        onSubmit={handleAdd}
        disabled={isCreating}
        allowPersonal={isMain}
      />

      {isLoading && (
        <SkeletonList
          rows={5}
          showLeading
          label="Loading todos"
          data-testid="todos-loading"
        />
      )}

      {isError && (
        <div className="bg-red-50/50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'Failed to load todos'}
          </p>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div data-testid="todos-section-active" className="space-y-3">
            <div className="flex items-center gap-2 text-brand-navy">
              <h2 className="font-display text-lg font-semibold">To Do</h2>
              {activeCount > 0 && (
                <span className="font-body text-sm font-medium text-text-muted">
                  ({activeCount})
                </span>
              )}
            </div>
            {hasCategories ? (
              <div className="space-y-4" data-testid="todos-active-groups">
                {activeGroups.map((group) => (
                  <div
                    key={group.id}
                    data-testid={`todos-category-group-${group.id}`}
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2 px-1">
                      <h3 className="font-display text-sm font-semibold text-brand-navy">
                        {group.name ?? 'Uncategorized'}
                      </h3>
                      {group.items.length > 0 && (
                        <span className="font-body text-xs text-text-muted">
                          ({group.items.length})
                        </span>
                      )}
                    </div>
                    {group.items.length === 0 ? (
                      <p className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-3 text-center font-body text-xs text-text-muted">
                        No items in this category yet.
                      </p>
                    ) : (
                      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                        {group.items.map((todo) => (
                          <TodoRow
                            key={todo.id}
                            todo={todo}
                            variant="active"
                            {...rowProps(todo)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : buckets.active.length === 0 &&
              (!showSynthetic || synthetic.length === 0) ? (
              <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-8 text-center">
                <ListChecks className="h-8 w-8 text-accent-terracotta/60" />
                <p className="font-body text-sm text-text-muted">
                  Nothing pending — add an item above to get started.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {showSynthetic &&
                  synthetic.map((todo) => (
                    <TodoRow
                      key={todo.id}
                      todo={todo}
                      variant="active"
                      onSetStatus={() => undefined}
                      readOnly
                      href={
                        todo.id === SYNTHETIC_TODO_GROCERIES_ID
                          ? '/groceries'
                          : undefined
                      }
                    />
                  ))}
                {buckets.active.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    variant="active"
                    {...rowProps(todo)}
                  />
                ))}
              </div>
            )}
          </div>

          {buckets.doLater.length > 0 && (
            <CollapsibleSection
              title="Do Later"
              testId="todos-section-dolater"
              count={buckets.doLater.length}
            >
              {buckets.doLater.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  variant="doLater"
                  {...rowProps(todo)}
                />
              ))}
            </CollapsibleSection>
          )}

          {buckets.completed.length > 0 && (
            <CollapsibleSection
              title="Completed"
              testId="todos-section-completed"
              count={buckets.completed.length}
              defaultOpen={false}
            >
              {buckets.completed.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  variant="completed"
                  {...rowProps(todo)}
                />
              ))}
            </CollapsibleSection>
          )}
        </>
      )}
    </div>
  );
}
