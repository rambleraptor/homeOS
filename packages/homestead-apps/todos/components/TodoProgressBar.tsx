import type { TodoProgress } from '../types';

interface TodoProgressBarProps {
  progress: TodoProgress;
}

/**
 * Single-segment completion bar: green for completed. Track structure mirrors
 * `CoverageProgressBar` for visual consistency.
 */
export function TodoProgressBar({ progress }: TodoProgressBarProps) {
  const greenPct = Math.max(0, Math.min(100, progress.green));

  return (
    <div
      className="flex bg-gray-100 rounded-full h-3 overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(greenPct)}
      data-testid="todos-progress"
    >
      <div
        className="h-full bg-green-500 transition-all"
        style={{ width: `${greenPct}%` }}
        data-testid="todos-progress-green"
      />
    </div>
  );
}
