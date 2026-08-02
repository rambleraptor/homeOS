/**
 * Minimal leveled logger for the server process.
 *
 * Two knobs, both env-driven so they need no config plumbing:
 *  - `HOMESTEAD_LOG_LEVEL` — `debug` | `info` | `warn` | `error` (default
 *    `info`). Anything below the threshold is dropped.
 *  - `HOMESTEAD_LOG_FORMAT` — `text` (default, one human-readable line) or
 *    `json` (one JSON object per line, for a log shipper).
 *
 * Each logger carries a `scope` (the old `[bracket]` tag) and takes an optional
 * structured-fields object; an `Error` passed in fields is rendered with its
 * stack. `warn`/`error` go to stderr, everything else to stdout. Both env vars
 * are read per call so tests (and a running operator) can change them live.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
  /** A sub-scoped logger, e.g. `createLogger('schema-sync').child('app-flags')`. */
  child(scope: string): Logger;
}

function threshold(): number {
  const raw = (process.env.HOMESTEAD_LOG_LEVEL ?? '').toLowerCase();
  return raw in RANK ? RANK[raw as LogLevel] : RANK.info;
}

function useJson(): boolean {
  return (process.env.HOMESTEAD_LOG_FORMAT ?? '').toLowerCase() === 'json';
}

/** Errors serialize to their stack (message-only fallback); other values pass through. */
function jsonFields(fields: LogFields): LogFields {
  const out: LogFields = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = v instanceof Error ? (v.stack ?? v.message) : v;
  }
  return out;
}

function renderText(
  time: string,
  level: LogLevel,
  scope: string,
  msg: string,
  fields: LogFields,
): string {
  let line = `${time} ${level.toUpperCase().padEnd(5)} [${scope}] ${msg}`;
  for (const [k, v] of Object.entries(fields)) {
    if (v instanceof Error) {
      line += `\n${v.stack ?? v.message}`;
    } else {
      line += ` ${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`;
    }
  }
  return line;
}

function sinkFor(level: LogLevel): (line: string) => void {
  if (level === 'error') return console.error;
  if (level === 'warn') return console.warn;
  return console.log;
}

function emit(scope: string, level: LogLevel, msg: string, fields?: LogFields): void {
  if (RANK[level] < threshold()) return;
  const time = new Date().toISOString();
  const sink = sinkFor(level);
  if (useJson()) {
    sink(JSON.stringify({ time, level, scope, msg, ...jsonFields(fields ?? {}) }));
  } else {
    sink(renderText(time, level, scope, msg, fields ?? {}));
  }
}

export function createLogger(scope: string): Logger {
  return {
    debug: (msg, fields) => emit(scope, 'debug', msg, fields),
    info: (msg, fields) => emit(scope, 'info', msg, fields),
    warn: (msg, fields) => emit(scope, 'warn', msg, fields),
    error: (msg, fields) => emit(scope, 'error', msg, fields),
    child: (sub) => createLogger(`${scope}:${sub}`),
  };
}

/** Default logger for top-level server code. */
export const log = createLogger('homestead');
