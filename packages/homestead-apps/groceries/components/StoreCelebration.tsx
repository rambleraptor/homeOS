/**
 * Store Celebration Overlay
 *
 * A short confetti burst plus a "store complete" card, shown when every item
 * for a store has just been checked off. Purely presentational and
 * `pointer-events-none` throughout — shopping can continue underneath it, and
 * `useStoreCelebration` unmounts it on its own.
 *
 * Under reduced motion the confetti is skipped and the card renders static:
 * the global CSS guard would collapse these `both`-fill animations to their
 * final (invisible) frame, so gating in JS is what keeps the message readable
 * for exactly the people who opted out of the motion.
 */

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { PartyPopper } from 'lucide-react';
import { useReducedMotion } from '@rambleraptor/homestead-core/shared/hooks/useReducedMotion';

interface StoreCelebrationProps {
  storeName: string;
}

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

export function StoreCelebration({ storeName }: StoreCelebrationProps) {
  const reducedMotion = useReducedMotion();
  const pieces = useMemo(() => (reducedMotion ? [] : makeConfetti()), [reducedMotion]);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
      data-testid="store-celebration"
    >
      <div aria-hidden="true">
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

      <div className="absolute inset-0 flex items-center justify-center p-6">
        <div
          role="status"
          className={`flex items-center gap-3 rounded-2xl border border-gray-200 bg-surface-white px-6 py-4 shadow-lg ${
            reducedMotion ? '' : 'animate-celebration-card'
          }`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
            <PartyPopper className="h-5 w-5 text-green-600" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold text-brand-navy">
              {storeName} complete!
            </p>
            <p className="font-body text-sm text-text-muted">
              Every item checked off — nice work!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
