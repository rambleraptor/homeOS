// Command aepbase runs the Homestead aepbase server.
//
// It is a thin wrapper around github.com/rambleraptor/aepbase used as a
// library. The wrapper exists so we can opt into features that are
// library-only (and therefore not exposed by the upstream main.go):
//
//   - EnableUsers:      built-in user auth + authorization
//   - EnableFileFields: experimental file-field property storage
//
// Everything else (port, data dir, db file, CORS) still comes from the
// usual flags so run.sh can keep working.
package main

import (
	"flag"
	"log"

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

	// OAuth login is wired up by the homestead launcher (state.EnableOAuth),
	// not here — aepbase.Run has no OAuth hook, and this standalone wrapper is
	// only used for local backend dev via run.sh.

	if err := aepbase.Run(opts); err != nil {
		log.Fatal(err)
	}
}
