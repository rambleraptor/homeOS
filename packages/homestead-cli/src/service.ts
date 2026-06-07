import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadProject } from './project.ts';

const UNIT_DIR = '/etc/systemd/system';

export interface InstallServiceOptions {
  projectDir: string;
  /** Base unit name; files are <name>.service and <name>-update.{service,timer}. */
  serviceName: string;
  /** User the long-running + update units run as. */
  user: string;
  /** App port for `homestead start`. */
  port: number;
  /** aepbase data dir; defaults to <project>/data. */
  dataDir?: string;
  /** Update-check cadence, in seconds. */
  intervalSeconds: number;
  /** EnvironmentFile for both units; auto-detected from <project>/.env if unset. */
  envFile?: string;
}

/**
 * Parse a `--update-interval` value into seconds. Accepts `30s`, `5m`, `2h`, or
 * a bare number (interpreted as minutes). Throws on anything unparseable or
 * non-positive.
 */
export function parseInterval(value: string): number {
  const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr)?$/i);
  if (!m) throw new Error(`invalid interval ${JSON.stringify(value)}`);
  const n = Number(m[1]);
  const unit = (m[2] ?? 'm').toLowerCase();
  const perUnit = unit.startsWith('s') ? 1 : unit.startsWith('h') ? 3600 : 60;
  const seconds = Math.round(n * perUnit);
  if (seconds <= 0) throw new Error(`interval must be positive: ${value}`);
  return seconds;
}

/**
 * How to invoke this CLI from a unit file. A compiled binary is its own
 * executable (process.execPath); from source we run the entry via Bun.
 */
export function resolveInvocation(): string {
  if (Bun.embeddedFiles.length > 0) return process.execPath;
  return `${process.execPath} ${resolve(import.meta.dir, 'cli.ts')}`;
}

interface RenderParams extends Required<Omit<InstallServiceOptions, 'envFile'>> {
  invocation: string;
  cacheDir: string;
  envFile?: string;
}

/** The long-running unit: `homestead start`. */
export function renderMainService(p: RenderParams): string {
  return `[Unit]
Description=Homestead (single-binary launcher: aepbase + sidecar + SPA)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=${p.user}
WorkingDirectory=${p.projectDir}
ExecStart=${p.invocation} start --port ${p.port} --data-dir ${p.dataDir}
Restart=on-failure
RestartSec=5s
${p.envFile ? `EnvironmentFile=${p.envFile}\n` : ''}# homestead extracts its embedded aepbase binary here before exec; keep it
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

/** The oneshot unit the timer fires: `homestead update`. */
export function renderUpdateService(p: RenderParams): string {
  return `[Unit]
Description=Homestead auto-update (pull the config repo and restart on changes)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=${p.user}
WorkingDirectory=${p.projectDir}
ExecStart=${p.invocation} update --service-name ${p.serviceName}
${p.envFile ? `EnvironmentFile=${p.envFile}\n` : ''}StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;
}

/** The timer that drives the update check. */
export function renderUpdateTimer(p: RenderParams): string {
  return `[Unit]
Description=Homestead auto-update timer (every ${p.intervalSeconds}s)
Requires=${p.serviceName}-update.service

[Timer]
OnBootSec=2min
OnUnitActiveSec=${p.intervalSeconds}s
# Catch up if the box was off when a check was due.
Persistent=true

[Install]
WantedBy=timers.target
`;
}

interface RunResult {
  code: number;
  err: string;
}

function run(cmd: string[]): RunResult {
  const p = Bun.spawnSync({ cmd, stdout: 'inherit', stderr: 'pipe' });
  return { code: p.exitCode ?? 1, err: new TextDecoder().decode(p.stderr).trim() };
}

/**
 * Generate and install the systemd units for this instance: the long-running
 * `homestead start` service plus a timer + oneshot that run `homestead update`
 * on a cadence. Idempotent — re-running overwrites the units, so changing
 * `--update-interval` simply rewrites the timer. Requires root.
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
  // homestead would create the cache dir at runtime (it extracts its embedded
  // aepbase/sidecar binaries there), but that's too late — create both up front,
  // owned by the service user so the runtime extraction + db writes can proceed.
  ensureOwnedDir(cacheDir, opts.user);
  ensureOwnedDir(dataDir, opts.user);

  const params: RenderParams = {
    projectDir: project.root,
    serviceName: opts.serviceName,
    user: opts.user,
    port: opts.port,
    dataDir,
    intervalSeconds: opts.intervalSeconds,
    invocation: resolveInvocation(),
    cacheDir,
    envFile,
  };

  const units: Array<[string, string]> = [
    [`${opts.serviceName}.service`, renderMainService(params)],
    [`${opts.serviceName}-update.service`, renderUpdateService(params)],
    [`${opts.serviceName}-update.timer`, renderUpdateTimer(params)],
  ];
  for (const [name, body] of units) {
    const path = join(UNIT_DIR, name);
    writeFileSync(path, body, { mode: 0o644 });
    log(`wrote ${path}`);
  }

  const reload = run(['systemctl', 'daemon-reload']);
  if (reload.code !== 0) {
    console.error(`systemctl daemon-reload failed: ${reload.err}`);
    return 1;
  }
  // Enable (but don't start) the long-running service; enable + start the timer
  // so update checks begin immediately.
  run(['systemctl', 'enable', `${opts.serviceName}.service`]);
  run(['systemctl', 'enable', '--now', `${opts.serviceName}-update.timer`]);

  log('installed');
  console.log('');
  console.log('Next steps:');
  console.log(`  sudo systemctl start ${opts.serviceName}      # start the app`);
  console.log(`  sudo systemctl status ${opts.serviceName}     # check it`);
  console.log(`  sudo journalctl -u ${opts.serviceName} -f     # follow logs`);
  console.log('');
  console.log(`Update checks run every ${params.intervalSeconds}s via ${opts.serviceName}-update.timer.`);
  console.log(`  systemctl list-timers ${opts.serviceName}-update.timer`);
  // Surface the upstream the update unit will track, so the operator can sanity-check it.
  // Lazy import keeps the operator's config + module graph out of unit tests.
  const { gitConfig } = await import('./config.ts');
  const { remote, branch } = gitConfig();
  console.log(`  tracking ${remote}/${branch} (set via the \`git\` block in homestead.config.ts)`);
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
