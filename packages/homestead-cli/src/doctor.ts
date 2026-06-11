import { createServer } from 'node:net';
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
  checks.push(npmCheck());
  checks.push(await portCheck('frontend port', opts.frontendPort));
  checks.push(await portCheck('engine port', opts.aepbasePort));
  checks.push(projectCheck(opts.projectDir));
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

// npm is only needed to install workspace deps when running from source
// (Vite itself runs under Bun, in-process).
function npmCheck(): Check {
  const path = Bun.which('npm');
  return path
    ? { name: 'npm', status: 'ok', detail: path }
    : {
        name: 'npm',
        status: 'warn',
        detail: 'not found on PATH — needed to `npm install` when running from source',
      };
}
