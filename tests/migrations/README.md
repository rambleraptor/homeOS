# PocketBase Migration Tests

This directory contains automated tests for PocketBase database migrations. These tests ensure that all migrations run successfully and create the expected database schema.

## What These Tests Do

The migration test suite:

1. **Downloads PocketBase** - Automatically downloads PocketBase v0.34.2 for your platform
2. **Applies Migrations** - Copies migrations from `pb_migrations/` and runs them
3. **Verifies Startup** - Ensures PocketBase starts without crashing
4. **Checks Health** - Calls the health endpoint to verify the server is responsive
5. **Validates Schema** - Confirms all expected collections and fields exist

## Requirements

- Node.js 18+ (uses ES modules and built-in fetch)
- `unzip` command-line tool (usually pre-installed on Linux/macOS)
- Internet connection (to download PocketBase binary)

## Running the Tests

From the **project root**:

```bash
npm test --prefix tests/migrations
```

Or from the **tests/migrations directory**:

```bash
npm test
```

## What Gets Tested

### Collections

The tests verify that these collections are created:

- ✅ `users` - Built-in PocketBase users collection
- ✅ `gift_cards` - Custom gift cards collection with all required fields

### Gift Cards Schema

The tests validate the `gift_cards` collection has these fields:

- `merchant` (text, required)
- `card_number` (text, required)
- `pin` (text, optional)
- `amount` (number, required)
- `notes` (text, optional)
- `created_by` (relation to users)

### Automatic Fields

PocketBase automatically adds these fields to all collections:

- `id` - Unique identifier
- `created` - Creation timestamp
- `updated` - Last update timestamp

## Test Output

Successful test output looks like this:

```
🧪 PocketBase Migration Test Suite

   Version: 0.34.2
   Platform: linux x64

==================================================

🔧 Setting up PocketBase for testing...

📥 Downloading from https://github.com/pocketbase/pocketbase/...
✓ Download complete
📦 Extracting pocketbase.zip...
✓ Extraction complete
✓ Made PocketBase executable
📋 Copying migrations...
✓ Copied 2 migration(s):
  - 1733932805_gift_cards_collection.js
  - 1765564350_fix_gift_cards_dates.js

🚀 Starting PocketBase...

> Server started at http://127.0.0.1:8091
  - REST API: http://127.0.0.1:8091/api/
  - Admin UI: http://127.0.0.1:8091/_/

🏥 Checking PocketBase health...

✓ Health check passed
  Status: OK

📊 Verifying collections...

✓ Found 2 collection(s):
  - users (auth)
  - gift_cards (base)

✓ All expected collections exist

  gift_cards fields: merchant, card_number, pin, amount, notes, created_by
  ✓ All expected fields present

==================================================

✅ All migration tests passed!

🛑 Stopping PocketBase...
```

## Cleanup

The tests automatically clean up after themselves:

- Test database is in `test_pb_data/` (deleted before each run)
- PocketBase binary and zip are kept for faster subsequent runs
- Server is stopped after tests complete

To manually clean everything:

```bash
npm run clean --prefix tests/migrations
```

## Troubleshooting

### "unzip: command not found"

Install unzip:

```bash
# Ubuntu/Debian
sudo apt-get install unzip

# macOS (usually pre-installed, but if needed)
brew install unzip
```

### "Failed to download PocketBase"

- Check your internet connection
- Verify the version (0.34.2) exists at https://github.com/pocketbase/pocketbase/releases
- The script will retry automatically on transient errors

### "PocketBase exited early"

- Check the console output for error messages
- There may be a syntax error in one of the migrations
- Try running migrations manually with a local PocketBase instance

### "Missing expected collections"

This means a migration didn't create the expected collection. Check:

1. Migration file syntax
2. Migration file is in `pb_migrations/` directory
3. Migration file follows naming convention: `timestamp_description.js`

### Port Conflicts

If port 8091 is already in use, the tests will fail. The test script uses port 8091 (different from the default 8090) to avoid conflicts with running PocketBase instances.

## Adding New Migrations

When you add a new migration:

1. Create the migration file in `pb_migrations/`
2. Update `test-migrations.js` if you add new collections
   - Add collection name to `expectedCollections` array
   - Add field validation if needed
3. Run the tests to verify the migration works

Example of updating for a new collection:

```javascript
// In test-migrations.js, find the expectedCollections array:
const expectedCollections = ['users', 'gift_cards', 'your_new_collection'];
```

## CI/CD Integration

These tests should be run in CI/CD pipelines before deploying:

```yaml
# Example GitHub Actions step
- name: Test PocketBase Migrations
  run: npm test --prefix tests/migrations
```

Add to the pre-push checklist in `CLAUDE.md`:

```bash
make ci && make test && npm test --prefix tests/migrations
```

## How Migrations Work

PocketBase migrations are JavaScript files that:

1. Export a `migrate` function with `up` and `down` handlers
2. Use the PocketBase app API to modify schema
3. Run in order based on timestamp prefix
4. Are automatically applied when PocketBase starts

Example migration:

```javascript
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Up migration: create/modify schema
  const collection = new Collection({
    name: "my_collection",
    fields: [/* ... */]
  });
  app.save(collection);
}, (app) => {
  // Down migration: rollback changes
  const collection = app.findCollectionByNameOrId("my_collection");
  app.delete(collection);
});
```

## Learn More

- [PocketBase Migrations Documentation](https://pocketbase.io/docs/migrations/)
- [PocketBase Collections API](https://pocketbase.io/docs/collections/)
- [HomeOS Architecture](../../PROJECT_STRUCTURE.md)
