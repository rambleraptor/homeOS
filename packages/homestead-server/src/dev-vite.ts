/**
 * Dev-mode HTTP front: one `node:http` server on the public port that sends
 * server-owned paths (/api, /oauth, /health) to the Hono app and everything
 * else to Vite's middleware stack (SPA + HMR).
 *
 * Vite runs in middleware mode inside this same Bun process; its HMR
 * websocket upgrades on the same listener (`hmr: { server }`), so dev is a
 * single process on a single port. Prod never imports this module — the SPA
 * is served as static assets via Bun.serve.
 *
 * The node→fetch bridge is hand-rolled: @hono/node-server's
 * getRequestListener would do this, but it replaces the global Response with
 * a "lightweight" class that Bun.serve (the internal listener) rejects.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { isServerPath } from './options';

const APP_ROOT = fileURLToPath(new URL('../../homestead-app', import.meta.url));

export interface DevServer {
  stop: () => Promise<void>;
}

type FetchHandler = (request: Request) => Response | Promise<Response>;

async function bridge(
  req: IncomingMessage,
  res: ServerResponse,
  fetchFn: FetchHandler,
): Promise<void> {
  const url = `http://${req.headers.host ?? '127.0.0.1'}${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const vv of v) headers.append(k, vv);
    } else {
      headers.set(k, v);
    }
  }
  const method = req.method ?? 'GET';
  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'HEAD') {
    // Buffer the body rather than streaming it through: the node request
    // must be fully consumed even when the handler never reads it (405s,
    // auth rejections), or the next request on the same keep-alive
    // connection can desync.
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }
    if (chunks.length > 0) init.body = new Uint8Array(Buffer.concat(chunks));
  }

  let response: Response;
  try {
    response = await fetchFn(new Request(url, init));
  } catch (err) {
    res.statusCode = 500;
    res.end(err instanceof Error ? err.message : 'internal error');
    return;
  }

  const outHeaders: Record<string, string | string[]> = {};
  for (const [k, v] of response.headers.entries()) {
    if (k === 'set-cookie') continue;
    outHeaders[k] = v;
  }
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length > 0) outHeaders['set-cookie'] = setCookies;
  res.writeHead(response.status, outHeaders);

  if (response.body) {
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}

export async function startDevServer(opts: {
  port: number;
  fetch: FetchHandler;
}): Promise<DevServer> {
  const { createServer: createViteServer } = await import('vite');

  // The handler needs the Vite instance and Vite's HMR needs the http server,
  // so create the listener-less server first and attach `request` after.
  const httpServer = createHttpServer();
  // Never close idle keep-alive connections: the default 5s idle timeout
  // races browsers re-using a connection at the exact moment the server
  // closes it, which surfaces as transient "Failed to fetch" errors. Dev
  // serves one household; holding sockets open is free.
  httpServer.keepAliveTimeout = 0;

  const vite = await createViteServer({
    root: APP_ROOT,
    configFile: `${APP_ROOT}/vite.config.ts`,
    appType: 'spa',
    server: {
      middlewareMode: true,
      // Same-port websocket upgrades for HMR.
      hmr: { server: httpServer },
    },
  });

  if (process.env.HOMESTEAD_DEBUG_HTTP) {
    httpServer.on('clientError', (err, socket) => {
      console.log(`[dev-front] clientError: ${err.message}`);
      socket.destroy();
    });
    httpServer.on('connection', (socket) => {
      socket.on('error', (err) => console.log(`[dev-front] socket error: ${err.message}`));
    });
  }

  httpServer.on('request', (req, res) => {
    const path = (req.url ?? '/').split('?', 1)[0]!;
    if (process.env.HOMESTEAD_DEBUG_HTTP) {
      res.on('error', (err) => console.log(`[dev-front] res error ${path}: ${err.message}`));
      res.on('close', () => {
        if (!res.writableFinished) {
          console.log(`[dev-front] res closed unfinished: ${req.method} ${path}`);
        }
      });
    }
    if (isServerPath(path)) {
      void bridge(req, res, opts.fetch).catch((err) => {
        console.log(`[dev-front] bridge error ${req.method} ${path}: ${err?.message ?? err}`);
        if (!res.headersSent) res.writeHead(500);
        res.end();
      });
      return;
    }
    vite.middlewares(req, res, () => {
      res.statusCode = 404;
      res.end('not found');
    });
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(opts.port, () => resolve());
  });

  return {
    stop: async () => {
      await vite.close();
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}
