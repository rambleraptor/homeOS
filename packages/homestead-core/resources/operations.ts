/**
 * AEP-151 long-running operations — shared types + the store contract the
 * custom-method dispatcher depends on.
 *
 * This module is intentionally **runtime-agnostic**: it holds no server-only
 * imports so the dispatcher (which must run under Bun, Node, or a test
 * harness) can depend on it. The concrete store that actually talks to the
 * engine lives server-side in
 * `packages/homestead-core/server/operations.ts`.
 */

import { OPERATIONS } from './builtins';

export { OPERATIONS };

/** AEP-151 operation status shown in the UI. `done` is the source of truth. */
export type OperationStatus = 'pending' | 'running' | 'succeeded' | 'failed';

/**
 * A stored operation record as returned by the engine. Mirrors the
 * `operation` resource in `builtins.ts` plus the engine-managed fields.
 */
export interface Operation {
  id: string;
  path: string;
  done: boolean;
  status?: OperationStatus;
  method?: string;
  title?: string;
  created_by?: string;
  metadata?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: Record<string, unknown>;
  create_time?: string;
  update_time?: string;
}

/** Inputs for creating a fresh (pending) operation. */
export interface CreateOperationInput {
  /** Bearer token of the caller — operations are created on their behalf. */
  token: string;
  /** The `plural:verb` that spawned the operation, e.g. `hsa-receipts:parse-receipt`. */
  method: string;
  /** Human-readable label; defaults to `method`. */
  title?: string;
  /** User id of the initiator (stored as `created_by`). */
  createdBy?: string;
}

/** Inputs for finishing an operation — exactly one of `response`/`error`. */
export interface CompleteOperationInput {
  token: string;
  id: string;
  response?: unknown;
  error?: unknown;
}

/**
 * The dependency the dispatcher injects to record async work. Kept as an
 * interface so unit tests can supply a fake and the server can supply the
 * real, engine-backed implementation.
 */
export interface OperationStore {
  create(input: CreateOperationInput): Promise<Operation>;
  complete(input: CompleteOperationInput): Promise<void>;
}

/**
 * Coerce an arbitrary thrown value into an AEP-151 `error` payload
 * (loosely AEP-193 "problem"-shaped). Pure — safe to use anywhere.
 */
export function toOperationError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { message: err.message, type: err.name };
  }
  if (err && typeof err === 'object') {
    return err as Record<string, unknown>;
  }
  return { message: String(err) };
}
