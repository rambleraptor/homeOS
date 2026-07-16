/**
 * SQLite layer — port of the Go server's pkg/db/db.go. The DDL strings are
 * kept verbatim so the TS engine opens existing databases unchanged and new
 * databases are byte-identical in layout.
 */

import { Database } from './sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Schema, SchemaProperty } from './types';
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
    `ALTER TABLE _aep_resource_definitions ADD COLUMN superuser_write INTEGER NOT NULL DEFAULT 0`,
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
  /**
   * SQL expression for a derived column, e.g. `json_extract(metadata, '$.x')`.
   * Set only for the columns projected out of a tagged-union object field.
   *
   * Derived columns exist purely so `filter` can reach into a union's fields
   * with a real index; reads never select them (`store.ts` builds its column
   * list from the schema's top-level properties), so they cost nothing per row.
   */
  generatedFrom?: string;
}

/** Render a column for DDL, including the generated-column clause if derived. */
function columnSql(c: ColumnDef): string {
  return c.generatedFrom
    ? // VIRTUAL, not STORED: SQLite rejects `ALTER TABLE ... ADD COLUMN` for
      // STORED, so VIRTUAL is the only form that can be added to a live table.
      // Uniform VIRTUAL keeps a rebuilt table identical to an altered one.
      `${c.name} ${c.sqlType} GENERATED ALWAYS AS (${c.generatedFrom}) VIRTUAL`
    : `${c.name} ${c.sqlType}`;
}

/** Identifiers safe to interpolate into a generated-column JSON path. */
const SAFE_FIELD_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Derived columns for a tagged-union object property: one per distinct field
 * name across all variants, plus the discriminator tag itself.
 *
 * A field name used by several variants yields a single shared column — the
 * authoring layer guarantees such fields agree on type (see
 * `validateVariants` in homestead-core's translate.ts).
 */
export interface DerivedColumnDef extends ColumnDef {
  generatedFrom: string;
  /** The filter path this column answers, e.g. `metadata.box_1_interest`. */
  path: string;
}

function unionColumns(propName: string, prop: SchemaProperty): DerivedColumnDef[] {
  if (!prop.oneOf || !prop.discriminator) return [];
  if (!SAFE_FIELD_RE.test(propName)) return [];

  const derive = (name: string, type: string | undefined): DerivedColumnDef => ({
    name,
    sqlType: schemaTypeToSQLite(type),
    generatedFrom: `json_extract(${propName}, '$.${name}')`,
    path: `${propName}.${name}`,
  });

  const byName = new Map<string, DerivedColumnDef>();
  const tag = prop.discriminator.propertyName;
  if (SAFE_FIELD_RE.test(tag)) byName.set(tag, derive(tag, 'string'));

  for (const variant of prop.oneOf) {
    for (const [name, sub] of Object.entries(variant.properties ?? {})) {
      if (name === tag || byName.has(name)) continue;
      if (!SAFE_FIELD_RE.test(name)) continue;
      byName.set(name, derive(name, sub?.type));
    }
  }
  return [...byName.values()];
}

/**
 * The derived columns a schema projects out of its tagged-union object fields.
 *
 * The single source of truth for union projection: `userColumnsFromSchema`
 * creates exactly these columns and `compileFilter` resolves exactly their
 * paths, so the two can never drift apart.
 *
 * A real column always wins a name clash with a derived one, and the first
 * union to claim a name keeps it. The authoring layer rejects both clashes up
 * front (see `validateVariants` in homestead-core), so this is a defensive
 * tiebreak for definitions posted straight to the meta API.
 */
export function derivedColumnsFromSchema(schema: Schema): DerivedColumnDef[] {
  const taken = new Set(
    Object.keys(schema.properties ?? {}).filter((n) => !STANDARD_FIELDS.has(n)),
  );
  const out: DerivedColumnDef[] = [];
  for (const name of Object.keys(schema.properties ?? {}).sort()) {
    const prop = schema.properties[name];
    if (!prop) continue;
    for (const c of unionColumns(name, prop)) {
      if (taken.has(c.name) || STANDARD_FIELDS.has(c.name)) continue;
      taken.add(c.name);
      out.push(c);
    }
  }
  return out;
}

/**
 * Column defs for user-defined properties only (standard fields excluded),
 * plus the derived columns projected out of any tagged-union object field.
 */
export function userColumnsFromSchema(schema: Schema): ColumnDef[] {
  const cols: ColumnDef[] = [];
  for (const name of Object.keys(schema.properties ?? {}).sort()) {
    if (STANDARD_FIELDS.has(name)) continue;
    cols.push({ name, sqlType: schemaTypeToSQLite(schema.properties[name]?.type) });
  }
  cols.push(...derivedColumnsFromSchema(schema));
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
    cols.push(columnSql(c));
  }
  db.run(`CREATE TABLE IF NOT EXISTS ${tableName} (\n  ${cols.join(',\n  ')}\n)`);
  for (const p of parents) {
    const colName = `${sanitizeTableName(p)}_id`;
    db.run(`CREATE INDEX IF NOT EXISTS idx_${tableName}_${colName} ON ${tableName}(${colName})`);
  }
  indexGeneratedColumns(db, tableName, columns);
}

/**
 * Index each derived column — the whole point of projecting them out of the
 * JSON blob is that `filter` can seek rather than scan.
 */
function indexGeneratedColumns(
  db: Database,
  tableName: string,
  columns: ColumnDef[],
): void {
  for (const c of columns) {
    if (!c.generatedFrom) continue;
    db.run(
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_${c.name} ON ${tableName}(${c.name})`,
    );
  }
}

export function dropResourceTable(db: Database, plural: string): void {
  db.run(`DROP TABLE IF EXISTS ${sanitizeTableName(plural)}`);
}

export function addColumn(db: Database, plural: string, col: ColumnDef): void {
  const tableName = sanitizeTableName(plural);
  db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql(col)}`);
  indexGeneratedColumns(db, tableName, [col]);
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
    cols.push(columnSql(c));
    // Derived columns are recomputed from their source column, and SQLite
    // rejects an INSERT that targets one — so they're declared but not copied.
    if (!c.generatedFrom) colNames.push(c.name);
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
    indexGeneratedColumns(db, tableName, keepColumns);
  });
  tx();
}
