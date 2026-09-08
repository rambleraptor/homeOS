/**
 * Celebration Toast
 *
 * The card for a small win that has just happened — a store's list fully
 * checked off, say. Rendered *inside* a sonner toast by
 * `useToast().celebrate`, so it arrives and leaves the way every other toast
 * does (from the bottom, with sonner's own enter/exit) instead of sitting over
 * the middle of whatever the user is doing. This component is just the box:
 * sonner leaves custom JSX unstyled, so the border, surface, and shadow are
 * all ours.
 *
 * The pop-in (`celebration-pop`) is a short overshoot that settles at the
 * card's resting state, so the global reduced-motion guard can collapse it to
 * an instant without ever leaving the card invisible.
 */

import { PartyPopper } from 'lucide-react';

export interface CelebrationToastProps {
  title: string;
  description?: string;
}

export function CelebrationToast({ title, description }: CelebrationToastProps) {
  return (
    <div
      className="flex w-full items-center gap-3 rounded-2xl border border-gray-200 bg-surface-white px-6 py-4 shadow-lg animate-celebration-pop"
      data-testid="celebration-toast"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100">
        <PartyPopper className="h-5 w-5 text-green-600" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold text-brand-navy">{title}</p>
        {description && <p className="font-body text-sm text-text-muted">{description}</p>}
      </div>
    </div>
  );
}
