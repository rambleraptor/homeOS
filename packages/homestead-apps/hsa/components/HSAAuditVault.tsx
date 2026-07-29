/**
 * HSA Audit Vault Component
 *
 * Table view of HSA receipts with filtering
 */

import { useMemo, useState } from 'react';
import { CheckCircle, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';
import { formatDate } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { refToId } from '@rambleraptor/homestead-core/resources/references';
import { usePeople } from '../../people/hooks/usePeople';
import type { HSAStats, HSAReceipt, ReceiptStatus } from '../types';
import { useHSAReceipts } from '../hooks/useHSAReceipts';
import { useHSAReceiptUrl } from '../hooks/useHSAReceiptUrl';

/** Resolve a `people/{id}` reference path to a person's display name. */
function personNameFor(
  path: string | undefined,
  namesById: Map<string, string>,
): string | undefined {
  if (!path) return undefined;
  return namesById.get(refToId(path));
}

/**
 * Renders an HSA receipt's file as a link. A manually captured receipt links to
 * its own `receipt_file`; one derived from a classified document has no file of
 * its own and links to that `source_document` instead. Wrapped in a component
 * so the backend-aware URL hook can be called once per row.
 */
function HSAReceiptLink({ receipt }: { receipt: HSAReceipt }) {
  const url = useHSAReceiptUrl(receipt);
  if (receipt.receipt_file) {
    if (!url) {
      return <span className="text-gray-400 text-sm">Loading…</span>;
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-accent-terracotta hover:text-accent-terracotta-hover font-medium"
      >
        View
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }
  if (receipt.source_document) {
    const docId = refToId(receipt.source_document);
    return (
      <a
        href={`/documents/${docId}`}
        className="inline-flex items-center gap-1 text-accent-terracotta hover:text-accent-terracotta-hover font-medium"
      >
        Document
        <ExternalLink className="w-3 h-3" />
      </a>
    );
  }
  return <span className="text-gray-400 text-sm">-</span>;
}

interface HSAAuditVaultProps {
  stats: HSAStats;
  statusFilter: ReceiptStatus | 'All';
  onStatusFilterChange: (status: ReceiptStatus | 'All') => void;
  onMarkAsReimbursed: (id: string) => void;
  onEdit: (receipt: HSAReceipt) => void;
  onDelete: (id: string) => void;
  isUpdating: boolean;
}

export function HSAAuditVault({
  stats,
  statusFilter,
  onStatusFilterChange,
  onMarkAsReimbursed,
  onEdit,
  onDelete,
  isUpdating,
}: HSAAuditVaultProps) {
  const { data: receipts } = useHSAReceipts();
  const { data: people } = usePeople();

  // 'All', 'Unlinked' (no person set), or a `people/{id}` path.
  const [personFilter, setPersonFilter] = useState<string>('All');

  const namesById = useMemo(
    () => new Map((people ?? []).map((p) => [p.id, p.name])),
    [people],
  );

  // Only the people actually referenced by receipts are worth offering as
  // filter options, so the dropdown doesn't list the whole address book.
  const personOptions = useMemo(() => {
    const paths = new Set<string>();
    for (const r of receipts ?? []) {
      if (r.person) paths.add(r.person);
    }
    return Array.from(paths)
      .map((path) => ({
        path,
        name: personNameFor(path, namesById) ?? 'Unknown',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [receipts, namesById]);

  const filteredReceipts = useMemo(() => {
    if (!receipts) return [];
    return receipts.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (personFilter === 'All') return true;
      if (personFilter === 'Unlinked') return !r.person;
      return r.person === personFilter;
    });
  }, [receipts, statusFilter, personFilter]);


  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Audit Vault</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="status-filter" className="text-sm font-medium text-gray-700">
              Filter:
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value as ReceiptStatus | 'All')}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
            >
              <option value="All">All ({stats.totalReceipts})</option>
              <option value="Stored">Stored ({stats.storedReceipts})</option>
              <option value="Reimbursed">Reimbursed ({stats.reimbursedReceipts})</option>
            </select>
            <label htmlFor="person-filter" className="text-sm font-medium text-gray-700">
              Person:
            </label>
            <select
              id="person-filter"
              data-testid="hsa-person-filter"
              value={personFilter}
              onChange={(e) => setPersonFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta"
            >
              <option value="All">All</option>
              {personOptions.map((opt) => (
                <option key={opt.path} value={opt.path}>
                  {opt.name}
                </option>
              ))}
              <option value="Unlinked">Unlinked</option>
            </select>
          </div>
        </div>
      </div>

      {filteredReceipts.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          <p>No receipts found</p>
          {(statusFilter !== 'All' || personFilter !== 'All') && (
            <button
              onClick={() => {
                onStatusFilterChange('All');
                setPersonFilter('All');
              }}
              className="mt-2 text-sm text-accent-terracotta hover:text-accent-terracotta-hover"
            >
              View all receipts
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Merchant
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Patient
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Receipt
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredReceipts.map((receipt) => (
                <tr key={receipt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(receipt.service_date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {receipt.merchant}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(receipt.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {receipt.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {personNameFor(receipt.person, namesById) || receipt.patient || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <HSAReceiptLink receipt={receipt} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {receipt.status === 'Stored' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Stored
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Reimbursed
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      {receipt.status === 'Stored' && (
                        <button
                          onClick={() => onMarkAsReimbursed(receipt.id)}
                          disabled={isUpdating}
                          aria-label={`Mark ${receipt.merchant} receipt as reimbursed`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Mark as Reimbursed"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                          Mark Reimbursed
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(receipt)}
                        aria-label={`Edit ${receipt.merchant} receipt`}
                        data-testid={`hsa-receipt-edit-${receipt.id}`}
                        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                        title="Edit receipt"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDelete(receipt.id)}
                        aria-label={`Delete ${receipt.merchant} receipt`}
                        className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Delete receipt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Footer */}
      {filteredReceipts.length > 0 && (
        <div className="p-4 bg-gray-50 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              Showing {filteredReceipts.length} {filteredReceipts.length === 1 ? 'receipt' : 'receipts'}
            </span>
            <span className="font-semibold text-gray-900">
              Total: {formatCurrency(filteredReceipts.reduce((sum, r) => sum + r.amount, 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
