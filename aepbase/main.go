// Command aepbase runs the Homestead aepbase server.
//
// It is a thin wrapper around github.com/rambleraptor/aepbase used as a
// library. The wrapper exists so we can opt into features that are
// library-only (and therefore not exposed by the upstream main.go):
//
//   - EnableUsers:      built-in user auth + authorization
//   - EnableFileFields: experimental file-field property storage
//
// It also installs a module-authorization middleware that consults the
// `module_flags` table (managed by the frontend) and 403s requests
// targeting a module the caller can't access.
//
// Everything else (port, data dir, db file, CORS) still comes from the
// usual flags so run.sh can keep working.
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/ncruces/go-sqlite3/driver"

	"github.com/rambleraptor/aepbase/pkg/aepbase"
)

func main() {
	var opts aepbase.ServerOptions
	opts.RegisterFlags()
	flag.Parse()

	// Library-only opt-ins. These are intentionally not exposed as flags by
	// upstream — Homestead needs both, so we hardcode them on.
	opts.EnableUsers = true
	opts.EnableFileFields = true

	if !opts.ExportResources {
		// Open a sidecar handle to the same SQLite file aepbase will use
		// for its own pool. WAL mode (set by aepbase.Run on its handle)
		// lets concurrent readers operate without blocking writes, so a
		// second pool is fine for the middleware's lookups.
		db, err := openSidecarDB(opts)
		if err != nil {
			log.Fatal(err)
		}
		defer db.Close()
		opts.Middlewares = []aepbase.Middleware{moduleAuthMiddleware(db)}
	}

	if err := aepbase.Run(opts); err != nil {
		log.Fatal(err)
	}
}

func openSidecarDB(opts aepbase.ServerOptions) (*sql.DB, error) {
	if opts.InMemory {
		// :memory: pools aren't shared between *sql.DB instances, so a
		// sidecar handle would see a different in-memory database.
		// We don't run --in-memory in production; if we ever need to,
		// move the middleware to State.Use after a manual setup that
		// owns the single DB handle.
		return nil, fmt.Errorf("module-auth middleware does not support --in-memory")
	}
	dir := opts.DataDir
	if dir == "" {
		dir = "aepbase_data"
	}
	file := opts.DBFile
	if file == "" {
		file = "aepbase.db"
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("creating data dir: %w", err)
	}
	db, err := sql.Open("sqlite3", filepath.Join(dir, file))
	if err != nil {
		return nil, fmt.Errorf("opening sidecar db: %w", err)
	}
	return db, nil
}
