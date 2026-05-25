import { AepError } from './errors';
import type { Transport } from './transport';

/**
 * AEP-151 long-running operation. Returned from methods on resources
 * whose definition declares `'x-aepbase-lro-methods'`; otherwise the
 * codegen emits the unwrapped result type.
 *
 * The runtime stays loaded regardless of whether any resource opts in,
 * so adding an LRO later is a definition-only change.
 */
export interface OperationResponse<T> {
  name: string;
  done?: boolean;
  response?: T;
  error?: { code?: number; message?: string };
  metadata?: unknown;
}

export class Operation<T> {
  readonly name: string;
  done: boolean;
  response?: T;
  error?: { code?: number; message?: string };

  constructor(
    private readonly transport: Transport,
    body: OperationResponse<T>,
  ) {
    this.name = body.name;
    this.done = !!body.done;
    this.response = body.response;
    this.error = body.error;
  }

  async poll(): Promise<this> {
    const body = await this.transport.request<OperationResponse<T>>(
      `/${this.name}`,
    );
    this.done = !!body.done;
    this.response = body.response;
    this.error = body.error;
    return this;
  }

  async wait(opts: { intervalMs?: number; timeoutMs?: number } = {}): Promise<T> {
    const interval = opts.intervalMs ?? 500;
    const timeout = opts.timeoutMs ?? 60_000;
    const deadline = Date.now() + timeout;
    while (!this.done) {
      if (Date.now() > deadline) {
        throw new AepError(
          504,
          `operation ${this.name} did not complete within ${timeout}ms`,
          this.name,
        );
      }
      await sleep(interval);
      await this.poll();
    }
    if (this.error) {
      throw new AepError(
        this.error.code ?? 500,
        this.error.message ?? 'operation failed',
        this.name,
      );
    }
    return this.response as T;
  }

  async cancel(): Promise<void> {
    await this.transport.request<void>(`/${this.name}:cancel`, {
      method: 'POST',
      body: {},
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
