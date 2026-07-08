/**
 * HSA App Types
 *
 * Types for managing unreimbursed medical expenses and HSA receipts.
 */

/**
 * Receipt categories for medical expenses.
 *
 * These lowercase values are the wire/stored form. Use RECEIPT_CATEGORY_LABELS
 * for user-facing display text.
 */
export type ReceiptCategory = 'medical' | 'dental' | 'vision' | 'rx';

/**
 * Receipt status for tracking reimbursement.
 *
 * These lowercase values are the wire/stored form. Use RECEIPT_STATUS_LABELS
 * for user-facing display text.
 */
export type ReceiptStatus = 'stored' | 'reimbursed';

/** Canonical ordering of category values (for building option lists). */
export const RECEIPT_CATEGORY_VALUES: ReceiptCategory[] = [
  'medical',
  'dental',
  'vision',
  'rx',
];

/** Canonical ordering of status values. */
export const RECEIPT_STATUS_VALUES: ReceiptStatus[] = ['stored', 'reimbursed'];

/** Capitalized display labels for category values (what the user sees). */
export const RECEIPT_CATEGORY_LABELS: Record<ReceiptCategory, string> = {
  medical: 'Medical',
  dental: 'Dental',
  vision: 'Vision',
  rx: 'Rx',
};

/** Capitalized display labels for status values (what the user sees). */
export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
  stored: 'Stored',
  reimbursed: 'Reimbursed',
};

/**
 * HSA Receipt from aepbase
 */
export interface HSAReceipt {
  id: string;
  merchant: string;
  service_date: string;
  amount: number;
  category: ReceiptCategory;
  patient?: string;
  status: ReceiptStatus;
  receipt_file: string;
  notes?: string;
  created_by?: string;
  created: string;
  updated: string;
}

/**
 * Form data for creating/updating HSA receipts
 */
export interface HSAReceiptFormData {
  merchant: string;
  service_date: string;
  amount: number;
  category: ReceiptCategory;
  patient?: string;
  status: ReceiptStatus;
  receipt_file?: File;
  notes?: string;
}

/**
 * Summary statistics for HSA receipts
 */
export interface HSAStats {
  totalStored: number;
  totalReimbursed: number;
  totalReceipts: number;
  storedReceipts: number;
  reimbursedReceipts: number;
  categoryBreakdown: CategoryBreakdown[];
  patientBreakdown: PatientBreakdown[];
}

/**
 * Breakdown by category
 */
export interface CategoryBreakdown {
  category: ReceiptCategory;
  total: number;
  count: number;
}

/**
 * Breakdown by patient
 */
export interface PatientBreakdown {
  patient: string;
  total: number;
  count: number;
}
