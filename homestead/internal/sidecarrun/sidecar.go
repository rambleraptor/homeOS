// Package sidecarrun launches the Bun sidecar that owns the omnibox,
// notifications, and module-worker API routes. In --dev it runs
// `bun --watch run` against the repo source; in prod it extracts the
// embedded compiled binary and execs it.
package sidecarrun

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"sync"

	"homestead/cli/internal/edge"
	"homestead/cli/internal/proc"
)

// Options configures the sidecar process.
type Options struct {
	// Dev runs `bun --watch` against the repo source instead of the embed.
	Dev bool
	// RepoRoot is the project root (holds packages/ in dev).
	RepoRoot string
	// Port the sidecar listens on.
	Port int
	// AepbaseURL is the loopback aepbase base URL.
	AepbaseURL string
	// AdminEmail / AdminPassword let the sidecar run schema sync on boot.
	AdminEmail    string
	AdminPassword string
	Out           io.Writer
	OutMu         *sync.Mutex
}

// Start launches the sidecar and returns once spawned.
func Start(opts Options) (*proc.Process, error) {
	env := map[string]string{
		"PORT":                   strconv.Itoa(opts.Port),
		"AEPBASE_URL":            opts.AepbaseURL,
		"AEPBASE_ADMIN_EMAIL":    opts.AdminEmail,
		"AEPBASE_ADMIN_PASSWORD": opts.AdminPassword,
	}

	if opts.Dev {
		bun, err := findBun()
		if err != nil {
			return nil, err
		}
		entry := filepath.Join(opts.RepoRoot, "packages", "homestead-sidecar", "src", "server.ts")
		if _, err := os.Stat(entry); err != nil {
			return nil, fmt.Errorf("sidecar source not found at %s (run --dev from the repo root): %w", entry, err)
		}
		return proc.Spawn(proc.Options{
			Name:  bun,
			Args:  []string{"--watch", "run", entry},
			Dir:   opts.RepoRoot,
			Env:   env,
			Tag:   "[sidecar]",
			Out:   opts.Out,
			OutMu: opts.OutMu,
		})
	}

	bin, ok := edge.EmbeddedSidecar()
	if !ok {
		return nil, fmt.Errorf(
			"no embedded sidecar for %s/%s — rebuild with `-tags release`, or run with --dev",
			runtime.GOOS, runtime.GOARCH,
		)
	}
	path, err := extractBinary(bin)
	if err != nil {
		return nil, fmt.Errorf("extract sidecar: %w", err)
	}
	return proc.Spawn(proc.Options{
		Name:  path,
		Env:   env,
		Tag:   "[sidecar]",
		Out:   opts.Out,
		OutMu: opts.OutMu,
	})
}

// findBun resolves the bun executable from PATH, falling back to the default
// install location (the official installer doesn't always land on a
// non-interactive shell's PATH).
func findBun() (string, error) {
	if p, err := exec.LookPath("bun"); err == nil {
		return p, nil
	}
	if home, err := os.UserHomeDir(); err == nil {
		cand := filepath.Join(home, ".bun", "bin", "bun")
		if _, err := os.Stat(cand); err == nil {
			return cand, nil
		}
	}
	return "", fmt.Errorf("bun not found on PATH or ~/.bun/bin (install from https://bun.sh)")
}

// extractBinary writes the embedded sidecar to a content-addressed path under
// the user cache dir (so a new build gets a fresh file) and returns it.
func extractBinary(b []byte) (string, error) {
	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(cacheDir, "homestead")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	sum := sha256.Sum256(b)
	dst := filepath.Join(dir, "sidecar-"+hex.EncodeToString(sum[:8]))
	if info, statErr := os.Stat(dst); statErr == nil && info.Size() == int64(len(b)) {
		return dst, nil
	}
	tmp := dst + ".tmp"
	if err := os.WriteFile(tmp, b, 0o755); err != nil {
		return "", err
	}
	if err := os.Rename(tmp, dst); err != nil {
		return "", err
	}
	return dst, nil
}
