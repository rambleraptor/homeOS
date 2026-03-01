/**
 * Run Status Modal
 *
 * Displays real-time status of an action run with logs and input prompts
 */

'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/shared/components/Button';
import { Input } from '@/shared/components/Input';
import { Modal } from '@/shared/components/Modal';
import { useActionRun } from '../hooks/useActionRun';
import { useProvideInput } from '../hooks/useProvideInput';
import type { ActionRunStatus } from '../types';

interface RunStatusModalProps {
  runId: string;
  onClose: () => void;
}

const STATUS_ICONS: Record<ActionRunStatus, React.ReactNode> = {
  pending: <Clock className="h-5 w-5 text-muted-foreground" />,
  running: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  awaiting_input: <Clock className="h-5 w-5 text-yellow-500" />,
  success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
  error: <XCircle className="h-5 w-5 text-red-500" />,
};

const STATUS_LABELS: Record<ActionRunStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  awaiting_input: 'Awaiting Input',
  success: 'Success',
  error: 'Error',
};

export function RunStatusModal({ runId, onClose }: RunStatusModalProps) {
  const { data: run } = useActionRun(runId);
  const provideInputMutation = useProvideInput();
  const [inputValue, setInputValue] = useState('');

  const handleProvideInput = async () => {
    if (!run?.input_request) return;

    try {
      await provideInputMutation.mutateAsync({
        runId,
        input: { [run.input_request.field_name]: inputValue },
      });
      setInputValue('');
    } catch (error) {
      console.error('Failed to provide input:', error);
    }
  };

  if (!run) {
    return (
      <Modal isOpen onClose={onClose} title="Action Run">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Modal>
    );
  }

  const isDone = run.status === 'success' || run.status === 'error';

  return (
    <Modal isOpen onClose={onClose} title={STATUS_LABELS[run.status]}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STATUS_ICONS[run.status]}
            <h2 className="text-lg font-semibold">
              {STATUS_LABELS[run.status]}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Duration */}
        {run.duration_ms && (
          <p className="text-sm text-muted-foreground">
            Duration: {(run.duration_ms / 1000).toFixed(2)}s
          </p>
        )}

        {/* Error message */}
        {run.error && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {run.error}
          </div>
        )}

        {/* Input prompt */}
        {run.status === 'awaiting_input' && run.input_request && (
          <div className="space-y-3 rounded-lg border bg-yellow-50 p-4 dark:bg-yellow-950/20">
            <p className="font-medium">{run.input_request.prompt}</p>
            <div className="flex gap-2">
              <Input
                type={run.input_request.field_type}
                placeholder={run.input_request.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && inputValue) {
                    handleProvideInput();
                  }
                }}
                autoFocus
              />
              <Button
                onClick={handleProvideInput}
                disabled={!inputValue || provideInputMutation.isPending}
              >
                {provideInputMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Submit'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Result */}
        {run.result && (
          <div className="rounded-lg bg-green-50 p-3 dark:bg-green-950/20">
            <p className="text-sm font-medium text-green-900 dark:text-green-100">
              {String(run.result.message || 'Action completed successfully')}
            </p>
            {run.result.clipped !== undefined && (
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                Clipped {String(run.result.clipped)} of {String(run.result.total)} coupons
              </p>
            )}
          </div>
        )}

        {/* Logs */}
        {run.logs && run.logs.length > 0 && (
          <div className="space-y-2">
            <h3 className="font-medium">Logs</h3>
            <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {run.logs.map((log, index) => (
                <div
                  key={index}
                  className={`${
                    log.level === 'error'
                      ? 'text-red-600 dark:text-red-400'
                      : log.level === 'warn'
                      ? 'text-yellow-600 dark:text-yellow-400'
                      : 'text-foreground'
                  }`}
                >
                  <span className="text-muted-foreground">
                    [{new Date(log.timestamp).toLocaleTimeString()}]
                  </span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Close button */}
        {isDone && (
          <div className="flex justify-end">
            <Button onClick={onClose}>Close</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
