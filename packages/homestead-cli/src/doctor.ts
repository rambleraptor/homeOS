import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { loadProject } from './project.ts';

type Status = 'ok' | 'warn' | 'fail';
export interface Check {
  name: string;
  status: Status;
  detail: string;
}

export interface DoctorOptions {
  projectDir: string;
  frontendPort: number;
  aepbasePort: number;
}

/** Run the read-only self-checks for `homestead start`. */
export async function runDoctor(opts: DoctorOptions): Promise<Check[]> {
  const checks: Check[] = [];
  checks.push(platformCheck());
  checks.push(toolCheck('bun', 'required to run homestead'));
  checks.push(await portCheck('frontend port', opts.frontendPort));
  checks.push(await portCheck('engine port', opts.aepbasePort));
  checks.push(projectCheck(opts.projectDir));
  checks.push(depsCheck(opts.projectDir));
  return checks;
}

export function hasFailures(checks: Check[]): boolean {
  return checks.some((c) => c.status === 'fail');
}

function platformCheck(): Check {
  const plat = `${process.platform}/${process.arch}`;
  if (process.platform === 'darwin' || process.platform === 'linux') {
    return { name: 'platform', status: 'ok', detail: plat };
  }
  return {
    name: 'platform',
    status: 'warn',
    detail: `${plat} — only macOS + Linux are validated`,
  };
}

function toolCheck(bin: string, why: string): Check {
  const path = Bun.which(bin);
  return path
    ? { name: bin, status: 'ok', detail: path }
    : { name: bin, status: 'fail', detail: `not found on PATH — ${why}` };
}

function portCheck(name: string, port: number): Promise<Check> {
  return new Promise((resolvePromise) => {
    const srv = createServer();
    srv.once('error', () => {
      resolvePromise({
        name,
        status: 'fail',
        detail: `:${port} is in use`,
      });
    });
    srv.once('listening', () => {
      srv.close(() =>
        resolvePromise({ name, status: 'ok', detail: `:${port} is free` }),
      );
    });
    srv.listen(port, '127.0.0.1');
  });
}

function projectCheck(dir: string): Check {
  try {
    const project = loadProject(dir);
    return { name: 'project', status: 'ok', detail: project.configPath };
  } catch (err) {
    return {
      name: 'project',
      status: 'warn',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// The server, SPA shell, and vite all resolve through the project's
// node_modules — the launcher runs them as bun children, nothing is embedded.
function depsCheck(dir: string): Check {
  const serverEntry = join(
    dir,
    'node_modules',
    '@rambleraptor',
    'homestead-server',
    'src',
    'index.ts',
  );
  const viteBin = join(dir, 'node_modules', '.bin', 'vite');
  if (existsSync(serverEntry) && existsSync(viteBin)) {
    return { name: 'dependencies', status: 'ok', detail: 'node_modules has server + vite' };
  }
  return {
    name: 'dependencies',
    status: 'warn',
    detail: 'homestead-server/vite missing from node_modules — `homestead start` will install them',
  };
}
