/**
 * Resolve an HSA receipt's `receipt_file` to a blob URL the browser can render.
 * Thin wrapper over the shared `useFileFieldUrl`.
 */

import { useFileFieldUrl } from '@rambleraptor/homestead-core/api/resourceHooks';
import { HSA_RECEIPTS } from '../resources';
import type { HSAReceipt } from '../types';

export function useHSAReceiptUrl(receipt: HSAReceipt | null | undefined): string | null {
  return useFileFieldUrl(HSA_RECEIPTS, receipt?.id, 'receipt_file', receipt?.receipt_file);
}
