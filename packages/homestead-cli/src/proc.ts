import { spawn, type ChildProcess } from 'node:child_process';

export interface SpawnOptions {
  /** argv; cmd[0] is the executable (absolute path or resolved on PATH). */
  cmd: string[];
  cwd?: string;
  /** Extra env merged over process.env. Undefined values are dropped. */
  env?: Record<string, string | undefined>;
  /** Line prefix for multiplexed logs, e.g. "[sidecar]". */
  tag: string;
}

/**
 * A spawned child with prefixed log piping and graceful shutdown. Mirrors the
 * Go launcher's internal/proc: SIGTERM, escalating to SIGKILL after a deadline.
 * Built on node:child_process so the launcher runs under Bun and Node alike.
 */
export class Child {
  readonly proc: ChildProcess;
  private readonly exited: Promise<number>;
  private readonly pumps: Promise<void>[];
  private stopping = false;

  constructor(opts: SpawnOptions) {
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...process.env, ...opts.env })) {
      if (v !== undefined) env[k] = v;
    }
    this.proc = spawn(opts.cmd[0]!, opts.cmd.slice(1), {
      cwd: opts.cwd,
      env,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    this.exited = new Promise<number>((resolve) => {
      // A spawn failure (missing executable) emits 'error' and never 'exit'.
      this.proc.once('error', () => resolve(1));
      this.proc.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    this.pumps = [
      pipePrefixed(this.proc.stdout, opts.tag),
      pipePrefixed(this.proc.stderr, opts.tag),
    ];
  }

  /** Resolves with the exit code once the process and its log pumps finish. */
  async wait(): Promise<number> {
    const code = await this.exited;
    await Promise.allSettled(this.pumps);
    return code;
  }

  /** SIGTERM, escalating to SIGKILL after `graceMs`. Idempotent. */
  async stop(graceMs = 15_000): Promise<void> {
    if (this.stopping) {
      await this.exited;
      return;
    }
    this.stopping = true;
    try {
      this.proc.kill('SIGTERM');
    } catch {
      // already gone
    }
    const timer = setTimeout(() => {
      try {
        this.proc.kill('SIGKILL');
      } catch {
        // already gone
      }
    }, graceMs);
    await this.exited;
    clearTimeout(timer);
    await Promise.allSettled(this.pumps);
  }
}

export function spawnChild(opts: SpawnOptions): Child {
  return new Child(opts);
}

/** Streams a child's output to the console, one tagged line at a time. */
async function pipePrefixed(
  stream: AsyncIterable<Buffer | Uint8Array> | null,
  tag: string,
): Promise<void> {
  if (!stream) return;
  const decoder = new TextDecoder();
  let buf = '';
  const flush = (line: string) => process.stdout.write(`${tag} ${line}\n`);
  for await (const chunk of stream) {
    buf += decoder.decode(chunk, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      flush(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
    }
  }
  if (buf.length > 0) flush(buf);
}
