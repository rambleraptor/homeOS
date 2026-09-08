/**
 * Store Confetti
 *
 * A short confetti burst over the whole viewport, shown when every item for a
 * store has just been checked off. It is only the fanfare: the message itself
 * is the shared celebration toast (`useToast().celebrate`), which lands at the
 * bottom of the screen where toasts belong rather than over the list. Purely
 * presentational and `pointer-events-none` throughout — shopping can continue
 * underneath it, and `useStoreCelebration` unmounts it on its own.
 *
 * Under reduced motion nothing renders: the pieces are pure motion (the global
 * CSS guard would collapse their `both`-fill animation to its final, invisible
 * frame anyway), and the toast already carries the message.
 */

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useReducedMotion } from '@rambleraptor/homestead-core/shared/hooks/useReducedMotion';

/** Brand palette plus a couple of cheerful accents — confetti earns them. */
const CONFETTI_COLORS = ['#E07A5F', '#1A2B4C', '#22c55e', '#fbbf24', '#38bdf8'];

const PIECE_COUNT = 36;

interface ConfettiPiece {
  left: number;
  size: number;
  round: boolean;
  color: string;
  delayMs: number;
  durationMs: number;
  driftPx: number;
  spinDeg: number;
}

/**
 * Delay + duration are capped so every piece has landed before the overlay
 * unmounts at `STORE_CELEBRATION_MS` (2800ms): at most 400 + 2300 = 2700ms.
 */
function makeConfetti(): ConfettiPiece[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    left: Math.random() * 100,
    size: 6 + Math.random() * 6,
    round: Math.random() < 0.3,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delayMs: Math.random() * 400,
    durationMs: 1600 + Math.random() * 700,
    driftPx: (Math.random() - 0.5) * 240,
    spinDeg: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 540),
  }));
}

export function StoreConfetti() {
  const reducedMotion = useReducedMotion();
  const pieces = useMemo(() => (reducedMotion ? [] : makeConfetti()), [reducedMotion]);

  if (pieces.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      data-testid="store-confetti"
      aria-hidden="true"
    >
      {pieces.map((piece, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti-fall"
          style={
            {
              left: `${piece.left}%`,
              width: `${piece.size}px`,
              height: `${piece.round ? piece.size : piece.size * 0.5}px`,
              borderRadius: piece.round ? '9999px' : '2px',
              backgroundColor: piece.color,
              animationDelay: `${piece.delayMs}ms`,
              animationDuration: `${piece.durationMs}ms`,
              '--confetti-drift': `${piece.driftPx}px`,
              '--confetti-spin': `${piece.spinDeg}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
