/**
 * Action Detail Page
 *
 * Shows action settings, run button, and run history
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
} from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { Card } from '@/shared/components/Card';
import { useToast } from '@/shared/components/ToastProvider';
import { useAction } from '../hooks/useAction';
import { useActionRuns } from '../hooks/useActionRuns';
import { useUpdateAction } from '../hooks/useUpdateAction';
import { useRunAction } from '../hooks/useRunAction';
import { RunStatusModal } from './RunStatusModal';
import type { ActionRunStatus } from '../types';

const STATUS_ICONS: Record<ActionRunStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-muted-foreground" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  awaiting_input: <Clock className="h-4 w-4 text-yellow-500" />,
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  error: <XCircle className="h-4 w-4 text-red-500" />,
};

const STATUS_LABELS: Record<ActionRunStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  awaiting_input: 'Awaiting Input',
  success: 'Success',
  error: 'Error',
};

interface ActionDetailPageProps {
  actionId: string;
}

export function ActionDetailPage({ actionId }: ActionDetailPageProps) {
  const { data: action, isLoading, isError } = useAction(actionId);
  const { data: runs } = useActionRuns(actionId);
  const updateAction = useUpdateAction();
  const runActionMutation = useRunAction();
  const { success, error: showError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [initialized, setInitialized] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  // Initialize form from action parameters once loaded
  if (action && !initialized) {
    setEmail((action.parameters?.email as string) || '');
    setPassword((action.parameters?.password as string) || '');
    setInitialized(true);
  }

  const handleSave = async () => {
    try {
      await updateAction.mutateAsync({
        id: actionId,
        parameters: { email, password },
      });
      success('Settings saved');
    } catch {
      showError('Failed to save settings');
    }
  };

  const handleRun = async () => {
    try {
      const result = await runActionMutation.mutateAsync(actionId);
      setActiveRunId(result.runId);
    } catch {
      showError('Failed to start action');
    }
  };

  const hasCredentials = email.trim() !== '' && password.trim() !== '';

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !action) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <p className="mt-2 text-sm text-muted-foreground">Failed to load action</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/developer"
          className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Actions
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{action.name}</h1>
            <p className="text-muted-foreground">{action.description}</p>
          </div>
          <Button
            onClick={handleRun}
            disabled={!hasCredentials || runActionMutation.isPending}
          >
            {runActionMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Run Now
          </Button>
        </div>
      </div>

      {/* Settings */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Settings</h2>
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your-safeway-email@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your Safeway password"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={updateAction.isPending}
            >
              {updateAction.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </Card>

      {/* Run History */}
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Run History</h2>
        {!runs || runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runs yet</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setActiveRunId(run.id)}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  {STATUS_ICONS[run.status]}
                  <div>
                    <span className="text-sm font-medium">
                      {STATUS_LABELS[run.status]}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {new Date(run.created).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  {run.duration_ms != null && (
                    <span>{(run.duration_ms / 1000).toFixed(1)}s</span>
                  )}
                  {run.result?.message != null && (
                    <p className="text-xs">{String(run.result.message)}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {activeRunId && (
        <RunStatusModal
          runId={activeRunId}
          onClose={() => setActiveRunId(null)}
        />
      )}
    </div>
  );
}
