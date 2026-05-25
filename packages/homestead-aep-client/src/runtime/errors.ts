/**
 * Error envelope returned by aepbase: `{ error: { code, message } }`.
 * The runtime parses non-2xx responses into this shape so callers have a
 * stable surface regardless of whether the backend returned JSON or text.
 */
export class AepError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly url: string,
  ) {
    super(message);
    this.name = 'AepError';
  }
}
