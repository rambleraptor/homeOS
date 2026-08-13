/**
 * HSA Empty State
 *
 * First-run / no-receipts onboarding. Explains the two ways to capture a
 * receipt (by hand here, or automatically via the Documents app) and offers
 * the primary call to action. Contains the "No receipts found" copy so the
 * page has a single, friendly empty state.
 */

import { PlusCircle, ScanLine, Receipt } from 'lucide-react';
import { Button } from '@rambleraptor/homestead-core/shared/components/Button';

interface HSAEmptyStateProps {
  onAdd: () => void;
}

export function HSAEmptyState({ onAdd }: HSAEmptyStateProps) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-surface-white p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-terracotta/10">
        <Receipt className="h-7 w-7 text-accent-terracotta" aria-hidden="true" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-brand-navy">
        No receipts found
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-text-muted">
        Track out-of-pocket medical expenses so you can reimburse them from your
        HSA tax-free &mdash; later, whenever you choose.
      </p>

      <div className="mx-auto mt-6 grid max-w-lg gap-3 text-left sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-bg-pearl p-4">
          <PlusCircle
            className="h-5 w-5 text-accent-terracotta"
            aria-hidden="true"
          />
          <p className="mt-2 text-sm font-semibold text-brand-navy">
            Add one by hand
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Key in the details and attach the receipt photo or PDF.
          </p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-bg-pearl p-4">
          <ScanLine className="h-5 w-5 text-brand-navy" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-brand-navy">
            Upload in Documents
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Drop a receipt in the Documents app and it&rsquo;s classified and
            mirrored here automatically.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Button onClick={onAdd}>
          <PlusCircle className="h-4 w-4" />
          Add a receipt
        </Button>
      </div>
    </section>
  );
}
