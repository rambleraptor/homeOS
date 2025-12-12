/**
 * Merchant List Component
 *
 * Displays list of merchants with total amounts
 */

import { ChevronRight, Store } from 'lucide-react';
import type { MerchantSummary } from '../types';

interface MerchantListProps {
  merchants: MerchantSummary[];
  onMerchantClick: (merchant: string) => void;
}

export function MerchantList({ merchants, onMerchantClick }: MerchantListProps) {
  if (merchants.length === 0) {
    return (
      <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600 dark:text-gray-400">
          No gift cards yet. Add your first card to get started!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {merchants.map((merchant) => (
        <button
          key={merchant.merchant}
          onClick={() => onMerchantClick(merchant.merchant)}
          className="w-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow text-left group"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center">
                <Store className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {merchant.merchant}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {merchant.cardCount} {merchant.cardCount === 1 ? 'card' : 'cards'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  ${merchant.totalAmount.toFixed(2)}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
