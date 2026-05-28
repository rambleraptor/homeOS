// Package supervisor orchestrates the Homestead launcher lifecycle:
// in-process aepbase + the Bun sidecar + (in --dev) the Vite dev server,
// all fronted by the edge server on a single user-facing port. It prints a
// readiness banner, then blocks until a signal or a component exits, and
// shuts everything down in order.
package supervisor

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"sync"
	"syscall"
	"time"

	"homestead/cli/internal/aepbaserun"
	"homestead/cli/internal/edge"
	"homestead/cli/internal/proc"
	"homestead/cli/internal/project"
	"homestead/cli/internal/sidecarrun"
	"homestead/cli/internal/vitedev"
)

// Mode selects between serving the embedded SPA build (Prod) and proxying to
// the Vite dev server with HMR (Dev).
type Mode int

const (
	Dev Mode = iota
	Prod
)

// Options configures a launcher run.
type Options struct {
	Project      *project.Project
	Mode         Mode
	FrontendPort int
	AepbasePort  int
	SidecarPort  int
	VitePort     int
	// DataDir overrides project.DataDir when non-empty.
	DataDir string
	// Out is where multiplexed logs go (default os.Stdout).
	Out io.Writer
}

// Run brings the full stack up and blocks until SIGINT/SIGTERM (or an inner
// component exits). Returns on clean shutdown.
func Run(ctx context.Context, opts Options) error {
	if opts.Out == nil {
		opts.Out = os.Stdout
	}
	if opts.FrontendPort == 0 {
		opts.FrontendPort = 3000
	}
	if opts.AepbasePort == 0 {
		opts.AepbasePort = 8090
	}
	if opts.SidecarPort == 0 {
		opts.SidecarPort = 4000
	}
	if opts.VitePort == 0 {
		opts.VitePort = 5173
	}

	logMu := &sync.Mutex{}
	logf := func(format string, args ...any) {
		logMu.Lock()
		defer logMu.Unlock()
		fmt.Fprintf(opts.Out, format, args...)
	}

	dev := opts.Mode == Dev
	aepbaseURL := "http://127.0.0.1:" + strconv.Itoa(opts.AepbasePort)
	sidecarURL := "http://127.0.0.1:" + strconv.Itoa(opts.SidecarPort)

	// In prod, fail fast if the SPA wasn't embedded (wrong build tag).
	var spaFS fs.FS
	if !dev {
		spaFS = edge.EmbeddedSPA()
		if spaFS == nil {
			return fmt.Errorf("this binary has no embedded SPA — build with `make` (-tags release), or run `homestead start --dev`")
		}
	}

	dataDir := opts.DataDir
	if dataDir == "" {
		dataDir = opts.Project.DataDir
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("create data dir %s: %w", dataDir, err)
	}

	// 1. aepbase (in-process).
	logf("[homestead] starting aepbase on :%d\n", opts.AepbasePort)
	aep, creds, err := aepbaserun.Start(aepbaserun.Options{Port: opts.AepbasePort, DataDir: dataDir})
	if err != nil {
		return fmt.Errorf("start aepbase: %w", err)
	}

	// 2. sidecar (Bun).
	logf("[homestead] starting sidecar on :%d\n", opts.SidecarPort)
	side, err := sidecarrun.Start(sidecarrun.Options{
		Dev:           dev,
		RepoRoot:      opts.Project.Root,
		Port:          opts.SidecarPort,
		AepbaseURL:    aepbaseURL,
		AdminEmail:    creds.Email,
		AdminPassword: creds.Password,
		Out:           opts.Out,
		OutMu:         logMu,
	})
	if err != nil {
		_ = aep.Shutdown(context.Background())
		return fmt.Errorf("start sidecar: %w", err)
	}

	// 3. Vite dev server (dev only).
	var vite *proc.Process
	devSPAURL := ""
	if dev {
		logf("[homestead] starting vite dev on :%d\n", opts.VitePort)
		vite, err = vitedev.Start(vitedev.Options{
			RepoRoot:   opts.Project.Root,
			Port:       opts.VitePort,
			EdgePort:   opts.FrontendPort,
			AepbaseURL: aepbaseURL,
			SidecarURL: sidecarURL,
			Out:        opts.Out,
			OutMu:      logMu,
		})
		if err != nil {
			stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			_ = side.Stop(stopCtx)
			_ = aep.Shutdown(stopCtx)
			cancel()
			return fmt.Errorf("start vite: %w", err)
		}
		devSPAURL = "http://127.0.0.1:" + strconv.Itoa(opts.VitePort)
		// The edge proxies to Vite, so wait for it before serving.
		vctx, cancel := context.WithTimeout(ctx, 90*time.Second)
		if waitErr := WaitForPort(vctx, opts.VitePort, 200*time.Millisecond); waitErr != nil {
			logf("[homestead] vite never became reachable: %v\n", waitErr)
		}
		cancel()
	}

	// 4. Edge server on the single user-facing port.
	srv, err := edge.NewServer(edge.Options{
		Port:       opts.FrontendPort,
		AepbaseURL: aepbaseURL,
		SidecarURL: sidecarURL,
		DevSPAURL:  devSPAURL,
		SPA:        spaFS,
	})
	if err != nil {
		stopCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if vite != nil {
			_ = vite.Stop(stopCtx)
		}
		_ = side.Stop(stopCtx)
		_ = aep.Shutdown(stopCtx)
		cancel()
		return fmt.Errorf("build edge server: %w", err)
	}
	edgeErr := make(chan error, 1)
	go func() {
		if e := srv.ListenAndServe(); e != nil && e != http.ErrServerClosed {
			edgeErr <- e
		}
	}()

	// 5. Readiness banner.
	rctx, cancelReady := context.WithTimeout(ctx, 30*time.Second)
	if waitErr := WaitForPort(rctx, opts.FrontendPort, 200*time.Millisecond); waitErr == nil {
		logf("\n[homestead] ready\n")
		logf("[homestead]   app       http://localhost:%d\n", opts.FrontendPort)
		logf("[homestead]   aepbase   %s\n", aepbaseURL)
		logf("[homestead]   superuser %s / %s\n\n", creds.Email, creds.Password)
	} else {
		logf("[homestead] edge never became reachable: %v\n", waitErr)
	}
	cancelReady()

	// 6. Wait for a signal or for any component to exit on its own.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sideDone := make(chan error, 1)
	go func() { sideDone <- side.Wait() }()
	aepDone := make(chan error, 1)
	go func() { aepDone <- aep.Wait() }()
	var viteDone chan error
	if vite != nil {
		viteDone = make(chan error, 1)
		go func() { viteDone <- vite.Wait() }()
	}

	select {
	case s := <-sigCh:
		logf("[homestead] received %s, shutting down\n", s)
	case e := <-edgeErr:
		logf("[homestead] edge server error: %v\n", e)
	case e := <-sideDone:
		logf("[homestead] sidecar exited: %v\n", e)
	case e := <-aepDone:
		logf("[homestead] aepbase exited: %v\n", e)
	case e := <-viteDone: // nil channel blocks forever when vite is absent
		logf("[homestead] vite exited: %v\n", e)
	case <-ctx.Done():
		logf("[homestead] context cancelled, shutting down\n")
	}
	signal.Stop(sigCh)

	// 7. Shutdown order: edge first (drains in-flight proxied requests), then
	//    vite, then sidecar, then aepbase last.
	stopCtx, cancelStop := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelStop()
	if err := srv.Shutdown(stopCtx); err != nil {
		logf("[homestead] edge shutdown: %v\n", err)
	}
	if vite != nil {
		if err := vite.Stop(stopCtx); err != nil {
			logf("[homestead] vite stop: %v\n", err)
		}
	}
	if err := side.Stop(stopCtx); err != nil {
		logf("[homestead] sidecar stop: %v\n", err)
	}
	if err := aep.Shutdown(stopCtx); err != nil {
		logf("[homestead] aepbase shutdown: %v\n", err)
	}
	return nil
}
