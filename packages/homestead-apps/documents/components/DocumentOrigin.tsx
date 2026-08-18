/**
 * Where a document came from, and what it became.
 *
 * Both facts are already on the record and neither was ever shown. The email
 * one matters because a document nobody uploaded is otherwise inexplicable —
 * it simply appears in the list, and "did I upload that?" is not a question a
 * filing cabinet should provoke. The link matters because it's the app's most
 * useful trick: a photo of a pharmacy receipt turning into an HSA claim you can
 * withdraw against, which is worth knowing happened.
 *
 * Renders nothing when neither applies, which is the common case.
 */

import { Link } from 'react-router-dom';
import { ArrowRight, Mail, Sparkles } from 'lucide-react';
import { describeLinkedResource } from '../linkedResource';
import type { Document } from '../types';

export function DocumentOrigin({ document }: { document: Document }) {
  const fromEmail = !!document.source_email_id;
  const linked = describeLinkedResource(document.linked_resource);
  if (!fromEmail && !linked) return null;

  return (
    <div
      className="space-y-2 rounded-xl border border-gray-100 bg-bg-pearl/70 p-3.5 text-sm"
      data-testid="document-origin"
    >
      {fromEmail && (
        <p
          className="flex items-center gap-2 text-text-muted"
          data-testid="document-origin-email"
        >
          <Mail className="h-4 w-4 shrink-0" />
          Filed automatically from an email attachment.
        </p>
      )}

      {linked &&
        (linked.href ? (
          <Link
            to={linked.href}
            className="group inline-flex items-center gap-2 font-medium text-accent-terracotta hover:text-accent-terracotta-hover"
            data-testid="document-origin-link"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            Saved as {linked.article} {linked.label}
            <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-(--duration-quick) ease-out-soft group-hover:translate-x-0.5" />
          </Link>
        ) : (
          <p
            className="flex items-center gap-2 text-text-muted"
            data-testid="document-origin-link"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            Saved as {linked.article} {linked.label}.
          </p>
        ))}
    </div>
  );
}
