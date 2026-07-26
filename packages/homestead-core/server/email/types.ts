/**
 * Provider-agnostic email contract.
 *
 * An {@link EmailProvider} is a small, backend-neutral surface over a mailbox:
 * read messages and their attachments, send a message, and move a message to
 * the trash. Gmail is the only implementation today ({@link ./gmail}), but the
 * interface deliberately mirrors the shape common to IMAP / Microsoft Graph /
 * Gmail so another backend can slot in behind the same factory.
 *
 * Server-only: this module (and everything under `core/server/email`) is never
 * imported by the SPA bundle. The plain config *data* type lives separately in
 * `core/apps/config.ts` so `homestead.config.ts` can build it browser-side
 * without dragging a provider class into scope.
 */

/** A parsed email address. `name` is the display name when present. */
export interface EmailAddress {
  name?: string;
  email: string;
}

/**
 * An attachment descriptor — metadata only, no bytes. Fetch the bytes lazily
 * with {@link EmailProvider.getAttachment} using {@link id}.
 */
export interface EmailAttachment {
  /**
   * Provider-specific attachment handle used to fetch the bytes. For Gmail this
   * is the part's `attachmentId`, which is only valid for the message fetch it
   * came from — treat it as ephemeral, not a durable key.
   */
  id: string;
  /** Filename as declared by the sender (may be empty for unnamed parts). */
  filename: string;
  /** MIME type of the attachment, e.g. `application/pdf`. */
  mimeType: string;
  /** Size in bytes when the provider reports it. */
  size?: number;
}

/**
 * A lightweight reference returned by {@link EmailProvider.listMessages}.
 * Listing is cheap and returns only handles; call
 * {@link EmailProvider.getMessage} to hydrate the full message. This mirrors
 * Gmail's real API (list → ids, get → everything) and keeps the per-message
 * fetch cost explicit at the call site rather than hidden inside `listMessages`.
 */
export interface EmailMessageRef {
  id: string;
  threadId?: string;
}

/** A fully-hydrated message, including attachment descriptors (no bytes). */
export interface EmailMessage extends EmailMessageRef {
  from?: EmailAddress;
  to?: EmailAddress[];
  subject?: string;
  /** RFC3339 timestamp of the message, when derivable. */
  date?: string;
  /** Short provider-supplied preview of the body. */
  snippet?: string;
  /** Decoded plain-text and/or HTML bodies. */
  body?: { text?: string; html?: string };
  /** Real attachments (inline images / signatures are excluded). */
  attachments: EmailAttachment[];
}

/** Options for {@link EmailProvider.listMessages}. */
export interface ListMessagesOptions {
  /** Provider-specific search query (Gmail: `q`, e.g. `has:attachment`). */
  query?: string;
  /** Cap on how many messages to return. */
  maxResults?: number;
}

/** Options for {@link EmailProvider.sendMessage}. */
export interface SendMessageOptions {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  /** Plain-text body. Provide `text`, `html`, or both. */
  text?: string;
  /** HTML body. Provide `text`, `html`, or both. */
  html?: string;
}

/** Result of a successful {@link EmailProvider.sendMessage}. */
export interface SentMessage {
  id: string;
  threadId?: string;
}

/**
 * A mailbox backend. Concrete providers extend this; consumers obtain one via
 * `getEmailProvider()` (see `./config`) rather than constructing it directly.
 *
 * The surface splits into **read** (`listMessages`, `getMessage`,
 * `getAttachment`), **write** (`sendMessage`), and **delete** (`trashMessage`).
 */
export abstract class EmailProvider {
  /** READ: list message handles matching `options.query`. */
  abstract listMessages(options?: ListMessagesOptions): Promise<EmailMessageRef[]>;

  /** READ: hydrate one message (headers, bodies, attachment descriptors). */
  abstract getMessage(id: string): Promise<EmailMessage>;

  /** READ: fetch an attachment's raw bytes by message + attachment id. */
  abstract getAttachment(messageId: string, attachmentId: string): Promise<Buffer>;

  /** WRITE: send a message. Resolves with the created message's id. */
  abstract sendMessage(options: SendMessageOptions): Promise<SentMessage>;

  /**
   * DELETE: move a message to the mailbox's trash (recoverable, not a permanent
   * purge). Used by the documents ingestion cron to retire a message once its
   * attachments are safely stored.
   */
  abstract trashMessage(id: string): Promise<void>;
}
