#!/usr/bin/env bun
import { scaffold } from './scaffold.ts';
import { runDoctor, hasFailures, type Check } from './doctor.ts';

async function main(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  switch (sub) {
    case undefined:
    case 'help':
    case '-h':
    case '--help':
      printUsage();
      return 0;
    case 'start':
      return startCmd(rest);
    case 'init':
      return initCmd(rest);
    case 'doctor':
      return doctorCmd(rest);
    case 'update':
      return updateCmd(rest);
    case 'install-service':
      return installServiceCmd(rest);
    default:
      printUsage();
      console.error(`\nunknown subcommand ${JSON.stringify(sub)}`);
      return 1;
  }
}

async function startCmd(args: string[]): Promise<number> {
  const { flags } = parseFlags(args, new Set(['dev']));
  // Lazy import: only `start` needs the (heavy) config + module graph.
  const { runStart } = await import('./supervisor.ts');
  await runStart('.', {
    dev: flags.dev === true,
    frontendPort: numFlag(flags.port, 3000),
    aepbasePort: numFlag(flags['aepbase-port'], 8090),
    sidecarPort: numFlag(flags['sidecar-port'], 4000),
    dataDir: typeof flags['data-dir'] === 'string' ? flags['data-dir'] : undefined,
  });
  return 0;
}

function initCmd(args: string[]): number {
  const { positionals } = parseFlags(args);
  const root = scaffold(positionals[0] ?? '.');
  console.log(`scaffolded Homestead project at ${root}\n`);
  console.log('Next steps:');
  console.log(`  cd ${root}`);
  console.log('  homestead start --dev\n');
  console.log('Edit homestead.config.ts to pick which modules ship.');
  return 0;
}

async function doctorCmd(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const checks = await runDoctor({
    projectDir: '.',
    frontendPort: numFlag(flags.port, 3000),
    aepbasePort: numFlag(flags['aepbase-port'], 8090),
  });
  for (const c of checks) console.log(formatCheck(c));
  console.log();
  if (hasFailures(checks)) {
    console.log('✗ doctor found failures — fix the items above before `homestead start`');
    return 1;
  }
  console.log('✓ ready for `homestead start`');
  return 0;
}

async function updateCmd(args: string[]): Promise<number> {
  const { flags } = parseFlags(args, new Set(['force', 'no-restart']));
  const { runUpdate } = await import('./update.ts');
  return runUpdate({
    projectDir: '.',
    serviceName: strFlag(flags['service-name'], 'homestead'),
    force: flags.force === true,
    restart: flags['no-restart'] !== true,
  });
}

async function installServiceCmd(args: string[]): Promise<number> {
  const { flags } = parseFlags(args);
  const { installServices, parseInterval } = await import('./service.ts');
  let intervalSeconds: number;
  try {
    intervalSeconds = parseInterval(strFlag(flags['update-interval'], '5m'));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 1;
  }
  return installServices({
    projectDir: '.',
    serviceName: strFlag(flags['service-name'], 'homestead'),
    user:
      strFlag(flags.user, process.env.SUDO_USER ?? process.env.USER ?? 'root'),
    port: numFlag(flags.port, 3000),
    dataDir: typeof flags['data-dir'] === 'string' ? flags['data-dir'] : undefined,
    intervalSeconds,
    envFile: typeof flags['env-file'] === 'string' ? flags['env-file'] : undefined,
  });
}

function formatCheck(c: Check): string {
  const mark = c.status === 'ok' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
  return `  ${mark}  ${c.name.padEnd(16)}  ${c.detail}`;
}

function printUsage(): void {
  console.log(
    [
      'homestead — run a Homestead instance from a single binary.',
      '',
      'Usage:',
      '  homestead init [<dir>]      Scaffold a new project (homestead.config.ts + modules/).',
      '  homestead start [--dev]     Boot aepbase + sidecar + SPA using homestead.config.ts in CWD.',
      '  homestead doctor            Check whether the host can run `homestead start`.',
      '  homestead update            Pull the tracked config repo; restart the service if it changed.',
      '  homestead install-service   Install the systemd service + auto-update timer (run with sudo).',
      '',
      'Flags for `start`:',
      '  --dev                       Serve the SPA via Vite (HMR) instead of the embedded build.',
      '  --port=N                    User-facing port (default 3000).',
      '  --aepbase-port=N            aepbase port, loopback (default 8090).',
      '  --sidecar-port=N            sidecar port, loopback (default 4000).',
      '  --data-dir=PATH             aepbase data dir (default <project>/data).',
      '',
      'Flags for `update`:',
      '  --service-name=NAME         systemd service to restart (default homestead).',
      '  --no-restart                Sync the checkout but do not restart the service.',
      '  --force                     Restart even when there are no new commits.',
      '',
      'Flags for `install-service`:',
      '  --update-interval=DUR       Auto-update cadence: 30s, 5m, 2h, or bare minutes (default 5m).',
      '  --service-name=NAME         Base unit name (default homestead).',
      '  --user=NAME                 User the units run as (default $SUDO_USER).',
      '  --port=N                    App port baked into the service (default 3000).',
      '  --data-dir=PATH             aepbase data dir (default <project>/data).',
      '  --env-file=PATH             EnvironmentFile for the units (default <project>/.env if present).',
    ].join('\n'),
  );
}

interface ParsedFlags {
  flags: Record<string, string | boolean>;
  positionals: string[];
}

/** Minimal flag parser: --flag, --flag=value, --flag value. */
function parseFlags(args: string[], booleans = new Set<string>()): ParsedFlags {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) {
      positionals.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq !== -1) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const name = a.slice(2);
    const next = args[i + 1];
    if (!booleans.has(name) && next !== undefined && !next.startsWith('--')) {
      flags[name] = next;
      i++;
    } else {
      flags[name] = true;
    }
  }
  return { flags, positionals };
}

function numFlag(v: string | boolean | undefined, def: number): number {
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return def;
}

function strFlag(v: string | boolean | undefined, def: string): string {
  return typeof v === 'string' ? v : def;
}

process.exit(await main(process.argv.slice(2)));
