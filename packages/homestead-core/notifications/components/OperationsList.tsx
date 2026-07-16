/**
 * Operations tab in the notifications app — lists AEP-151 long-running
 * operations, polling while any are still in flight.
 */

import { CheckCircle2, XCircle } from 'lucide-react';
import { Card } from '@rambleraptor/homestead-core/shared/components/Card';
import { Spinner } from '@rambleraptor/homestead-core/shared/components/Spinner';
import { useOperations } from '../hooks/useOperations';
import type { Operation } from '../types';

function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
}

function OperationStatusIcon({ operation }: { operation: Operation }) {
  if (!operation.done) return <Spinner size="sm" />;
  if (operation.status === 'failed' || operation.error) {
    return <XCircle className="w-5 h-5 text-red-500" />;
  }
  return <CheckCircle2 className="w-5 h-5 text-green-500" />;
}

function statusLabel(operation: Operation): string {
  if (!operation.done) return 'Running…';
  if (operation.status === 'failed' || operation.error) return 'Failed';
  return 'Completed';
}

function OperationRow({ operation }: { operation: Operation }) {
  const errorMessage =
    typeof operation.error?.message === 'string' ? operation.error.message : null;

  return (
    <Card>
      <div
        className="flex items-start gap-3"
        data-testid={`operation-${operation.id}`}
      >
        <div className="mt-0.5">
          <OperationStatusIcon operation={operation} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">
            {operation.title || operation.method || 'Operation'}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {statusLabel(operation)}
            {operation.method ? ` · ${operation.method}` : ''}
          </p>
          {errorMessage && (
            <p className="text-sm text-red-600 mt-1 break-words">{errorMessage}</p>
          )}
          <p className="text-xs text-gray-500 mt-2">
            {formatDate(operation.updated || operation.created)}
          </p>
        </div>
      </div>
    </Card>
  );
}

export function OperationsList() {
  const { data: operations, isLoading } = useOperations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!operations || operations.length === 0) {
    return (
      <Card>
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No operations yet</p>
          <p className="text-sm text-gray-500 mt-2">
            Long-running tasks will appear here while they run.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="operations-list">
      {operations.map((operation) => (
        <OperationRow key={operation.id} operation={operation} />
      ))}
    </div>
  );
}
