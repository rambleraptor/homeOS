/**
 * HSA Audit Vault Component
 *
 * Receipt list with filtering. Renders a full table on `md+` screens and a
 * stacked card list on phones so nothing overflows horizontally. The two
 * layouts deliberately use different accessible names on their action buttons
 * so a single control matches per viewport.
 */

import { useMemo, useState } from 'react';
import { Archive, CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';
import { formatDate } from '@rambleraptor/homestead-core/shared/utils/dateUtils';
import { usePeople } from '../../people/hooks/usePeople';
import { categoryStyle } from '../categoryConfig';
import type { HSAStats, HSAReceipt, ReceiptStatus } from '../types';
import { useHSAReceipts } from '../hooks/useHSAReceipts';
import { HSAReceiptThumb } from './HSAReceiptThumb';

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
};

/** Resolve a `people/{id}` reference path to a person's display name. */
function personNameFor(
  path: string | undefined,
  namesById: Map<string, string>,
): string | undefined {
  if (!path) return undefined;
  return namesById.get(path.replace(/^people\//, ''));
}

function CategoryBadge({ receipt }: { receipt: HSAReceipt }) {
  const style = categoryStyle(receipt.category);
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.badge}`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {receipt.category}
    </span>
  );
}

function StatusBadge({ status }: { status: ReceiptStatus }) {
  return status === 'Stored' ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      Stored
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
      Reimbursed
    </span>
  );
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

  const selectClass =
    'flex-1 sm:flex-none px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-brand-navy focus:ring-2 focus:ring-accent-terracotta focus:border-accent-terracotta';

  const filtersActive = statusFilter !== 'All' || personFilter !== 'All';

  return (
    <section className="bg-surface-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex flex-col gap-3 p-4 border-b border-gray-50 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gray-50 rounded-lg p-2" aria-hidden="true">
            <Archive className="w-5 h-5 text-brand-navy" />
          </div>
          <h2 className="font-display font-semibold text-lg text-brand-navy">
            Audit Vault
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(e.target.value as ReceiptStatus | 'All')
            }
            className={selectClass}
          >
            <option value="All">All ({stats.totalReceipts})</option>
            <option value="Stored">Stored ({stats.storedReceipts})</option>
            <option value="Reimbursed">
              Reimbursed ({stats.reimbursedReceipts})
            </option>
          </select>
          <label htmlFor="person-filter" className="sr-only">
            Filter by person
          </label>
          <select
            id="person-filter"
            data-testid="hsa-person-filter"
            value={personFilter}
            onChange={(e) => setPersonFilter(e.target.value)}
            className={selectClass}
          >
            <option value="All">Everyone</option>
            {personOptions.map((opt) => (
              <option key={opt.path} value={opt.path}>
                {opt.name}
              </option>
            ))}
            <option value="Unlinked">Unlinked</option>
          </select>
        </div>
      </div>

      {filteredReceipts.length === 0 ? (
        <div className="p-10 text-center">
          <Archive
            className="mx-auto w-10 h-10 text-gray-300"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium text-brand-navy">
            No receipts found
          </p>
          {filtersActive && (
            <button
              onClick={() => {
                onStatusFilterChange('All');
                setPersonFilter('All');
              }}
              className="mt-2 text-sm font-medium text-accent-terracotta hover:text-accent-terracotta-hover"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop / tablet: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50/70 border-b border-gray-100">
                <tr>
                  <th className="w-14 px-4 py-3" />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Merchant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredReceipts.map((receipt) => (
                  <tr
                    key={receipt.id}
                    className="hover:bg-gray-50/70 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <HSAReceiptThumb receipt={receipt} size="sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-brand-navy">
                        {receipt.merchant}
                      </div>
                      <div className="text-xs text-text-muted">
                        {formatDate(receipt.service_date, SHORT_DATE)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CategoryBadge receipt={receipt} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-brand-slate">
                      {personNameFor(receipt.person, namesById) ||
                        receipt.patient ||
                        '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-semibold text-brand-navy tabular-nums">
                      {formatCurrency(receipt.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={receipt.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {receipt.status === 'Stored' && (
                          <button
                            onClick={() => onMarkAsReimbursed(receipt.id)}
                            disabled={isUpdating}
                            aria-label={`Mark ${receipt.merchant} receipt as reimbursed`}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                            title="Mark as reimbursed"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Reimbursed</span>
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(receipt)}
                          aria-label={`Edit ${receipt.merchant} receipt`}
                          data-testid={`hsa-receipt-edit-${receipt.id}`}
                          className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-navy"
                          title="Edit receipt"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(receipt.id)}
                          aria-label={`Delete ${receipt.merchant} receipt`}
                          className="rounded-lg p-1.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
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

          {/* Mobile: stacked cards. Action buttons use terse labels (no merchant
              name) so they never collide with the table's per-receipt labels. */}
          <ul className="divide-y divide-gray-100 md:hidden">
            {filteredReceipts.map((receipt) => (
              <li key={receipt.id} className="p-4">
                <div className="flex items-start gap-3">
                  <HSAReceiptThumb receipt={receipt} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-navy">
                          {receipt.merchant}
                        </p>
                        <p className="text-xs text-text-muted">
                          {formatDate(receipt.service_date, SHORT_DATE)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-brand-navy tabular-nums">
                        {formatCurrency(receipt.amount)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CategoryBadge receipt={receipt} />
                      <StatusBadge status={receipt.status} />
                      {(personNameFor(receipt.person, namesById) ||
                        receipt.patient) && (
                        <span className="text-xs text-text-muted">
                          {personNameFor(receipt.person, namesById) ||
                            receipt.patient}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  {receipt.status === 'Stored' && (
                    <button
                      onClick={() => onMarkAsReimbursed(receipt.id)}
                      disabled={isUpdating}
                      aria-label="Mark as reimbursed"
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Reimbursed
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(receipt)}
                    aria-label="Edit receipt"
                    className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand-navy"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(receipt.id)}
                    aria-label="Delete receipt"
                    className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Summary footer */}
      {filteredReceipts.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 p-4 text-sm">
          <span className="text-text-muted">
            Showing {filteredReceipts.length}{' '}
            {filteredReceipts.length === 1 ? 'receipt' : 'receipts'}
          </span>
          <span className="font-semibold text-brand-navy tabular-nums">
            Total:{' '}
            {formatCurrency(
              filteredReceipts.reduce((sum, r) => sum + r.amount, 0),
            )}
          </span>
        </div>
      )}
    </section>
  );
}
