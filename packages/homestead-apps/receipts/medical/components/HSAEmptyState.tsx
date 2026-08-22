/**
 * HSA Empty State
 *
 * First-run onboarding for the medical tab, on the shared empty state.
 */

import { PlusCircle, ScanLine, Receipt } from 'lucide-react';
import { ReceiptEmptyState } from '../../shared/ReceiptEmptyState';

interface HSAEmptyStateProps {
  onAdd: () => void;
}

export function HSAEmptyState({ onAdd }: HSAEmptyStateProps) {
  return (
    <ReceiptEmptyState
      icon={Receipt}
      title="No receipts found"
      blurb="Track out-of-pocket medical expenses so you can reimburse them from your HSA tax-free — later, whenever you choose."
      routes={[
        {
          icon: PlusCircle,
          iconClassName: 'text-accent-terracotta',
          title: 'Add one by hand',
          body: 'Key in the details and attach the receipt photo or PDF.',
        },
        {
          icon: ScanLine,
          iconClassName: 'text-brand-navy',
          title: 'Upload in Documents',
          body: 'Drop a receipt in the Documents app and it’s classified and mirrored here automatically.',
        },
      ]}
      cta={{ icon: PlusCircle, label: 'Add a receipt', onClick: onAdd }}
    />
  );
}
