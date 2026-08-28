/**
 * The rows standing in for files that are still being uploaded.
 *
 * Uploads run one at a time (see `DocumentsHome`), and until the server has
 * taken a file and the list has polled it back there was nothing on screen for
 * it at all — drop five documents and the page showed one "Uploading…" label
 * over an unchanged list for as long as the batch took. The work was happening
 * and the page was denying it.
 *
 * So each file in the batch gets a row of its own straight away, in the shape
 * of the row it is about to become, and disappears when the real record takes
 * its place. The distinction between the file being sent right now and the ones
 * behind it is worth drawing: it turns "something is happening" into "it's on
 * the third of five", which is the difference between waiting and knowing how
 * long you're waiting.
 *
 * These are deliberately not swipeable and not links. There is nothing to open
 * yet and nothing to delete — cancelling an in-flight upload is a different
 * feature, and a row that offers actions which no-op is worse than one that
 * offers none.
 */

import { File, Loader2 } from 'lucide-react';

export interface PendingUpload {
  /** Stable within the batch. Two dropped files can share a name, so the row's
   *  React key can't be one. */
  id: string;
  /** The file's name, as dropped or picked. */
  name: string;
  /** Whether this is the file currently in flight, or one still queued. */
  active: boolean;
}

export function PendingUploadRows({ uploads }: { uploads: PendingUpload[] }) {
  if (!uploads.length) return null;

  return (
    <div data-testid="document-pending-uploads" className="space-y-2">
      {uploads.map((upload) => (
        <div
          key={upload.id}
          // `animate-field-rise`, not the row cascade below: these arrive as a
          // group the instant the drop lands, so they rise together.
          className="animate-field-rise flex items-center gap-3 rounded-xl border border-dashed border-accent-terracotta/40 bg-accent-terracotta/5 p-3.5"
          data-testid="document-pending-upload"
          data-upload-active={upload.active || undefined}
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              upload.active
                ? 'bg-accent-terracotta/15 text-accent-terracotta'
                : 'bg-bg-pearl text-gray-400'
            }`}
            aria-hidden="true"
          >
            {upload.active ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <File className="h-5 w-5" />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-brand-navy">{upload.name}</p>
            <p className="mt-0.5 text-xs text-text-muted">
              {upload.active ? 'Uploading…' : 'Waiting to upload'}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
