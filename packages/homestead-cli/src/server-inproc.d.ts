/** Minimal view of homestead-server's startServer for the launcher. */

import type { SpaAssets } from './embed.ts';

export interface InProcessServerOptions {
  dev: boolean;
  publicPort: number;
  internalPort: number;
  dataDir: string;
  spa?: SpaAssets;
}

export interface InProcessServer {
  publicPort: number;
  internalPort: number;
  stop: () => Promise<void>;
}

export function startServer(opts: InProcessServerOptions): Promise<InProcessServer>;
