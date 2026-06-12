/**
 * Dev-mode HTTP front: one `node:http` server on the public port that sends
 * server-owned paths (/api, /oauth, /health) to the Hono app and everything
 * else to Vite's middleware stack (SPA + HMR).
 *
 * Vite runs in middleware mode inside this same server process; its HMR
 * websocket upgrades on the same listener (`hmr: { server }`), so dev is a
 * single process on a single port. Prod never imports this module — the SPA
 * is served as static assets via listen.ts.
 *
 * The node→fetch bridge lives in node-http.ts (shared with the Node
 * production listeners).
 */

import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { bridge, type FetchHandler } from './node-http';
import { isServerPath } from './options';

const APP_ROOT = fileURLToPath(new URL('../../homestead-app', import.meta.url));

export interface DevServer {
  stop: () => Promise<void>;
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
