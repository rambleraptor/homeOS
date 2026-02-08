/**
 * Actions Page
 *
 * Main page for viewing and managing automated actions
 */

'use client';

import { useState } from 'react';
import { Play, Plus, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { useActions } from '../hooks/useActions';
import { useRunAction } from '../hooks/useRunAction';
import { RunStatusModal } from './RunStatusModal';
import type { Action } from '../types';

export function ActionsPage() {
  const { data: actions, isLoading, isError } = useActions();
  const runActionMutation = useRunAction();
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const handleRunAction = async (action: Action) => {
    try {
      const result = await runActionMutation.mutateAsync(action.id);
      setActiveRunId(result.runId);
    } catch (error) {
      console.error('Failed to run action:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">Failed to load actions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Actions</h1>
          <p className="text-muted-foreground">Manage automated scripts and actions</p>
        </div>
        <Button onClick={() => console.log('TODO: Create action')}>
          <Plus className="mr-2 h-4 w-4" />
          New Action
        </Button>
      </div>

      {!actions || actions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <h3 className="mb-2 text-lg font-medium">No actions yet</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Get started by creating your first automated action.
          </p>
          <Button onClick={() => console.log('TODO: Create action')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Action
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {actions.map((action) => (
            <div
              key={action.id}
              className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold">{action.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{action.description}</p>
                  {action.last_run_at && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Last run: {new Date(action.last_run_at).toLocaleString()}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRunAction(action)}
                  disabled={runActionMutation.isPending}
                  className="ml-2"
                >
                  {runActionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeRunId && (
        <RunStatusModal
          runId={activeRunId}
          onClose={() => setActiveRunId(null)}
        />
      )}
    </div>
  );
}
