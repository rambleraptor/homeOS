# Backups & Restore

Homestead keeps everything in one data directory — the SQLite databases and
every uploaded file. `homestead backup` archives it; `homestead restore` puts
it back, or checks that it could.

```bash
homestead backup                                   # → homestead-backup-<timestamp>.tar.gz
homestead restore --from=homestead-backup-….tar.gz --verify
homestead restore --from=homestead-backup-….tar.gz --force
```

## Taking a backup

Run it from your project directory (it reads `<project>/data` by default, or
`--data-dir=PATH`):

```bash
homestead backup --out=/mnt/nas/homestead-2026-08-23.tar.gz
```

You can run it while the server is up. The databases are captured with
SQLite's `VACUUM INTO`, which takes a consistent point-in-time copy inside a
read transaction, so the archive never contains a half-written database or a
write-ahead log that has drifted from it. The live `.db`, `-wal`, and `-shm`
files are deliberately left out — the snapshot replaces them.

The archive is a plain `.tar.gz`. Members sit at the root, so extracting it
gives you a data directory directly:

```
homestead-backup.json      # manifest (see below)
aepbase.db                 # consistent snapshot
vectors.db                 # consistent snapshot
files/…                    # uploaded file bytes
```

## How sensitive is the archive?

More than you might expect, and `homestead backup` tells you which case you
are in when it finishes.

**With no master key**, encryption at rest is off and the archive is entirely
plaintext — your whole household database and every uploaded file. Store it
the way you'd store the data directory itself.

**With a master key**, encryption covers uploaded file bytes and
extracted-text columns. Everything else is still readable: structured fields
(names, amounts, card numbers), the search index in `vectors.db`, and the
account rows (password hashes, session tokens). So an encrypted-at-rest
archive is safer, but it is not safe to store just anywhere. See
[SECURITY.md](https://github.com/rambleraptor/homestead/blob/main/SECURITY.md)
for exactly what is and isn't encrypted.

The master key is never in the archive. `homestead backup` refuses to run if
your key file sits inside the data directory, because that would put the key
and the data it protects in the same tarball.

Because the default archive lands in the directory you run the command from —
usually your project, usually a git checkout — `homestead init` scaffolds a
`.gitignore` that covers it:

```
homestead-backup-*.tar.gz
*.pre-restore-*
```

If your project predates those lines, add them. Otherwise a stray `git add .`
commits your whole household to a repo, and rewriting that history afterwards
is a bad afternoon.

**Back the key up separately** — a password manager or a secrets store.
`homestead key show` prints it. Without it, the encrypted files in an archive
cannot be read, and there is no recovery path.

## The manifest

Every archive carries a `homestead-backup.json` describing itself:

| Field | What it's for |
| --- | --- |
| `format` | Manifest layout version; a newer archive refuses to restore on an older homestead. |
| `created_at`, `homestead_version` | When it was taken, and by which release. |
| `data_dir_name` | The data directory it came from. |
| `encryption.enabled` | Whether encryption at rest was on. |
| `encryption.key_id` | Which master key was in force — an HMAC fingerprint, never the key itself. |
| `databases` | Which members are database snapshots. |
| `files` | Every archived file with its size and SHA-256. |

The `key_id` is what stops the worst restore failure: putting an archive back
under a *different* master key, where the encrypted files come back as
undecryptable garbage instead of a clear error. `homestead key generate
--force` makes that possible, so restore checks the fingerprint first.

## Verifying an archive

An untested backup is not a backup. `--verify` runs every check a real restore
runs — extract, checksum every file against the manifest, integrity-check each
database, confirm the configured master key matches — and then throws the
extraction away without touching your data directory:

```bash
homestead restore --from=/mnt/nas/homestead-2026-08-23.tar.gz --verify
```

```
archive written 2026-08-23T22:34:16.615Z by homestead 0.2.0
  3 files match their checksums
  2 databases pass their integrity check
  master key matches the one this archive was written under

/mnt/nas/homestead-2026-08-23.tar.gz is intact and restorable.
```

Worth running against your newest archive on a schedule — it is the only thing
that turns "I have backups" into "I have backups that work".

## Restoring

Stop the server first, then:

```bash
homestead restore --from=/mnt/nas/homestead-2026-08-23.tar.gz --force
```

Restore runs every `--verify` check before it changes anything, so a damaged
archive, a corrupt database, or the wrong master key stops the restore with
your existing data untouched.

`--force` is required when the target data directory already holds data. Even
then nothing is deleted: the existing directory is renamed to
`<data-dir>.pre-restore-<timestamp>` and the restored one moves into place, so
a restore from the wrong archive is reversible. Delete the `.pre-restore-…`
copy yourself once you're satisfied.

Start the server afterwards; the schema sync runs on boot as usual.

### Flags

| Flag | |
| --- | --- |
| `--from=PATH` | Archive to restore. Required. |
| `--data-dir=PATH` | Where to restore to (default `<project>/data`). |
| `--verify` | Run the checks and restore nothing. |
| `--force` | Replace a non-empty data directory (renamed aside, not deleted). |
| `--allow-key-mismatch` | Restore even though the archive names a different master key. Only when you know why they differ. |

### When a check fails

- **"does not match its manifest"** — the archive is damaged, or a file changed
  while the backup ran. Nothing is restored. Use a different archive; if this is
  the only copy, extract it by hand with `tar` to salvage what is readable.
- **"no master key is configured here"** — the archive holds encrypted files.
  Put the key back (`HOMESTEAD_MASTER_KEY`, `HOMESTEAD_MASTER_KEY_FILE`, or
  `~/.homestead/master.key`) and retry.
- **"was written under master key …"** — the configured key isn't the one this
  archive belongs to. Find the original key, or pass `--allow-key-mismatch` if
  you expect the difference (its encrypted files will stay unreadable).
- **"has no homestead-backup.json"** — not a `homestead backup` archive, or one
  from before manifests. Extract it by hand if you trust it.

## What isn't backed up

The data directory only. Your project code — `homestead.config.ts`, the `apps/`
tree, `.env` — is not in the archive; keep that in git. A full rebuild is: check
out the project, restore the data directory, put the master key back, start the
server.
