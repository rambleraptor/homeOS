/**
 * Thumbnail for a medical receipt — the shared thumb, bound to the
 * `hsa-receipts` collection and named after the merchant.
 */

import { ReceiptThumb } from '../../shared/ReceiptThumb';
import { HSA_RECEIPTS } from '../resources';
import type { HSAReceipt } from '../types';

interface HSAReceiptThumbProps {
  receipt: HSAReceipt;
  size?: 'sm' | 'md';
}

export function HSAReceiptThumb({ receipt, size = 'md' }: HSAReceiptThumbProps) {
  return (
    <ReceiptThumb
      plural={HSA_RECEIPTS}
      id={receipt.id}
      fileName={receipt.receipt_file}
      sourceDocument={receipt.source_document}
      alt={`Receipt from ${receipt.merchant}`}
      size={size}
    />
  );
}
