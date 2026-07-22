# Security: encryption at rest

Homestead can encrypt uploaded file bytes and extracted-text columns at rest so
that a stolen disk, database dump, or backup is unreadable. This document
describes the trust model, how keys work, and the operator's responsibilities.

## Threat model

The design protects **data at rest** under a **trusted server**:

- **Protects against:** theft of the data directory, the SQLite database, or a
  backup — anything obtained without the running server's memory. All of it is
  ciphertext without the master key.
- **Does NOT protect against:** a compromised running server, root on the host,
  or the operator. The server holds the master key and decrypts on demand, so
  whoever controls the live server can read the data. This is a deliberate
  trade: it keeps server-side features (AI text extraction, chat over file
  contents) working and keeps password reset painless.

If you need files to be unreadable even to a compromised server or the operator,
this feature is not that — it does not implement end-to-end encryption.

## What is encrypted

- **File-field bytes** on disk (`data/files/...`).
- **Extracted-text companion columns** (`<field>_text`) in the database.

Structured fields (names, amounts, titles) are **not** encrypted.

### Known residual: the vector store

Extracted text is also written to the vector store as plaintext passages plus
embeddings, to power keyword and semantic search. Encrypting those would break
search, so — like the canonical column being encrypted while its search index
is not — the vector store is left as **cleartext guarded by the same database
access controls** as everything else. Treat it as a defense-in-depth surface,
not an encrypted one.

## How it works

Envelope encryption, per item:

1. A fresh random 32-byte **data-encryption key (DEK)** encrypts the bytes with
   AES-256-GCM.
2. A per-item **key-encryption key (KEK)**, derived from the master key and the
   resource path (HMAC-SHA256), wraps the DEK. Keying on the resource path gives
   per-resource isolation and lets a future master-key rotation re-wrap DEKs
   without re-encrypting the bulk data.

The wrapped DEK travels in a self-describing container alongside the ciphertext.
An authoritative database marker records whether an item is encrypted
(`enc:v1` for files, an `enc:v1:` prefix for text); the container magic is a
secondary cross-check. Legacy plaintext is detected and passes through
unchanged, so encryption can be turned on for an existing instance and data
migrates lazily as it is rewritten. Anything that cannot be decrypted **fails
closed** — the server errors rather than serving ciphertext as content.

## The master key

A single 32-byte key per instance, supplied via the environment:

- `HOMESTEAD_MASTER_KEY` — base64-encoded key (handy for containers), or
- `HOMESTEAD_MASTER_KEY_FILE` — path to a file containing the same.

Encryption is **opt-in**: with no key configured the server behaves exactly as
before (plaintext). New writes are encrypted once the server sees a key.

### Operator rules

1. **Keep the key out of the data directory and out of backups.** If the key is
   captured alongside the data, the encryption is worthless. `homestead doctor`
   fails if the key file sits inside the data dir.
2. **Back the key up separately** — a password manager or secrets store. If you
   lose it, encrypted data is unrecoverable; there is no recovery path.
3. **Lock the key file to `0600`.** `homestead key generate` does this;
   `homestead doctor` warns if it drifts.

## Tooling

```bash
homestead key generate      # write ~/.homestead/master.key (0600), refuse to clobber
homestead key show          # print the resolved key, to copy into a password manager
homestead backup            # archive the data dir as ciphertext; refuses to include the key
homestead doctor            # checks key presence, location, and permissions
```

Wire the key into a systemd deployment by adding
`HOMESTEAD_MASTER_KEY_FILE=/path/to/master.key` to the unit's `.env`
(the generated service already loads it via `EnvironmentFile`).

## Related hardening

Resetting the superuser password (`homestead admin reset-password`) now revokes
that user's existing session tokens, so sessions minted under the old password
stop working.
