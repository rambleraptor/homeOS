/**
 * Server-side implementation of the AEP-151 {@link OperationStore}.
 *
 * Creates and completes `operation` records through the engine over loopback,
 * using the caller's forwarded bearer token (via the server aepbase wrapper).
 * Injected into the custom-method dispatcher by the `/api/aep` gateway.
 */

import { aepCreate, aepUpdate } from './aepbase';
import {
  OPERATIONS,
  toOperationError,
  type CompleteOperationInput,
  type CreateOperationInput,
  type Operation,
  type OperationStore,
} from '../resources/operations';

export const operationStore: OperationStore = {
  async create({ token, method, title, createdBy }: CreateOperationInput): Promise<Operation> {
    return aepCreate<Operation>(
      OPERATIONS,
      {
        done: false,
        status: 'running',
        method,
        title: title ?? method,
        created_by: createdBy ?? '',
      },
      token,
    );
  },

  async complete({ token, id, response, error }: CompleteOperationInput): Promise<void> {
    const patch: Record<string, unknown> =
      error !== undefined
        ? { done: true, status: 'failed', error: toOperationError(error) }
        : { done: true, status: 'succeeded', response: (response ?? {}) as Record<string, unknown> };
    await aepUpdate<Operation>(OPERATIONS, id, patch, token);
  },
};

/**
 * Fail any operation still marked `done: false` at boot.
 *
 * Async work runs as an in-process promise, so a server restart mid-operation
 * orphans it — the record would otherwise stay `running` forever and spin the
 * UI indefinitely. Called once on boot (after the schema sync creates the
 * `operations` table) against the engine at `aepbaseUrl` with a short-lived
 * admin token. Returns the number of operations swept.
 */
export async function sweepStaleOperations({
  aepbaseUrl,
  token,
}: {
  aepbaseUrl: string;
  token: string;
}): Promise<number> {
  const headers = { Authorization: `Bearer ${token}` };

  // List every operation (paginated) and keep the ones still in flight.
  const stale: Operation[] = [];
  let pageToken = '';
  do {
    const qs = new URLSearchParams({ max_page_size: '200' });
    if (pageToken) qs.set('page_token', pageToken);
    const res = await fetch(`${aepbaseUrl}/operations?${qs}`, { headers });
    if (!res.ok) {
      throw new Error(`list operations failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as {
      results?: Operation[];
      next_page_token?: string;
    };
    for (const op of body.results ?? []) {
      if (!op.done) stale.push(op);
    }
    pageToken = body.next_page_token ?? '';
  } while (pageToken);

  for (const op of stale) {
    await fetch(`${aepbaseUrl}/operations/${op.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/merge-patch+json' },
      body: JSON.stringify({
        done: true,
        status: 'failed',
        error: {
          message: 'Operation interrupted by a server restart',
          type: 'ServerRestart',
        },
      }),
    });
  }

  return stale.length;
}
