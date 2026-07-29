/**
 * One-off, idempotent backfill: normalize legacy bare-id reference values to
 * the standard `{plural}/{id}` path format.
 *
 * Most reference fields already store paths; this only rewrites the fields that
 * historically stored a bare id — the people graph (`person_a`, `person_b`,
 * `address_id`, `shared_data_id`), grocery `store`, and `operation.created_by`.
 *
 * Safe to run anytime and repeatedly: the app's read paths (and the engine's
 * `onDelete` matching) are format-agnostic via `refToId`, so this is a
 * consistency pass, not a correctness prerequisite. Records already in path
 * format (value contains `/`) or empty are skipped.
 *
 * Usage (same box as a running server):
 *   AEPBASE_URL=http://127.0.0.1:<port>/api/aep \
 *   HOMESTEAD_TOKEN=<bearer> \
 *   bun scripts/backfill-reference-paths.ts [--dry-run]
 *   # or: npx tsx scripts/backfill-reference-paths.ts [--dry-run]
 *
 * The token needs read+write on the target collections (an admin token covers
 * all of them). Override the server with --server-url=<url-including-/api/aep>.
 */

interface FieldMigration {
  /** Collection to scan. */
  plural: string;
  /** Reference field on it to normalize. */
  field: string;
  /** Target collection plural — becomes the `{target}/{id}` prefix. */
  target: string;
}

/**
 * Only the fields that historically stored a bare id. Every other reference
 * (`created_by` elsewhere, hsa `person`, events `people`, games `players`,
 * todos `project`, `source_document`) already stores a path.
 */
const MIGRATIONS: FieldMigration[] = [
  { plural: 'person-shared-data', field: 'person_a', target: 'people' },
  { plural: 'person-shared-data', field: 'person_b', target: 'people' },
  { plural: 'person-shared-data', field: 'address_id', target: 'addresses' },
  { plural: 'addresses', field: 'shared_data_id', target: 'person-shared-data' },
  { plural: 'groceries', field: 'store', target: 'stores' },
  { plural: 'operations', field: 'created_by', target: 'users' },
];

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

const dryRun = process.argv.includes('--dry-run');

// AEPBASE_URL is read at import time by the server helper, so set any override
// before importing it.
const serverUrl = arg('server-url');
if (serverUrl) process.env.AEPBASE_URL = serverUrl;

async function main(): Promise<void> {
  const token = arg('token') || process.env.HOMESTEAD_TOKEN;
  if (!token) {
    console.error(
      'Missing token. Pass --token=<bearer> or set HOMESTEAD_TOKEN.',
    );
    process.exit(1);
  }

  const { aepList, aepUpdate } = await import(
    '../packages/homestead-core/server/aepbase.ts'
  );

  let totalPatched = 0;
  for (const m of MIGRATIONS) {
    let records: Array<Record<string, unknown> & { id: string }>;
    try {
      records = await aepList(m.plural, token);
    } catch (err) {
      console.error(`skip ${m.plural}.${m.field}: could not list — ${String(err)}`);
      continue;
    }

    let patched = 0;
    for (const rec of records) {
      const value = rec[m.field];
      // Only bare, non-empty string ids: already-path values contain '/'.
      if (typeof value !== 'string' || !value || value.includes('/')) continue;
      const next = `${m.target}/${value}`;
      if (dryRun) {
        console.log(`[dry-run] ${m.plural}/${rec.id}: ${m.field} ${value} → ${next}`);
      } else {
        await aepUpdate(m.plural, rec.id, { [m.field]: next }, token);
      }
      patched++;
    }
    totalPatched += patched;
    console.log(
      `${m.plural}.${m.field}: ${patched} record(s) ${dryRun ? 'would be' : ''} normalized ` +
        `(of ${records.length} scanned)`,
    );
  }

  console.log(
    `\n${dryRun ? 'Would normalize' : 'Normalized'} ${totalPatched} reference value(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
