import { loadProject } from './project.ts';

export interface UpdateOptions {
  /** Project directory (the git checkout). Defaults to CWD via runUpdate. */
  projectDir: string;
  /** systemd service to restart after a successful pull. */
  serviceName: string;
  /** Rebuild/restart even when the checkout is already up to date. */
  force: boolean;
  /** Restart the service after pulling. Off => just sync the checkout. */
  restart: boolean;
}

interface RunResult {
  code: number;
  out: string;
  err: string;
}

/** Run a command synchronously, capturing trimmed stdout/stderr. */
function run(cmd: string[], cwd: string): RunResult {
  const p = Bun.spawnSync({ cmd, cwd, stdout: 'pipe', stderr: 'pipe' });
  const dec = new TextDecoder();
  return {
    code: p.exitCode ?? 1,
    out: dec.decode(p.stdout).trim(),
    err: dec.decode(p.stderr).trim(),
  };
}

/**
 * The checkout needs updating when its HEAD differs from the tracked upstream.
 * The server is a pure consumer of the config repo, so any divergence (behind
 * or, after a force-push, rewritten) is resolved by hard-resetting to upstream.
 */
export function needsUpdate(localHead: string, remoteHead: string): boolean {
  return localHead !== remoteHead;
}

/** `systemctl` argv, prefixed with sudo unless we're already root. */
function systemctl(args: string[]): string[] {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  return isRoot ? ['systemctl', ...args] : ['sudo', 'systemctl', ...args];
}

/** Restart the service and confirm it came back up. */
function restartService(name: string, cwd: string): boolean {
  const r = run(systemctl(['restart', name]), cwd);
  if (r.code !== 0) {
    log(`failed to restart ${name}: ${r.err || r.out || `exit ${r.code}`}`);
    return false;
  }
  // is-active --quiet exits 0 only when the unit is running.
  return run(systemctl(['is-active', '--quiet', name]), cwd).code === 0;
}

/**
 * Fetch the tracked upstream and, when the checkout is behind, fast-forward to
 * it and restart the service so the launcher re-reads homestead.config.ts. If
 * the restart fails (e.g. a bad config was pushed from a phone), roll the
 * checkout back to the previous commit and restart again so the box stays up.
 */
export async function runUpdate(opts: UpdateOptions): Promise<number> {
  const project = loadProject(opts.projectDir);
  const root = project.root;

  if (run(['git', 'rev-parse', '--git-dir'], root).code !== 0) {
    log(`${root} is not a git repository — nothing to update`);
    return 1;
  }

  // Lazy so importing this app (e.g. in tests) doesn't pull in the operator's
  // config + app graph; only `runUpdate` needs it.
  const { gitConfig } = await import('./config.ts');
  const { remote, branch } = gitConfig();
  const ref = `${remote}/${branch}`;

  const localHead = run(['git', 'rev-parse', 'HEAD'], root).out;
  log(`current ${localHead.slice(0, 12)} (tracking ${ref})`);

  const fetch = run(['git', 'fetch', remote, branch], root);
  if (fetch.code !== 0) {
    // Don't fail the timer on a transient network hiccup; try again next tick.
    log(`fetch failed: ${fetch.err || fetch.out || `exit ${fetch.code}`}`);
    return 0;
  }

  const remoteHead = run(['git', 'rev-parse', ref], root).out;

  if (!opts.force && !needsUpdate(localHead, remoteHead)) {
    log('already up to date');
    return 0;
  }

  if (needsUpdate(localHead, remoteHead)) {
    log(`updating to ${remoteHead.slice(0, 12)}`);
    const reset = run(['git', 'reset', '--hard', ref], root);
    if (reset.code !== 0) {
      log(`reset failed: ${reset.err || reset.out || `exit ${reset.code}`}`);
      return 1;
    }
  } else {
    log('forced restart (no new commits)');
  }

  if (!opts.restart) {
    log('checkout synced (restart skipped)');
    return 0;
  }

  log(`restarting ${opts.serviceName}`);
  if (restartService(opts.serviceName, root)) {
    log('update complete');
    return 0;
  }

  // Restart failed — recover to the last known-good commit.
  if (needsUpdate(localHead, remoteHead)) {
    log(`rolling back to ${localHead.slice(0, 12)}`);
    run(['git', 'reset', '--hard', localHead], root);
    restartService(opts.serviceName, root);
  }
  return 1;
}

function log(msg: string): void {
  console.log(`[homestead] ${msg}`);
}
