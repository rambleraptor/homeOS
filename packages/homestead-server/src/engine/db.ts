/**
 * SQLite layer — port of the Go server's pkg/db/db.go. The DDL strings are
 * kept verbatim so the TS engine opens existing databases unchanged and new
 * databases are byte-identical in layout.
 */

import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Schema } from './types';
import { STANDARD_FIELDS } from './types';

export function openDb(dbPath: string): Database {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath, { create: true });
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA busy_timeout=5000');
  createMetaTables(db);
  return db;
}

function createMetaTables(db: Database): void {
  db.run(`
		CREATE TABLE IF NOT EXISTS _aep_resource_definitions (
			id TEXT PRIMARY KEY,
			singular TEXT NOT NULL UNIQUE,
			plural TEXT NOT NULL UNIQUE,
			description TEXT NOT NULL DEFAULT '',
			examples_json TEXT NOT NULL DEFAULT '{}',
			schema_json TEXT NOT NULL,
			parents_json TEXT NOT NULL DEFAULT '[]',
			enums_json TEXT NOT NULL DEFAULT '{}',
			file_fields_json TEXT NOT NULL DEFAULT '[]',
			create_time TEXT NOT NULL,
			update_time TEXT NOT NULL
		)
	`);
  // Migrate: add columns if missing (existing databases). No-ops on new DBs.
  // `user_settable_create` is a TS-engine addition: the Go server never
  // persisted it, which made the boot-time schema sync re-PATCH every
  // user-settable definition on every restart.
  for (const alter of [
    `ALTER TABLE _aep_resource_definitions ADD COLUMN description TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE _aep_resource_definitions ADD COLUMN examples_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE _aep_resource_definitions ADD COLUMN singleton INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE _aep_resource_definitions ADD COLUMN enums_json TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE _aep_resource_definitions ADD COLUMN file_fields_json TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE _aep_resource_definitions ADD COLUMN user_settable_create INTEGER NOT NULL DEFAULT 0`,
  ]) {
    try {
      db.run(alter);
    } catch {
      // duplicate column — already migrated
    }
  }
}

export function sanitizeTableName(name: string): string {
  return name.replaceAll('-', '_');
}

export function schemaTypeToSQLite(oasType: string | undefined): string {
  switch (oasType) {
    case 'integer':
      return 'INTEGER';
    case 'number':
      return 'REAL';
    case 'boolean':
      return 'INTEGER';
    case 'string':
      return 'TEXT';
    case 'binary':
      // File fields store a sentinel marker; contents live on disk.
      return 'TEXT';
    case 'object':
    case 'array':
      return 'TEXT';
    default:
      return 'TEXT';
  }
}

export interface ColumnDef {
  name: string;
  sqlType: string;
}

/** Column defs for user-defined properties only (standard fields excluded). */
export function userColumnsFromSchema(schema: Schema): ColumnDef[] {
  const cols: ColumnDef[] = [];
  for (const name of Object.keys(schema.properties ?? {}).sort()) {
    if (STANDARD_FIELDS.has(name)) continue;
    cols.push({ name, sqlType: schemaTypeToSQLite(schema.properties[name]?.type) });
  }
  return cols;
}

export function createResourceTable(
  db: Database,
  plural: string,
  parents: string[],
  columns: ColumnDef[],
): void {
  const tableName = sanitizeTableName(plural);
  const cols = [
    'id TEXT PRIMARY KEY',
    'path TEXT NOT NULL UNIQUE',
    'create_time TEXT NOT NULL',
    'update_time TEXT NOT NULL',
  ];
  for (const p of parents) {
    cols.push(`${sanitizeTableName(p)}_id TEXT NOT NULL`);
  }
  for (const c of columns) {
    cols.push(`${c.name} ${c.sqlType}`);
  }
  db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${cols.join(',\n  ')}\n)`);
  for (const p of parents) {
    const colName = `${sanitizeTableName(p)}_id`;
    db.run(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${colName} ON ${tableName}(${colName})`);
  }
}

export function dropResourceTable(db: Database, plural: string): void {
  db.run(`DROP TABLE IF EXISTS ${sanitizeTableName(plural)}`);
}

export function addColumn(db: Database, plural: string, col: ColumnDef): void {
  db.run(`ALTER TABLE ${sanitizeTableName(plural)} ADD COLUMN ${col.name} ${col.sqlType}`);
}

/** Drop columns via table-recreate (SQLite), preserving standard + parent cols. */
export function removeColumns(
  db: Database,
  plural: string,
  parents: string[],
  keepColumns: ColumnDef[],
): void {
  const tableName = sanitizeTableName(plural);
  const cols = [
    'id TEXT PRIMARY KEY',
    'path TEXT NOT NULL UNIQUE',
    'create_time TEXT NOT NULL',
    'update_time TEXT NOT NULL',
  ];
  const colNames = ['id', 'path', 'create_time', 'update_time'];
  for (const p of parents) {
    const colName = `${sanitizeTableName(p)}_id`;
    cols.push(`${colName} TEXT NOT NULL`);
    colNames.push(colName);
  }
  for (const c of keepColumns) {
    cols.push(`${c.name} ${c.sqlType}`);
    colNames.push(c.name);
  }

  const tmpTable = `${tableName}_new`;
  const tx = db.transaction(() => {
    db.run(`CREATE TABLE ${tmpTable} (\n  ${cols.join(',\n  ')}\n)`);
    db.run(
      `INSERT INTO ${tmpTable} (${colNames.join(', ')}) SELECT ${colNames.join(', ')} FROM ${tableName}`,
    );
    db.run(`DROP TABLE ${tableName}`);
    db.run(`ALTER TABLE ${tmpTable} RENAME TO ${tableName}`);
    for (const p of parents) {
      const colName = `${sanitizeTableName(p)}_id`;
      db.run(
        `CREATE INDEX IF NOT EXISTS idx_${tableName}_${colName} ON ${tableName}(${colName})`,
      );
    }
  });
  tx();
}
