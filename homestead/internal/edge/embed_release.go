//go:build release

package edge

import (
	"embed"
	"fmt"
	"io/fs"
	"runtime"
)

//go:embed all:dist
var distFS embed.FS

//go:embed all:sidecar-*
var sidecarFS embed.FS

// EmbeddedSPA returns the built SPA filesystem rooted at dist/.
func EmbeddedSPA() fs.FS {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(fmt.Errorf("edge: sub dist: %w", err))
	}
	return sub
}

// EmbeddedSidecar returns the compiled sidecar binary for the host platform
// (named `sidecar-<goos>-<bunarch>`), or false if this build lacks one.
func EmbeddedSidecar() ([]byte, bool) {
	arch := runtime.GOARCH
	if arch == "amd64" {
		arch = "x64"
	}
	b, err := sidecarFS.ReadFile(fmt.Sprintf("sidecar-%s-%s", runtime.GOOS, arch))
	if err != nil {
		return nil, false
	}
	return b, true
}
