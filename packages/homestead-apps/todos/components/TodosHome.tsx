import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertCircle, ListChecks, Loader2 } from 'lucide-react';
import { useTodoBuckets } from '../hooks/useTodos';
import { useProjects } from '../hooks/useProjects';
import { useCreateTodo } from '../hooks/useCreateTodo';
import { useUpdateTodo } from '../hooks/useUpdateTodo';
import {
  SYNTHETIC_TODO_GROCERIES_ID,
  useSyntheticTodos,
} from '../hooks/useSyntheticTodos';
import {
  MAIN_PROJECT_ID,
  type ProjectScope,
  type Todo,
  type TodoStatus,
} from '../types';
import { TodoProgressBar } from './TodoProgressBar';
import { AddTodoInput } from './AddTodoInput';
import { TodoRow } from './TodoRow';
import { CollapsibleSection } from './CollapsibleSection';
import { ResetProgressButton } from './ResetProgressButton';
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
  const update = useUpdateTodo();

  const isMain = scope === MAIN_PROJECT_ID;
  // Completion counts share the progress bar's basis: cancelled items are
  // excluded, so `done / total` matches the green percentage exactly.
  const nonCancelled = scoped.filter((t) => t.status !== 'cancelled');
  const doneCount = nonCancelled.filter((t) => t.status === 'completed').length;
  const totalCount = nonCancelled.length;
  const projectsById = new Map(
    (projectsQuery.data ?? []).map((p) => [p.id, p]),
  );

  const handleAdd = async (title: string) => {
    await create.mutateAsync({
      title,
      status: 'pending',
      ...(isMain ? {} : { project: `projects/${scope}` }),
    });
  };

  const handleSetStatus = (id: string, status: TodoStatus) => {
    update.mutate({ id, data: { status } });
  };

  const handleTogglePin = (id: string, inMain: boolean) => {
    update.mutate({ id, data: { in_main: inMain } });
  };

  const originLabelFor = (todo: Todo): string | undefined => {
    if (!isMain) return undefined;
    if (!todo.project) return undefined;
    const id = todo.project.replace(/^projects\//, '');
    return projectsById.get(id)?.name;
  };

  const togglePinHandlerFor = (todo: Todo) => {
    if (isMain) {
      // On main: only show the pin control for todos that originate in a
      // project (so users can unpin them). Native main-only todos shouldn't
      // expose the action.
      if (!todo.project) return undefined;
      return (inMain: boolean) => handleTogglePin(todo.id, inMain);
    }
    return (inMain: boolean) => handleTogglePin(todo.id, inMain);
  };

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

      <AddTodoInput onSubmit={handleAdd} disabled={create.isPending} />

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-accent-terracotta animate-spin" />
        </div>
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
            {buckets.active.length === 0 &&
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
                    onSetStatus={(status) => handleSetStatus(todo.id, status)}
                    disabled={update.isPending}
                    onTogglePin={togglePinHandlerFor(todo)}
                    pinnedFromLabel={originLabelFor(todo)}
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
                  onSetStatus={(status) => handleSetStatus(todo.id, status)}
                  disabled={update.isPending}
                  onTogglePin={togglePinHandlerFor(todo)}
                  pinnedFromLabel={originLabelFor(todo)}
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
                  onSetStatus={(status) => handleSetStatus(todo.id, status)}
                  disabled={update.isPending}
                  onTogglePin={togglePinHandlerFor(todo)}
                  pinnedFromLabel={originLabelFor(todo)}
                />
              ))}
            </CollapsibleSection>
          )}
        </>
      )}

      <div className="flex justify-center pt-2">
        <ResetProgressButton disabled={isLoading} scope={scope} />
      </div>
    </div>
  );
}
