import type { SpaAssets } from './embed.ts';

type EdgeServer = ReturnType<typeof Bun.serve>;

export interface EdgeOptions {
  port: number;
  /** Loopback aepbase base URL, e.g. http://127.0.0.1:8090. */
  aepbaseUrl: string;
  /** Loopback sidecar base URL, e.g. http://127.0.0.1:4000. */
  sidecarUrl: string;
  /** Static SPA assets (disk in dev, embedded files when compiled). */
  spa: SpaAssets;
}

const SIDECAR_PREFIXES = ['/api/notifications', '/api/custom-methods'];

/**
 * A custom-method call addresses a resource with a trailing `:verb`
 * (`/api/aep/<plural>:<verb>` or `/api/aep/<plural>/<id>:<verb>`). The colon
 * always lives in the final path segment.
 */
function isCustomMethodPath(path: string): boolean {
  if (!path.startsWith('/api/aep/')) return false;
  return path.slice(path.lastIndexOf('/') + 1).includes(':');
}

/**
 * The user-facing server (prod): one port fanning out to aepbase, the sidecar,
 * and the static SPA. Mirrors the Go edge:
 *   - /api/aep/...:verb → sidecar (resource custom methods + aepbase passthrough)
 *   - /api/aep/*  → aepbase, with the /api/aep prefix stripped
 *   - /api/notifications/* → sidecar, path intact
 *   - everything else → static file, falling back to index.html (SPA routing)
 */
export function startEdge(opts: EdgeOptions): EdgeServer {
  const aepbase = opts.aepbaseUrl.replace(/\/$/, '');
  const sidecar = opts.sidecarUrl.replace(/\/$/, '');

  return Bun.serve({
    port: opts.port,
    idleTimeout: 0,
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      // Custom methods live on the sidecar gateway, which dispatches the
      // app ones and proxies aepbase's own `:login`/`:download` through.
      if (isCustomMethodPath(path)) {
        return proxy(req, sidecar + path + url.search);
      }
      if (path === '/api/aep' || path.startsWith('/api/aep/')) {
        const rest = path.slice('/api/aep'.length); // '' or '/...'
        return proxy(req, aepbase + rest + url.search);
      }
      if (
        SIDECAR_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))
      ) {
        return proxy(req, sidecar + path + url.search);
      }
      return serveStatic(opts.spa, path);
    },
  });
}

function proxy(req: Request, target: string): Promise<Response> {
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: req.headers,
    redirect: 'manual',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body;
    init.duplex = 'half';
  }
  return fetch(target, init);
}

function serveStatic(spa: SpaAssets, path: string): Response {
  // Path traversal is guarded inside the SpaAssets resolver.
  const rel = path.replace(/^\/+/, '');
  if (rel && rel !== '.') {
    const file = spa.file(rel);
    if (file) return new Response(file);
  }
  return new Response(spa.index(), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
