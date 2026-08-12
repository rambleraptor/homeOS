# Backup & Restore

Everything an instance stores lives in one **data directory** (`<project>/data`
by default, or wherever `--data-dir` points):

- `aepbase.db` — the main SQLite database (users, records, tokens, the migration
  ledger).
- `vectors.db` — the search/embedding index (rebuildable, but backed up anyway).
- `files/` — uploaded file-field bytes.

`homestead backup` archives all of it into a single `.tar.gz`; `homestead
restore` puts it back.

## Backing up

```bash
homestead backup
# wrote homestead-backup-20260812-140312.tar.gz
```

The databases are snapshotted with SQLite's `VACUUM INTO`, which writes a fully
checkpointed, consistent copy of the last committed state. That matters because
the databases run in [WAL mode](https://sqlite.org/wal.html): a plain `tar` of
the live directory can capture a **torn** snapshot — the `-wal` sidecar and the
main file read at different instants — that restores to a corrupt database. The
snapshot is taken from a separate connection, so **you can back up a running
instance** with no downtime and no torn state.

Flags:

- `--out=PATH` — archive path (default `homestead-backup-<timestamp>.tar.gz`).
- `--data-dir=PATH` — the data dir to archive (default `<project>/data`).

### The master key is not in the backup

With [encryption at rest](https://github.com/rambleraptor/homestead/blob/main/SECURITY.md)
enabled, the archived database and file bytes are **ciphertext** — safe to store
anywhere (another disk, object storage, a NAS). They are also **useless without
the master key**, which is deliberately *not* in the backup.

`homestead backup` refuses to run if the key file lives inside the data dir, and
reminds you to store the key separately. Keep it somewhere durable and distinct
from the archives — a password manager works well:

```bash
homestead key show    # prints the resolved master key
```

If you lose the key, an encrypted backup is unrecoverable. There is no recovery
path — this is the security trade-off, not a bug.

### Scheduling backups

`homestead backup` is a plain command, so schedule it however you like. A daily
cron entry that keeps the last 14 days:

```cron
0 3 * * * cd /srv/homestead && homestead backup --out "/backups/homestead-$(date -u +\%Y\%m\%d).tar.gz" && find /backups -name 'homestead-*.tar.gz' -mtime +14 -delete
```

Copy the archives off the box (and store the master key elsewhere again) so a
lost disk doesn't take the backups with it.

## Restoring

**Stop the server first.** Restoring under a live instance is unsupported — the
running server holds the databases open.

```bash
# systemd deployments:
sudo homestead stop

homestead restore homestead-backup-20260812-140312.tar.gz
```

Restore extracts the archive into the data dir and runs `PRAGMA
integrity_check` on each database, failing loudly if a database is corrupt.

By default it **refuses to overwrite a data dir that already contains a
database** — a restore replaces data, so it has to be deliberate:

- Restore into an empty/new `--data-dir`, **or**
- pass `--force` to overwrite the existing one. `--force` also clears any stale
  `-wal`/`-shm` sidecars first, so leftover write-ahead frames can't be applied
  on top of the restored files.

```bash
homestead restore backup.tar.gz --data-dir /srv/homestead/data --force
```

Then start the server again (`sudo homestead start-services`, or your usual
launch). The schema sync reconciles on boot as normal.

### Disaster recovery checklist

To bring an instance back on a fresh machine you need **two** things — they are
stored separately on purpose:

1. A backup archive (`homestead-backup-*.tar.gz`).
2. The **master key** (if encryption at rest is on).

Recovery:

```bash
# 1. Install the CLI and scaffold/clone the project as usual.
# 2. Make the master key resolvable (e.g. write it to ~/.homestead/master.key,
#    or set HOMESTEAD_MASTER_KEY / HOMESTEAD_MASTER_KEY_FILE).
# 3. Restore the data into a clean data dir.
homestead restore /path/to/backup.tar.gz
# 4. Start the server.
homestead start
```

A backup without its key restores fine but decrypts nothing; the key without a
backup recovers nothing. Test your recovery path before you need it.
