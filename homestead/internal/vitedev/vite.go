// Package vitedev runs the Vite dev server (HMR) for `homestead start --dev`.
// The edge server reverse-proxies non-API requests (and the HMR websocket)
// to it.
package vitedev

import (
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"

	"homestead/cli/internal/proc"
)

// Options configures the Vite dev server.
type Options struct {
	// RepoRoot is the project root (holds frontend/).
	RepoRoot string
	// Port is the Vite listen port.
	Port int
	// EdgePort is the user-facing port; Vite's HMR client connects there so
	// the websocket tunnels back through the edge proxy.
	EdgePort int
	// AepbaseURL / SidecarURL seed Vite's own dev proxy (unused when fronted
	// by the edge, but harmless and correct if hit directly).
	AepbaseURL string
	SidecarURL string
	Out        io.Writer
	OutMu      *sync.Mutex
}

// Start launches `npm run dev` in frontend/ and returns once spawned.
func Start(opts Options) (*proc.Process, error) {
	npm, err := exec.LookPath("npm")
	if err != nil {
		return nil, fmt.Errorf("npm not found on PATH (Node.js 20+ is required for --dev)")
	}
	frontend := filepath.Join(opts.RepoRoot, "frontend")
	return proc.Spawn(proc.Options{
		Name: npm,
		Args: []string{
			"run", "dev", "--",
			"--port", strconv.Itoa(opts.Port),
			"--strictPort",
			"--host", "127.0.0.1",
		},
		Dir: frontend,
		Env: map[string]string{
			"AEPBASE_URL":          opts.AepbaseURL,
			"SIDECAR_URL":          opts.SidecarURL,
			"VITE_HMR_CLIENT_PORT": strconv.Itoa(opts.EdgePort),
		},
		Tag:   "[vite]",
		Out:   opts.Out,
		OutMu: opts.OutMu,
	})
}
