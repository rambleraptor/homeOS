/** Minimal view of the Bun server handle the launcher needs to shut down. */
export interface InProcessSidecar {
  stop(closeActiveConnections?: boolean): void;
}

/** Serve the sidecar's Hono app in the current process on `port`. */
export function serveSidecar(port: number): InProcessSidecar;
