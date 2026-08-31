/**
 * One vaccination record: vaccine name, dose date, series/provider/lot
 * details, a due badge when a next dose is set, and the record image
 * thumbnail when one is stored.
 */

import { Link } from 'react-router-dom';
import { CalendarClock, FileText, Pencil, Trash2 } from 'lucide-react';
import { useVaccinationImageUrl } from '../hooks/useVaccinationImageUrl';
import { dueStatus, todayIso } from '../utils/due';
import type { DueStatus, Vaccination } from '../types';

interface VaccinationCardProps {
  vaccination: Vaccination;
  onEdit: (vaccination: Vaccination) => void;
  onDelete: (id: string) => void;
}

const DUE_BADGE: Record<Exclude<DueStatus, 'none'>, { label: string; className: string }> = {
  overdue: { label: 'Overdue', className: 'bg-red-100 text-red-800' },
  'due-soon': { label: 'Due soon', className: 'bg-amber-100 text-amber-800' },
  ok: { label: 'Up to date', className: 'bg-green-100 text-green-800' },
};

function formatDate(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function VaccinationCard({ vaccination, onEdit, onDelete }: VaccinationCardProps) {
  const imageUrl = useVaccinationImageUrl(
    vaccination.record_image ? vaccination : null,
  );
  const status = dueStatus(vaccination.next_due, todayIso());
  const badge = status === 'none' ? null : DUE_BADGE[status];

  const details: Array<{ label: string; value: string }> = [
    ...(vaccination.dose ? [{ label: 'Dose', value: vaccination.dose }] : []),
    ...(vaccination.provider ? [{ label: 'Provider', value: vaccination.provider }] : []),
    ...(vaccination.lot_number ? [{ label: 'Lot', value: vaccination.lot_number }] : []),
  ];

  return (
    <div
      data-testid="vaccination-card"
      className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex gap-4"
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={`Record for ${vaccination.vaccine}`}
          className="w-20 h-20 object-cover rounded-md border border-gray-200 flex-shrink-0"
        />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-brand-navy truncate">
              {vaccination.vaccine}
            </h3>
            <p className="text-sm text-text-muted">
              {formatDate(vaccination.date_administered)}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => onEdit(vaccination)}
              aria-label={`Edit ${vaccination.vaccine}`}
              className="p-2 text-text-muted hover:text-brand-navy rounded-md hover:bg-bg-pearl transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(vaccination.id)}
              aria-label={`Delete ${vaccination.vaccine}`}
              className="p-2 text-text-muted hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {details.length > 0 && (
          <p className="mt-1 text-sm text-brand-slate truncate">
            {details.map((d) => `${d.label}: ${d.value}`).join(' · ')}
          </p>
        )}

        {vaccination.notes && (
          <p className="mt-1 text-sm text-text-muted line-clamp-2">{vaccination.notes}</p>
        )}

        {vaccination.document && (
          <Link
            to={`/documents/${vaccination.document}`}
            data-testid="vaccination-document-link"
            className="mt-1 inline-flex items-center gap-1 text-sm text-accent-terracotta hover:text-accent-terracotta-hover"
          >
            <FileText className="w-4 h-4" aria-hidden="true" />
            View source document
          </Link>
        )}

        {vaccination.next_due && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <CalendarClock className="w-4 h-4 text-text-muted" aria-hidden="true" />
            <span className="text-brand-slate">
              Next due {formatDate(vaccination.next_due)}
            </span>
            {badge && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
