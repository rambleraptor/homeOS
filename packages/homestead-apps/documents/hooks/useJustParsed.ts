/**
 * Detect the moment a document finishes classifying.
 *
 * An upload lands as `pending` and the list polls until the background classify
 * flips it to `parsed` — the point where an anonymous PDF becomes "W-2 (2024) —
 * Acme Corp" with its fields filled in. Without a signal that swap is silent:
 * one poll later the row simply looks different, and nobody sees the thing the
 * app just did.
 *
 * This returns true for a short window after that transition so a component can
 * mark the change, then false again so a re-render (or a route change) doesn't
 * replay it.
 *
 * Only a real transition counts. The previous status seeds to whatever the
 * document already was, so mounting a long-since-parsed document — opening its
 * detail page, scrolling the list, a remount from a filter change — reveals
 * nothing. It fires on the change, not on the state.
 */

import { useEffect, useRef, useState } from 'react';
import type { ParseStatus } from '../resources';

/** How long the reveal stays on. Comfortably longer than the animations it gates. */
const HOLD_MS = 1200;

export function useJustParsed(status: ParseStatus): boolean {
  const previous = useRef(status);
  const [justParsed, setJustParsed] = useState(false);

  useEffect(() => {
    const wasReading = previous.current === 'pending';
    previous.current = status;
    if (!wasReading || status !== 'parsed') return;

    setJustParsed(true);
    const timer = setTimeout(() => setJustParsed(false), HOLD_MS);
    return () => clearTimeout(timer);
  }, [status]);

  return justParsed;
}
