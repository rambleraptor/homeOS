/**
 * One vaccine series: name, due badge, dose summary, and an expandable
 * dose history with per-dose edit/delete and an "Add dose" action.
 */

import { CalendarClock, ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import { dueStatus, todayIso } from '../utils/due';
import type { DueStatus, Vaccination, Vaccine } from '../types';
import { VaccinationCard, formatDate } from './VaccinationCard';

interface VaccineCardProps {
  vaccine: Vaccine;
  /** Doses newest-first; undefined while still loading. */
  doses: Vaccination[] | undefined;
  expanded: boolean;
  onToggle: (id: string) => void;
  onEdit: (vaccine: Vaccine) => void;
  onDelete: (vaccine: Vaccine) => void;
  onAddDose: (vaccine: Vaccine) => void;
  onEditDose: (vaccine: Vaccine, dose: Vaccination) => void;
  onDeleteDose: (vaccine: Vaccine, dose: Vaccination) => void;
}

const DUE_BADGE: Record<Exclude<DueStatus, 'none'>, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
  'due-soon': { label: 'Due soon', className: 'bg-amber-100 text-amber-800' },
  ok: { label: 'Up to date', className: 'bg-green-100 text-green-800' },
};

export function VaccineCard({
  vaccine,
  doses,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddDose,
  onEditDose,
  onDeleteDose,
}: VaccineCardProps) {
  const status = dueStatus(vaccine.next_due, todayIso());
  const badge = status === 'none' ? null : DUE_BADGE[status];
  const lastDose = doses?.[0];

  return (
    <div
      data-testid="vaccine-card"
      className="bg-white rounded-lg border border-gray-200 shadow-sm"
    >
      <div className="p-4 flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggle(vaccine.id)}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${vaccine.name} history`}
          aria-expanded={expanded}
          data-testid="vaccine-card-toggle"
          className="p-1 mt-0.5 text-text-muted hover:text-brand-navy rounded-md hover:bg-bg-pearl transition-colors flex-shrink-0"
        >
          {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-brand-navy">{vaccine.name}</h3>
            {badge && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                {badge.label}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">
            {doses === undefined
              ? 'Loading doses…'
              : doses.length === 0
                ? 'No doses recorded yet'
                : `${doses.length} dose${doses.length === 1 ? '' : 's'} · last ${formatDate(
                    lastDose!.date_administered,
                  )}`}
          </p>
          {vaccine.next_due && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-brand-slate">
              <CalendarClock className="w-4 h-4 text-text-muted" aria-hidden="true" />
              Next due {formatDate(vaccine.next_due)}
            </p>
          )}
          {vaccine.notes && (
            <p className="mt-1 text-sm text-text-muted line-clamp-2">{vaccine.notes}</p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onAddDose(vaccine)}
            aria-label={`Add ${vaccine.name} dose`}
            data-testid="add-dose-button"
            className="flex items-center gap-1 px-2.5 py-1.5 text-sm text-accent-terracotta hover:text-accent-terracotta-hover rounded-md hover:bg-bg-pearl transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Dose
          </button>
          <button
            type="button"
            onClick={() => onEdit(vaccine)}
            aria-label={`Edit ${vaccine.name}`}
            className="p-2 text-text-muted hover:text-brand-navy rounded-md hover:bg-bg-pearl transition-colors"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(vaccine)}
            aria-label={`Delete ${vaccine.name}`}
            className="p-2 text-text-muted hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div
          data-testid="vaccine-dose-history"
          className="px-4 pb-4 pt-0 space-y-2 border-t border-gray-100"
        >
          {doses === undefined ? (
            <p className="pt-3 text-sm text-text-muted">Loading doses…</p>
          ) : doses.length === 0 ? (
            <p className="pt-3 text-sm text-text-muted">
              No doses recorded yet — add the first one.
            </p>
          ) : (
            <div className="pt-3 space-y-2">
              {doses.map((dose) => (
                <VaccinationCard
                  key={dose.id}
                  vaccineId={vaccine.id}
                  vaccination={dose}
                  onEdit={(d) => onEditDose(vaccine, d)}
                  onDelete={(d) => onDeleteDose(vaccine, d)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
