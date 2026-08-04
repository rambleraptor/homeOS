import { PartyPopper } from 'lucide-react';
import type { TodoProgress } from '../types';

interface TodoProgressBarProps {
  progress: TodoProgress;
  /** Completed (non-cancelled) count — the numerator of the summary. */
  done: number;
  /** Total non-cancelled count — the denominator of the summary. */
  total: number;
}

/**
 * Completion summary card: a headline count ("3 of 8 done") with the
 * percentage, a single-segment green bar, and a celebratory all-done state.
 * The bar's structure mirrors `CoverageProgressBar` for visual consistency.
 */
export function TodoProgressBar({ progress, done, total }: TodoProgressBarProps) {
  const greenPct = Math.max(0, Math.min(100, progress.green));
  const allDone = total > 0 && done === total;
  const isEmpty = total === 0;

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-surface-white p-4 shadow-sm"
      data-testid="todos-progress-card"
    >
      <div className="mb-2 flex items-center justify-between">
        {isEmpty ? (
          <span className="font-body text-sm text-text-muted">
            Nothing to track yet
          </span>
        ) : allDone ? (
          <span className="flex items-center gap-1.5 font-display font-semibold text-green-600">
            <PartyPopper className="h-4 w-4" />
            All done — nice work!
          </span>
        ) : (
          <span className="font-body text-sm text-text-muted">
            <span className="font-display text-base font-semibold text-brand-navy">
              {done}
            </span>{' '}
            of{' '}
            <span className="font-display text-base font-semibold text-brand-navy">
              {total}
            </span>{' '}
            done
          </span>
        )}
        {!isEmpty && (
          <span className="font-display text-lg font-bold text-brand-navy tabular-nums">
            {Math.round(greenPct)}%
          </span>
        )}
      </div>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-gray-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(greenPct)}
        data-testid="todos-progress"
      >
        <div
          className="h-full rounded-full bg-green-500 transition-all duration-500 ease-out"
          style={{ width: `${greenPct}%` }}
          data-testid="todos-progress-green"
        />
      </div>
    </div>
  );
}
