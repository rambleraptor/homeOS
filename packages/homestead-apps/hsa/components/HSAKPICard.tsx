/**
 * HSA KPI Card Component
 *
 * Hero metric: the total liquidatable tax-free cash. On-brand navy surface
 * with a fluid headline that scales down on narrow screens instead of
 * overflowing.
 */

import { PiggyBank, Sparkles } from 'lucide-react';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';

interface HSAKPICardProps {
  totalStored: number;
  storedReceipts: number;
}

export function HSAKPICard({ totalStored, storedReceipts }: HSAKPICardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy to-brand-slate p-6 sm:p-8 shadow-lg">
      {/* Soft decorative glow, purely cosmetic. */}
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-2xl"
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-medium text-emerald-200">
            <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
            Tax-free
          </span>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-white/60">
            Liquidatable Cash
          </p>
          <p className="mt-1 font-display text-4xl sm:text-5xl font-bold tracking-tight text-white break-words tabular-nums">
            {formatCurrency(totalStored)}
          </p>
          <p className="mt-2 text-sm text-white/70">
            Available across {storedReceipts} stored{' '}
            {storedReceipts === 1 ? 'receipt' : 'receipts'}
          </p>
        </div>
        <div
          className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur"
          aria-hidden="true"
        >
          <PiggyBank className="h-7 w-7 text-emerald-300" />
        </div>
      </div>
      <p className="relative mt-4 max-w-xl text-xs leading-relaxed text-white/50">
        The total you can withdraw from your HSA tax-free, based on the
        unreimbursed medical expenses you&rsquo;ve stored.
      </p>
    </div>
  );
}
