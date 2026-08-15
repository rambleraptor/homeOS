/**
 * EmptyState
 *
 * The "nothing here yet" panel. Every list previously hand-rolled its own —
 * 22 sites across the apps, spread over four different greys, three icon
 * treatments, and both `<p>`-only and bordered-card chrome. This centralises
 * the layout so a call site supplies meaning (icon, title, what to do next)
 * and nothing else.
 *
 * Two variants:
 *   - `panel` (default) — a dashed-border card. Use when the empty state IS
 *     the section's content.
 *   - `plain` — the same stack with no border or background. Use when it
 *     already sits inside a `Card`, panel, or list.
 *
 * @example
 *   <EmptyState
 *     icon={ChefHat}
 *     title="No recipes yet"
 *     description="Add your first one to get started."
 *   />
 */

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@rambleraptor/homestead-core/shared/lib/utils';

export type EmptyStateVariant = 'panel' | 'plain';

const VARIANT_CLASSES: Record<EmptyStateVariant, string> = {
  panel:
    'rounded-2xl border border-dashed border-gray-200 bg-surface-white py-14',
  plain: 'py-8',
};

export interface EmptyStateProps {
  /** Lucide icon shown in the chip above the title. Omit for a text-only state. */
  icon?: LucideIcon;
  /** The headline — say what's missing ("No recipes yet"), not what went wrong. */
  title: ReactNode;
  /**
   * Optional second line explaining how to fill the gap. Takes nodes, so a
   * call site can link elsewhere ("upload one in Documents").
   */
  description?: ReactNode;
  /** Optional call to action (a button or link) rendered below the text. */
  action?: ReactNode;
  /** Chrome around the stack. Defaults to `panel`. */
  variant?: EmptyStateVariant;
  className?: string;
  'data-testid'?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'panel',
  className,
  'data-testid': testId,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 text-center',
        VARIANT_CLASSES[variant],
        className,
      )}
      data-testid={testId}
    >
      {Icon && (
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-pearl text-text-muted"
          aria-hidden="true"
        >
          <Icon className="h-6 w-6" />
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-brand-navy">{title}</p>
        {description && (
          <p className="mt-1 text-sm text-text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
