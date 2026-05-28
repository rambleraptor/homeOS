//go:build !release

package edge

import "io/fs"

// EmbeddedSPA returns the built SPA filesystem. In a non-release (dev) build
// nothing is embedded, so it returns nil — prod serving requires the
// `release` build tag.
func EmbeddedSPA() fs.FS { return nil }

// EmbeddedSidecar returns the compiled sidecar binary for the host platform.
// In a non-release build none is embedded.
func EmbeddedSidecar() ([]byte, bool) { return nil, false }
