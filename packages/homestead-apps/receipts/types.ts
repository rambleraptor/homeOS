/**
 * HSA App Types
 *
 * Types for managing unreimbursed medical expenses and HSA receipts.
 */

/**
 * Receipt categories for medical expenses
 */
export type ReceiptCategory = 'Medical' | 'Dental' | 'Vision' | 'Rx';

/**
 * Receipt status for tracking reimbursement
 */
export type ReceiptStatus = 'Stored' | 'Reimbursed';

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
  /** Canonical link to a `person` record, as a `people/{id}` path. */
  person?: string;
  status: ReceiptStatus;
  /** Absent when the receipt links to a source document instead of its own file. */
  receipt_file?: string;
  /** `documents/{id}` this receipt was derived from; holds the file in place of `receipt_file`. */
  source_document?: string;
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
  /** Canonical link to a `person` record, as a `people/{id}` path. */
  person?: string;
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
