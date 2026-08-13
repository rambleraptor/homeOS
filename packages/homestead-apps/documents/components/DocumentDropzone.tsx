/**
 * The upload surface at the top of the documents index: a real drag-and-drop
 * dropzone (click to browse, drag-over highlight) with the primary upload action
 * front-and-centre and the specialised paths — redact-first, split-a-bundle —
 * offered as secondary buttons. The hidden file inputs live in the parent so the
 * e2e harness can drive them directly; this component just reports intent.
 */

import { useState } from 'react';
import { Loader2, Upload, Shield, Scissors, HelpCircle } from 'lucide-react';

interface DocumentDropzoneProps {
  /** Files dropped onto the surface go straight to the plain upload path. */
  onFiles: (files: FileList | null) => void;
  onBrowseUpload: () => void;
  onBrowseRedact: () => void;
  onBrowseBundle: () => void;
  uploading: boolean;
  bundleBusy: boolean;
}

export function DocumentDropzone({
  onFiles,
  onBrowseUpload,
  onBrowseRedact,
  onBrowseBundle,
  uploading,
  bundleBusy,
}: DocumentDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const secondaryBtn =
    'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-surface-white px-3 py-2 text-sm font-medium text-brand-slate transition-colors hover:bg-bg-pearl disabled:opacity-50';

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && onBrowseUpload()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
            e.preventDefault();
            onBrowseUpload();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles(e.dataTransfer.files);
        }}
        data-testid="document-dropzone"
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? 'border-accent-terracotta bg-accent-terracotta/5'
            : 'border-gray-200 bg-bg-pearl/60 hover:border-accent-terracotta/60 hover:bg-bg-pearl'
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-terracotta/10 text-accent-terracotta">
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </span>
        <div>
          <p className="text-sm font-semibold text-brand-navy">
            {uploading ? 'Uploading…' : 'Drop a document here, or click to browse'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            PDF or image · multi-page PDFs welcome · we&rsquo;ll read it for you
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBrowseUpload}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-terracotta px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-terracotta-hover disabled:opacity-50"
          data-testid="document-upload-button"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {uploading ? 'Uploading…' : 'Upload document'}
        </button>
        <button
          type="button"
          onClick={onBrowseRedact}
          disabled={uploading}
          className={secondaryBtn}
          data-testid="document-redact-button"
        >
          <Shield className="h-4 w-4" />
          Redact &amp; upload
        </button>
        <button
          type="button"
          onClick={onBrowseBundle}
          disabled={bundleBusy}
          className={secondaryBtn}
          data-testid="document-bundle-button"
        >
          {bundleBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Scissors className="h-4 w-4" />
          )}
          Split a tax return
        </button>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 text-xs text-text-muted hover:text-brand-slate"
          aria-expanded={showHelp}
          data-testid="document-upload-help-toggle"
        >
          <HelpCircle className="h-4 w-4" />
          What do these do?
        </button>
      </div>

      {showHelp && (
        <p className="mt-2 text-xs leading-relaxed text-text-muted" data-testid="document-upload-help">
          Use <strong>Redact &amp; upload</strong> to black out sensitive areas before the file
          leaves your device — you can split a redacted tax return into forms from there too. Use{' '}
          <strong>Split a tax return</strong> for a single PDF made of several forms — we&rsquo;ll
          split it into one document per form and read each on its own.
        </p>
      )}
    </div>
  );
}
