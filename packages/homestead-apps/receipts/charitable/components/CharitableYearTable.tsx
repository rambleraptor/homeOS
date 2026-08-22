/**
 * Giving by year.
 *
 * The medical tab has no analogue for this, because an HSA receipt has no
 * deadline — it can sit for a decade and still be worth what it was worth. A
 * donation is the opposite: it belongs to exactly one tax year, and the only
 * question anyone asks of it is "what did I give in <year>". This is the answer,
 * for every year on file, and each row selects that year for the rest of the
 * tab.
 */

import { CalendarRange } from 'lucide-react';
import { SectionCard } from '@rambleraptor/homestead-core/shared/components/SectionCard';
import { formatCurrency } from '@rambleraptor/homestead-core/shared/utils/currencyUtils';
import type { YearSummary } from '../types';

interface CharitableYearTableProps {
  years: YearSummary[];
  selectedYear: number;
  onSelectYear: (year: number) => void;
}

export function CharitableYearTable({
  years,
  selectedYear,
  onSelectYear,
}: CharitableYearTableProps) {
  if (years.length === 0) return null;

  return (
    <SectionCard icon={CalendarRange} title="By year">
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="charitable-year-table">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                Year
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Receipts
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Cash
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Non-cash
              </th>
              <th className="px-2 py-2 text-right text-xs font-semibold uppercase tracking-wider text-text-muted">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {years.map((year) => {
              const selected = year.year === selectedYear;
              return (
                <tr
                  key={year.year}
                  onClick={() => onSelectYear(year.year)}
                  aria-selected={selected}
                  className={`cursor-pointer transition-colors ${
                    selected ? 'bg-accent-terracotta/5' : 'hover:bg-gray-50/70'
                  }`}
                >
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        // The row already handles the click; this exists so the
                        // year is reachable by keyboard, not to double-fire.
                        e.stopPropagation();
                        onSelectYear(year.year);
                      }}
                      data-testid={`charitable-year-${year.year}`}
                      className={`text-sm font-semibold tabular-nums ${
                        selected ? 'text-accent-terracotta' : 'text-brand-navy'
                      }`}
                    >
                      {year.year}
                    </button>
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-text-muted tabular-nums">
                    {year.count}
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-brand-slate tabular-nums">
                    {formatCurrency(year.cash)}
                  </td>
                  <td className="px-2 py-2 text-right text-sm text-brand-slate tabular-nums">
                    {formatCurrency(year.nonCash)}
                  </td>
                  <td
                    data-testid={`charitable-year-total-${year.year}`}
                    className="px-2 py-2 text-right text-sm font-semibold text-brand-navy tabular-nums"
                  >
                    {formatCurrency(year.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
