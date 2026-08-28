/**
 * A number that acknowledges its own changes.
 *
 * Counts in this app update silently: a folder's tally, a "3 still reading"
 * summary. The row that caused the change is often animating at the same
 * moment, and the digit that should tie the two together just swaps between
 * frames. This replays a short lift on the value whenever it changes, so the
 * count reads as a consequence of what just happened rather than as a number
 * that was always that.
 *
 * The animation is re-triggered by keying the inner span on the value: React
 * remounts it, the browser starts the animation from scratch, and there is no
 * timer to clean up or state to fall out of sync.
 *
 * The first render never animates. A page load sets every count on the screen
 * at once, and ticking all of them would say "these all just changed" when
 * nothing did.
 */

import { useRef } from 'react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';

interface TickingCountProps {
  value: number;
  className?: string;
  'data-testid'?: string;
}

export function TickingCount({
  value,
  className,
  'data-testid': testId,
}: TickingCountProps) {
  const previous = useRef(value);
  // Which value the tick belongs to, rather than a bare "did it change" flag.
  // Re-rendering with an unchanged value (a parent's state moving, a poll that
  // returned the same list) must not strip the class off an animation that is
  // still playing, and must not replay one that has finished.
  const tickingFor = useRef<number | null>(null);

  if (previous.current !== value) {
    tickingFor.current = value;
    previous.current = value;
  }

  return (
    <span
      key={value}
      className={cn(
        'inline-block tabular-nums',
        tickingFor.current === value && 'animate-count-tick',
        className,
      )}
      data-testid={testId}
      data-ticking={tickingFor.current === value || undefined}
    >
      {value}
    </span>
  );
}
