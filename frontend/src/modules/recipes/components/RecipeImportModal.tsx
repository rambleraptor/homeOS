'use client';

/**
 * Recipe Import Modal
 *
 * Lets the user paste a recipe in one of the registered formats
 * (see `../importers/`), previews the parsed result, and submits it
 * through the same create mutation as the manual form.
 *
 * The modal is intentionally format-agnostic: adding a new `RecipeImporter`
 * to the registry is all it takes to expose another option here.
 */

import { useMemo, useState } from 'react';
import { AlertCircle, Download, Info, Loader2, X } from 'lucide-react';
import { Modal } from '@/shared/components/Modal';
import {
  DEFAULT_IMPORTER_ID,
  getImporter,
  RECIPE_IMPORTERS,
} from '../importers';
import type { RecipeImportResult } from '../importers/types';
import type { RecipeFormData } from '../types';

interface RecipeImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: RecipeFormData) => Promise<void> | void;
  isSubmitting?: boolean;
}

export function RecipeImportModal({
  isOpen,
  onClose,
  onImport,
  isSubmitting = false,
}: RecipeImportModalProps) {
  const [importerId, setImporterId] = useState(DEFAULT_IMPORTER_ID);
  const [input, setInput] = useState('');

  const importer = getImporter(importerId) ?? RECIPE_IMPORTERS[0];

  const result: RecipeImportResult | null = useMemo(() => {
    if (!input.trim()) return null;
    return importer.parse(input);
  }, [importer, input]);

  const handleClose = () => {
    if (isSubmitting) return;
    setInput('');
    setImporterId(DEFAULT_IMPORTER_ID);
    onClose();
  };

  const handleImport = async () => {
    if (!result?.data) return;
    await onImport(result.data);
    setInput('');
    setImporterId(DEFAULT_IMPORTER_ID);
  };

  const canImport = Boolean(result?.data) && !isSubmitting;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Import Recipe">
      <div className="space-y-4" data-testid="recipe-import-modal">
        <div>
          <label
            htmlFor="recipe-import-format"
            className="block text-sm font-medium text-brand-navy mb-1"
          >
            Format
          </label>
          <select
            id="recipe-import-format"
            data-testid="recipe-import-format"
            value={importerId}
            onChange={(e) => setImporterId(e.target.value)}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-terracotta bg-white"
          >
            {RECIPE_IMPORTERS.map((imp) => (
              <option key={imp.id} value={imp.id}>
                {imp.label}
              </option>
            ))}
          </select>
          {importer.description && (
            <p className="mt-1 text-xs text-text-muted flex items-start gap-1">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{importer.description}</span>
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="recipe-import-input"
            className="block text-sm font-medium text-brand-navy mb-1"
          >
            Recipe text
          </label>
          <textarea
            id="recipe-import-input"
            data-testid="recipe-import-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={importer.placeholder}
            rows={12}
            disabled={isSubmitting}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-accent-terracotta font-mono text-sm"
          />
        </div>

        {result && <ImportPreview result={result} />}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-4 py-2 bg-bg-pearl hover:bg-gray-100 text-brand-navy rounded-lg font-medium transition-colors border border-gray-200 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!canImport}
            data-testid="recipe-import-submit"
            className="flex items-center gap-2 px-4 py-2 bg-accent-terracotta hover:bg-accent-terracotta-hover text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isSubmitting ? 'Importing...' : 'Import Recipe'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

interface ImportPreviewProps {
  result: RecipeImportResult;
}

function ImportPreview({ result }: ImportPreviewProps) {
  const { data, warnings, errors } = result;

  if (errors.length > 0) {
    return (
      <div
        data-testid="recipe-import-errors"
        className="bg-red-50/20 border border-red-200 rounded-lg p-4"
      >
        <div className="flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <p className="font-semibold mb-1">Could not parse recipe</p>
            <ul className="list-disc list-inside space-y-0.5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      data-testid="recipe-import-preview"
      className="bg-bg-pearl/40 border border-gray-200 rounded-lg p-4 space-y-3"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-text-muted">Title</p>
        <p className="font-semibold text-brand-navy">{data.title}</p>
      </div>

      {data.source_pointer && (
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Source</p>
          <p className="text-sm text-brand-slate truncate">{data.source_pointer}</p>
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-text-muted">
          Ingredients ({data.parsed_ingredients.length})
        </p>
        {data.parsed_ingredients.length > 0 ? (
          <ul className="mt-1 space-y-0.5 text-sm text-brand-slate">
            {data.parsed_ingredients.slice(0, 8).map((ing, idx) => (
              <li key={idx}>
                <span className="font-mono text-xs text-text-muted">
                  {ing.qty} {ing.unit}
                </span>{' '}
                {ing.item}
              </li>
            ))}
            {data.parsed_ingredients.length > 8 && (
              <li className="text-xs text-text-muted">
                …and {data.parsed_ingredients.length - 8} more
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-text-muted italic">None detected</p>
        )}
      </div>

      {data.method && (
        <div>
          <p className="text-xs uppercase tracking-wide text-text-muted">Method</p>
          <p className="text-xs text-text-muted">
            {data.method.length.toLocaleString()} characters ·{' '}
            {data.method.split('\n').filter((l) => l.trim().length > 0).length} lines
          </p>
        </div>
      )}

      {warnings.length > 0 && (
        <div
          data-testid="recipe-import-warnings"
          className="text-xs text-amber-800 bg-amber-50/60 border border-amber-200 rounded p-2"
        >
          <ul className="list-disc list-inside space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
