// Package embedfs exposes the mirrored Homestead source tree that gets
// extracted into each project's build cache.
//
// The contents of `workspace/` are populated by
// `homestead/scripts/sync-embed.sh` before `go build`. The Makefile target
// `make homestead` runs that script for you.
package embedfs

import (
	"embed"
	"io/fs"
)

//go:embed all:workspace
var raw embed.FS

// FS returns a filesystem rooted at the embedded workspace dir.
func FS() fs.FS {
	sub, err := fs.Sub(raw, "workspace")
	if err != nil {
		// Sub only fails on a malformed path constant.
		panic(err)
	}
	return sub
}
