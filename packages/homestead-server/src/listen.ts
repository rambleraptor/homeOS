/**
 * Runtime-portable HTTP listener over a fetch handler: Bun.serve under Bun,
 * node:http + the shared bridge under Node. Both routes serve the same Hono
 * apps / engine fetch functions unchanged.
 */

import { createServer } from 'node:http';
import { bridge, type FetchHandler } from './node-http';

export interface ListenOptions {
  port: number;
  hostname?: string;
  fetch: FetchHandler;
}

export interface Listener {
  /** The bound port (resolves port 0 to the actual ephemeral port). */
  port: number;
  stop: () => Promise<void>;
}

export async function listen(opts: ListenOptions): Promise<Listener> {
  if (process.versions.bun) {
    const server = Bun.serve({
      port: opts.port,
      hostname: opts.hostname,
      // Never time out idle keep-alive connections (see dev-vite.ts for the
      // matching rationale on the node path).
      idleTimeout: 0,
      fetch: opts.fetch,
    });
    return {
      port: server.port ?? opts.port,
      stop: async () => {
        await server.stop(true);
      },
    };
  }

  const server = createServer((req, res) => {
    void bridge(req, res, opts.fetch).catch((err) => {
      console.log(`[listen] bridge error ${req.method} ${req.url}: ${err?.message ?? err}`);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  server.keepAliveTimeout = 0;

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, opts.hostname, () => resolve());
  });
  const address = server.address();
  const port = address && typeof address === 'object' ? address.port : opts.port;

  return {
    port,
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
