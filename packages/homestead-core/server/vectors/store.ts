/**
 * Injection seam for the vector store.
 *
 * Core can't import the server's SQLite driver (dependency direction is
 * server → core), so the server constructs a concrete {@link VectorStore} at
 * boot and hands it down here — exactly like `setAiConfig`. Consumers (the
 * index pipeline, the chat search tool) read it via {@link getVectorStore} and
 * treat `null` as "embedding not wired": they skip indexing / return no hits
 * rather than throwing.
 */

import type { VectorStore } from './types';

let current: VectorStore | null = null;

/** Install the instance's vector store. `null` disables embedding features. */
export function setVectorStore(store: VectorStore | null): void {
  current = store;
}

/** The active vector store, or null when embedding isn't wired. */
export function getVectorStore(): VectorStore | null {
  return current;
}
