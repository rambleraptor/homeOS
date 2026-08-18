/**
 * How sure the model was about the type it matched, as a ring rather than a
 * number in a sentence.
 *
 * Confidence is the one field on the page that says "you might want to check
 * this" — but `78% confidence` set in muted grey next to everything else reads
 * as trivia, and a reader has to know what a good number looks like before it
 * tells them anything. A ring that is nearly closed and green, or visibly short
 * and amber, is legible before it's read.
 *
 * The arc draws from empty to its value on mount, which is also what makes a
 * re-read visible: the ring refills at its new length.
 */

import { useEffect, useState } from 'react';

interface ConfidenceMeterProps {
  /** The model's confidence, 0-1. Values outside the range are clamped. */
  value: number;
}

/**
 * Bands, not a gradient: the point is to answer "is this worth checking?", and
 * a continuous hue ramp makes 0.72 and 0.78 look meaningfully different when
 * they aren't. Thresholds are deliberately generous — classification is usually
 * confident, so amber should mean something.
 */
function band(value: number): { stroke: string; text: string; label: string } {
  if (value >= 0.85) {
    return { stroke: 'stroke-emerald-500', text: 'text-emerald-700', label: 'high' };
  }
  if (value >= 0.6) {
    return { stroke: 'stroke-amber-500', text: 'text-amber-700', label: 'moderate' };
  }
  return { stroke: 'stroke-rose-500', text: 'text-rose-700', label: 'low' };
}

export function ConfidenceMeter({ value }: ConfidenceMeterProps) {
  const clamped = Math.min(1, Math.max(0, value));
  const percent = Math.round(clamped * 100);
  const tone = band(clamped);

  // Draw on the next frame rather than on mount, so the browser has an empty
  // ring to transition *from*. Rendered at its final length immediately, the
  // transition has nothing to interpolate and the arc just appears.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <span
      className="inline-flex items-center gap-2"
      title={`The model was ${percent}% confident in this document type (${tone.label})`}
      data-testid="document-confidence"
      data-confidence-band={tone.label}
    >
      <span className="relative inline-flex h-9 w-9 items-center justify-center">
        <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
            className="stroke-gray-200"
          />
          {/* `pathLength={1}` renormalises the circle so the dash maths is just
              the fraction — the same trick the checkbox tick uses. */}
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={drawn ? 1 - clamped : 1}
            className={`${tone.stroke} transition-[stroke-dashoffset] duration-(--duration-deliberate) ease-out-soft`}
          />
        </svg>
        <span
          className={`absolute text-[10px] font-semibold tabular-nums ${tone.text}`}
        >
          {percent}
        </span>
      </span>
      <span className="text-xs text-text-muted">confidence</span>
    </span>
  );
}
