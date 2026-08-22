/**
 * First-run onboarding for the charitable tab, on the shared empty state.
 */

import { HandHeart, PlusCircle, ScanLine } from 'lucide-react';
import { ReceiptEmptyState } from '../../shared/ReceiptEmptyState';

interface CharitableEmptyStateProps {
  onAdd: () => void;
}

export function CharitableEmptyState({ onAdd }: CharitableEmptyStateProps) {
  return (
    <ReceiptEmptyState
      icon={HandHeart}
      title="No donations found"
      blurb="Keep every charity receipt in one place, and the year's deductible total adds itself up as you go."
      routes={[
        {
          icon: PlusCircle,
          iconClassName: 'text-accent-terracotta',
          title: 'Add one by hand',
          body: 'Key in the charity, the date and the amount, and attach the letter if you have it.',
        },
        {
          icon: ScanLine,
          iconClassName: 'text-brand-navy',
          title: 'Upload in Documents',
          body: 'Drop an acknowledgment letter in the Documents app and it’s classified and mirrored here automatically.',
        },
      ]}
      cta={{ icon: PlusCircle, label: 'Add a donation', onClick: onAdd }}
    />
  );
}
