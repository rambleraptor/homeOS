/**
 * Gift Card Module Types
 */

/**
 * Gift Card record from PocketBase
 */
export interface GiftCard {
  id: string;
  merchant: string;
  card_number: string;
  pin?: string;
  amount: number;
  notes?: string;
  created_by?: string;
  created: string;
  updated: string;
}

/**
 * Form data for creating/updating gift cards
 */
export interface GiftCardFormData {
  merchant: string;
  card_number: string;
  pin?: string;
  amount: number;
  notes?: string;
}

/**
 * Merchant summary with total amount
 */
export interface MerchantSummary {
  merchant: string;
  totalAmount: number;
  cardCount: number;
  cards: GiftCard[];
}

/**
 * Gift card statistics
 */
export interface GiftCardStats {
  totalCards: number;
  totalAmount: number;
  merchantCount: number;
  merchants: MerchantSummary[];
}
