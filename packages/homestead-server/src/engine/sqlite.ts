/**
 * Runtime-portable SQLite driver: `bun:sqlite` under Bun, the built-in
 * `node:sqlite` under Node. Exposes the (small) bun:sqlite surface the
 * engine uses — `run`, `query().get/all/run`, `transaction`, `close` — so
 * call sites are identical on both runtimes.
 *
 * Differences papered over here:
 *  - node:sqlite has no `transaction()` helper (explicit BEGIN/COMMIT)
 *  - node:sqlite's `get()` returns undefined for no-row (bun returns null)
 *  - node:sqlite rejects boolean/undefined bind params
 */

import { createRequire } from 'node:module';

const requireModule = createRequire(import.meta.url);

export type SqlParam = string | number | bigint | boolean | null | undefined | Uint8Array;

export interface RunResult {
  changes: number | bigint;
  lastInsertRowid: number | bigint;
}

export interface Statement {
  get(...params: SqlParam[]): unknown;
  all(...params: SqlParam[]): unknown[];
  run(...params: SqlParam[]): RunResult;
}

export interface Database {
  query(sql: string): Statement;
  run(sql: string, ...params: SqlParam[]): void;
  transaction<T>(fn: () => T): () => T;
  close(): void;
}

interface DatabaseCtor {
  new (path: string, options?: { create?: boolean }): Database;
}

// --- node:sqlite implementation ---

interface NodeStatementSync {
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): RunResult;
}

interface NodeDatabaseSync {
  prepare(sql: string): NodeStatementSync;
  exec(sql: string): void;
  close(): void;
}

function bindable(params: SqlParam[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function nodeDatabaseClass(): DatabaseCtor {
  const { DatabaseSync } = requireModule('node:sqlite') as {
    DatabaseSync: new (path: string) => NodeDatabaseSync;
  };

  class NodeStatement implements Statement {
    constructor(private readonly stmt: NodeStatementSync) {}
    get(...params: SqlParam[]): unknown {
      return this.stmt.get(...bindable(params)) ?? null;
    }
    all(...params: SqlParam[]): unknown[] {
      return this.stmt.all(...bindable(params));
    }
    run(...params: SqlParam[]): RunResult {
      return this.stmt.run(...bindable(params));
    }
  }

  class NodeDatabase implements Database {
    private readonly db: NodeDatabaseSync;
    constructor(path: string, _options?: { create?: boolean }) {
      this.db = new DatabaseSync(path);
    }
    query(sql: string): Statement {
      return new NodeStatement(this.db.prepare(sql));
    }
    run(sql: string, ...params: SqlParam[]): void {
      if (params.length === 0) {
        this.db.exec(sql);
      } else {
        this.db.prepare(sql).run(...bindable(params));
      }
    }
    transaction<T>(fn: () => T): () => T {
      return () => {
        this.db.exec('BEGIN');
        try {
          const result = fn();
          this.db.exec('COMMIT');
          return result;
        } catch (err) {
          this.db.exec('ROLLBACK');
          throw err;
        }
      };
    }
    close(): void {
      this.db.close();
    }
  }

  return NodeDatabase;
}

export const Database: DatabaseCtor = process.versions.bun
  ? (requireModule('bun:sqlite').Database as DatabaseCtor)
  : nodeDatabaseClass();
