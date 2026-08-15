/**
 * Spinner
 *
 * The one busy indicator for the whole app. Before this existed in usable
 * form, ~50 call sites hand-rolled `<Loader2 className="… animate-spin" />`
 * (14 distinct class strings) or a bordered-`<div>` ring, and the three
 * greys / two blues drifted apart. Size and colour are now props, so a call
 * site picks intent rather than re-deriving Tailwind classes.
 *
 * Tone maps to the design tokens in `tailwind.config.js`:
 *   - `brand`   — page- and section-level loads (the terracotta accent)
 *   - `muted`   — secondary chrome: widgets, inline hints
 *   - `subtle`  — de-emphasised placeholders (thumbnails, previews)
 *   - `inverse` — on a saturated background (a primary button)
 *   - `inherit` — takes the parent's `currentColor`; the right pick inside a
 *                 button or badge whose text colour already varies by state
 *
 * @example
 *   <Spinner size="lg" />                     // page load
 *   <Spinner size="sm" tone="inherit" />      // inside a submit button
 *   <LoadingBlock />                          // centred page-level load
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerTone = 'brand' | 'muted' | 'subtle' | 'inverse' | 'inherit';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

const TONE_CLASSES: Record<SpinnerTone, string> = {
  brand: 'text-accent-terracotta',
  muted: 'text-text-muted',
  subtle: 'text-gray-400',
  inverse: 'text-white',
  // No colour class — inherits `currentColor` from the parent.
  inherit: '',
};

export interface SpinnerProps {
  /** Diameter. Defaults to `md` (24px). */
  size?: SpinnerSize;
  /** Colour intent. Defaults to `brand`. */
  tone?: SpinnerTone;
  /**
   * Announced by screen readers via `role="status"`. Pass `null` when
   * adjacent visible text already says the page is busy (e.g. a button
   * reading "Saving…"), so the state isn't announced twice — the spinner is
   * then marked `aria-hidden`.
   */
  label?: string | null;
  /** Merged into the icon's classes; wins over `size`/`tone` via tailwind-merge. */
  className?: string;
  'data-testid'?: string;
}

export function Spinner({
  size = 'md',
  tone = 'brand',
  label = 'Loading',
  className,
  'data-testid': testId,
}: SpinnerProps) {
  const decorative = label === null;

  return (
    <Loader2
      className={cn(
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        'animate-spin',
        className,
      )}
      role={decorative ? undefined : 'status'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      data-testid={testId}
    />
  );
}

export interface LoadingBlockProps extends SpinnerProps {
  /** Merged into the centring wrapper rather than the icon. */
  className?: string;
}

/**
 * A `Spinner` centred in its own block — the shape almost every "still
 * loading" branch wants. Override the default vertical padding by passing a
 * height or padding class (`className="h-64"`).
 */
export function LoadingBlock({
  size = 'lg',
  tone = 'brand',
  label = 'Loading',
  className,
  'data-testid': testId,
}: LoadingBlockProps) {
  return (
    <div
      className={cn('flex items-center justify-center py-12', className)}
      data-testid={testId}
    >
      <Spinner size={size} tone={tone} label={label} />
    </div>
  );
}
