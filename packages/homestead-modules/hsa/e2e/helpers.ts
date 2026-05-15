/**
 * HSA E2E helpers — seed receipts (multipart-file uploads) via the
 * aepbase REST API and test data the HSA specs use.
 */

import { aepCreateMultipart, aepList, aepRemove } from '../../../../tests/e2e/utils/aepbase-helpers';

interface CreateHSAReceiptInput {
  merchant: string;
  service_date: string;
  amount: number;
  category: 'Medical' | 'Dental' | 'Vision' | 'Rx';
  patient?: string;
  status: 'Stored' | 'Reimbursed';
  notes?: string;
}

export interface HSAReceiptRecord {
  id: string;
  merchant: string;
  service_date: string;
  amount: number;
  category: 'Medical' | 'Dental' | 'Vision' | 'Rx';
  status: 'Stored' | 'Reimbursed';
  patient?: string;
  notes?: string;
}

export async function createHSAReceipt(
  token: string,
  data: CreateHSAReceiptInput,
): Promise<HSAReceiptRecord> {
  // Minimal valid JPEG (required file field).
  const jpegBytes = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  const blob = new Blob([jpegBytes], { type: 'image/jpeg' });
  const resource: Record<string, unknown> = {
    merchant: data.merchant,
    service_date: data.service_date,
    amount: data.amount,
    category: data.category,
    status: data.status,
  };
  if (data.patient) resource.patient = data.patient;
  if (data.notes) resource.notes = data.notes;

  const formData = new FormData();
  formData.append('resource', JSON.stringify(resource));
  formData.append('receipt_file', blob, 'test-receipt.jpg');

  return aepCreateMultipart<HSAReceiptRecord>(token, 'hsa-receipts', formData);
}

export async function createMultipleHSAReceipts(
  token: string,
  receipts: Array<CreateHSAReceiptInput>,
) {
  const results = [];
  for (const receipt of receipts) {
    results.push(await createHSAReceipt(token, receipt));
  }
  return results;
}

export async function deleteAllHSAReceipts(token: string) {
  const items = await aepList<{ id: string }>(token, 'hsa-receipts');
  for (const item of items) {
    await aepRemove(token, 'hsa-receipts', item.id);
  }
}

export const testHSAReceipts = [
  {
    merchant: 'CVS Pharmacy',
    service_date: '2024-01-15',
    amount: 45.99,
    category: 'Rx' as const,
    patient: 'Self',
    status: 'Stored' as const,
    notes: 'Prescription refill',
  },
  {
    merchant: 'Dr. Smith Dental',
    service_date: '2024-02-20',
    amount: 250.0,
    category: 'Dental' as const,
    patient: 'Child',
    status: 'Stored' as const,
    notes: 'Cavity filling',
  },
  {
    merchant: 'Vision Center',
    service_date: '2024-03-10',
    amount: 150.0,
    category: 'Vision' as const,
    patient: 'Spouse',
    status: 'Stored' as const,
    notes: 'Eye exam and glasses',
  },
  {
    merchant: 'ABC Medical Clinic',
    service_date: '2024-01-05',
    amount: 125.0,
    category: 'Medical' as const,
    patient: 'Self',
    status: 'Reimbursed' as const,
    notes: 'Annual checkup',
  },
];
