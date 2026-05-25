/**
 * The top-level entry exposes the runtime only. The typed client is
 * generated into `./generated/` and imported as
 * `@rambleraptor/homestead-aep-client/client` when callers want the
 * resource-oriented accessors. Splitting the two avoids a hard build
 * dependency on the generator output for runtime-only consumers
 * (the Phase 1 shims fall in this bucket).
 */
export * from './runtime';
