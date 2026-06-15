import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { srcDir } from './paths.ts';
import { loadProject } from './project.ts';

const UNIT_DIR = '/etc/systemd/system';

export interface InstallServiceOptions {
  projectDir: string;
  /** Base unit name; the file is <name>.service. */
  serviceName: string;
  /** User the long-running unit runs as. */
  user: string;
  /** App port for `homestead start`. */
  port: number;
  /** server data dir; defaults to <project>/data. */
  dataDir?: string;
  /** EnvironmentFile for the unit; auto-detected from <project>/.env if unset. */
  envFile?: string;
}

/**
 * How to invoke this CLI from a unit file. A compiled binary is its own
 * executable (process.execPath); from source we re-create this process's
 * own invocation (bun, or node + the tsx loader args).
 */
export function resolveInvocation(): string {
  if (typeof Bun !== 'undefined' && Bun.embeddedFiles.length > 0) return process.execPath;
  return [process.execPath, ...process.execArgv, resolve(srcDir, 'cli.ts')].join(' ');
}

interface RenderParams extends Required<Omit<InstallServiceOptions, 'envFile'>> {
  invocation: string;
  cacheDir: string;
  envFile?: string;
}

/** The long-running unit: `homestead start`. */
export function renderMainService(p: RenderParams): string {
  return `[Unit]
Description=Homestead (launcher: server + SPA built from the project)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${p.user}
WorkingDirectory=${p.projectDir}
ExecStart=${p.invocation} start --port ${p.port} --data-dir ${p.dataDir}
Restart=on-failure
RestartSec=5s
${p.envFile ? `EnvironmentFile=${p.envFile}\n` : ''}# homestead cache dir (holds the SPA build); keep it
# writable under ProtectSystem=strict.
Environment="HOMESTEAD_CACHE_DIR=${p.cacheDir}"

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${p.dataDir} ${p.cacheDir}

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;
}

interface RunResult {
  code: number;
  err: string;
}

function run(cmd: string[]): RunResult {
  const p = spawnSync(cmd[0]!, cmd.slice(1), { stdio: ['inherit', 'inherit', 'pipe'] });
  return { code: p.status ?? 1, err: (p.stderr ?? '').toString().trim() };
}

/**
 * Generate and install the systemd unit for this instance: the long-running
 * `homestead start` service. Idempotent — re-running overwrites the unit.
 * Requires root.
 */
export async function installServices(opts: InstallServiceOptions): Promise<number> {
  if (!(typeof process.getuid === 'function' && process.getuid() === 0)) {
    console.error('install-service must run as root (try `sudo homestead install-service`)');
    return 1;
  }
  if (process.platform !== 'linux') {
    console.error(`install-service targets systemd (linux); host is ${process.platform}`);
    return 1;
  }

  const project = loadProject(opts.projectDir);
  const dataDir = opts.dataDir ? resolve(opts.dataDir) : project.dataDir;
  const cacheDir = join(project.root, '.homestead', 'cache');
  const envFile =
    opts.envFile ??
    (existsSync(join(project.root, '.env')) ? join(project.root, '.env') : undefined);

  // systemd sets up the ProtectSystem=strict namespace from ReadWritePaths
  // *before* exec, and fails with 226/NAMESPACE if any listed path is missing.
  // homestead would create the cache dir at runtime (SPA builds land there),
  // but that's too late — create both up front, owned by the service user so
  // the SPA build + db writes can proceed.
  ensureOwnedDir(cacheDir, opts.user);
  ensureOwnedDir(dataDir, opts.user);

  const params: RenderParams = {
    projectDir: project.root,
    serviceName: opts.serviceName,
    user: opts.user,
    port: opts.port,
    dataDir,
    invocation: resolveInvocation(),
    cacheDir,
    envFile,
  };

  const path = join(UNIT_DIR, `${opts.serviceName}.service`);
  writeFileSync(path, renderMainService(params), { mode: 0o644 });
  log(`wrote ${path}`);

  const reload = run(['systemctl', 'daemon-reload']);
  if (reload.code !== 0) {
    console.error(`systemctl daemon-reload failed: ${reload.err}`);
    return 1;
  }
  // Enable (but don't start) the long-running service.
  run(['systemctl', 'enable', `${opts.serviceName}.service`]);

  log('installed');
  console.log('');
  console.log('Next steps:');
  console.log(`  sudo systemctl start ${opts.serviceName}      # start the app`);
  console.log(`  sudo systemctl status ${opts.serviceName}     # check it`);
  console.log(`  sudo journalctl -u ${opts.serviceName} -f     # follow logs`);
  console.log('');
  console.log(
    `Then open http://localhost:${opts.port} — the first visit asks you to create the admin account.`,
  );
  console.log('');
  console.log('A running instance applies homestead.config.ts and apps/ edits on its own');
  console.log('(Vite rebuilds the SPA; open tabs reload).');
  return 0;
}

/**
 * Create `path` (and parents) if missing and hand it to the service user, so
 * the long-running unit — which runs as that user under ProtectSystem=strict —
 * can write into it. Leaves an existing dir (and its contents/ownership)
 * untouched, so re-running install-service never stomps a live data dir.
 */
function ensureOwnedDir(path: string, user: string): void {
  if (existsSync(path)) return;
  mkdirSync(path, { recursive: true });
  // Non-recursive: the dir is freshly empty, and `user:` resolves the group to
  // the user's login group. Best-effort — warn rather than abort the install.
  const res = run(['chown', `${user}:`, path]);
  if (res.code !== 0) {
    console.error(`[homestead] warning: could not chown ${path} to ${user}: ${res.err}`);
  }
}

function log(msg: string): void {
  console.log(`[homestead] ${msg}`);
}
