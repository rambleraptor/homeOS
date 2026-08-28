/**
 * Whether the reader has asked for reduced motion.
 *
 * The global guard in `globals.css` already collapses every CSS animation to
 * effectively instant, so nothing that is purely declarative needs this hook.
 * It exists for the cases where JavaScript *waits* on an animation — a row that
 * plays an exit before its delete is sent, say. There the CSS is already
 * instant but the `setTimeout` still runs its full length, which turns a
 * courtesy into a delay for exactly the people who opted out of the animation.
 *
 * Reads the media query live rather than once at mount: the setting can change
 * mid-session (macOS and Windows both apply it immediately), and a component
 * that sampled it at startup would keep animating for the rest of the session.
 */

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/** SSR and old jsdom have no `matchMedia`; assume motion is fine. */
function current(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(QUERY).matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(current);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(QUERY);
    const onChange = () => setReduced(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
