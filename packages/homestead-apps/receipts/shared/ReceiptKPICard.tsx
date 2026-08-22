/**
 * Receipt KPI Card
 *
 * The hero metric each receipts tab opens with: the medical tab's liquidatable
 * tax-free cash, the charitable tab's deductible total for a year. On-brand
 * navy surface with a fluid headline that scales down on narrow screens instead
 * of overflowing.
 */

import type { LucideIcon } from 'lucide-react';

interface ReceiptKPICardProps {
  /** Small pill above the metric — the one-word claim about the money. */
  badge: { icon: LucideIcon; label: string };
  /** Uppercase kicker naming the metric. */
  label: string;
  /** The metric itself, already formatted. */
  value: string;
  /** One line under the metric saying what it's drawn from. */
  caption: string;
  /** The fine print: what the number means, or what would change it. */
  footnote: string;
  /** Large decorative icon, hidden on phones. */
  icon: LucideIcon;
  'data-testid'?: string;
}

export function ReceiptKPICard({
  badge,
  label,
  value,
  caption,
  footnote,
  icon: Icon,
  'data-testid': testId,
}: ReceiptKPICardProps) {
  const BadgeIcon = badge.icon;
  return (
    <div
      data-testid={testId}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy to-brand-slate p-6 sm:p-8 shadow-lg"
    >
      {/* Soft decorative glow, purely cosmetic. */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-200">
            <BadgeIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {badge.label}
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/60">
            {label}
          </p>
          <p className="mt-1 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white break-words tabular-nums">
            {value}
          </p>
          <p className="mt-2 text-sm text-white/70">{caption}</p>
        </div>
        <div
          className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur"
          aria-hidden="true"
        >
          <Icon className="h-7 w-7 text-emerald-300" />
        </div>
      </div>
      <p className="relative mt-4 max-w-xl text-xs leading-relaxed text-white/50">
        {footnote}
      </p>
    </div>
  );
}
