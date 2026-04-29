'use client';

import React from 'react';
import { toast as sonnerToast } from 'sonner';
import { AlertCircle, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export function normalizeErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error instanceof Error && error.message) return error.message;
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string' &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }
  return 'Something went wrong';
}

interface ErrorToastProps {
  toastId: string | number;
  title: string;
  description?: string;
}

export function ErrorToast({ toastId, title, description }: ErrorToastProps) {
  return (
    <div
      role="alert"
      data-testid="error-toast"
      className={cn(
        'flex w-full items-start gap-3 rounded-md border border-gray-200',
        'border-l-4 border-l-accent-terracotta bg-white p-4 shadow-lg'
      )}
    >
      <AlertCircle
        className="mt-0.5 h-5 w-5 shrink-0 text-accent-terracotta"
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-brand-navy">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-text-muted break-words">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => sonnerToast.dismiss(toastId)}
        aria-label="Dismiss"
        data-testid="error-toast-dismiss"
        className="text-text-muted hover:text-brand-navy"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export interface ShowErrorOptions {
  title?: string;
  description?: string;
  duration?: number;
}

export function showError(
  error: unknown,
  options?: ShowErrorOptions
): string | number {
  const title = options?.title ?? normalizeErrorMessage(error);
  return sonnerToast.custom(
    (id) => (
      <ErrorToast
        toastId={id}
        title={title}
        description={options?.description}
      />
    ),
    { duration: options?.duration ?? 6000 }
  );
}
