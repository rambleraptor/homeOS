import { Transport, type TransportOptions } from './transport';

export interface ClientOptions extends TransportOptions {}

/**
 * Base class for the generated `HomesteadClient`. Holds the transport
 * and lets subclasses construct collection accessors.
 */
export class BaseClient {
  readonly transport: Transport;

  constructor(opts: ClientOptions) {
    this.transport = new Transport(opts);
  }
}
