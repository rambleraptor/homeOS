// Package supervisor orchestrates the full Homestead launcher lifecycle:
// build cache extract → npm ci → in-process aepbase → next dev/start →
// readiness banner → wait for signal → graceful shutdown.
package supervisor

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
	"time"

	"homestead/cli/internal/aepbaserun"
	"homestead/cli/internal/embedfs"
	"homestead/cli/internal/noderun"
	"homestead/cli/internal/project"
)

// Mode controls whether we run `next dev` (HMR) or `next start` (built
// production bundle). PR 1 only wires Dev; Prod ships in a follow-up.
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
	// DataDir overrides project.DataDir when non-empty.
	DataDir string
	// Out is where multiplexed logs go (default os.Stdout).
	Out io.Writer
}

// Run brings the full stack up and blocks until SIGINT/SIGTERM (or an
// inner component fails). Returns on clean shutdown.
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
	if opts.Mode != Dev {
		return fmt.Errorf("only --dev mode is supported in this build")
	}

	logMu := &sync.Mutex{}
	logf := func(format string, args ...any) {
		logMu.Lock()
		defer logMu.Unlock()
		fmt.Fprintf(opts.Out, format, args...)
	}

	dataDir := opts.DataDir
	if dataDir == "" {
		dataDir = opts.Project.DataDir
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("create data dir %s: %w", dataDir, err)
	}

	// 1. Resolve build workspace.
	logf("[homestead] extracting workspace\n")
	embedFS := embedfs.FS()
	cacheRoot, err := project.CacheRoot()
	if err != nil {
		return err
	}
	key, err := project.CacheKey(embedFS, opts.Project)
	if err != nil {
		return fmt.Errorf("compute cache key: %w", err)
	}
	workspaceDir := project.WorkspaceDir(cacheRoot, key)
	if err := project.Extract(embedFS, opts.Project, workspaceDir); err != nil {
		return fmt.Errorf("extract workspace: %w", err)
	}
	logf("[homestead] workspace ready at %s\n", workspaceDir)

	// 2. Toolchain.
	tc, err := noderun.FindToolchain()
	if err != nil {
		return err
	}

	// 3. npm ci if node_modules missing.
	if _, statErr := os.Stat(filepath.Join(workspaceDir, "node_modules")); os.IsNotExist(statErr) {
		logf("[homestead] installing npm dependencies (first run only)\n")
		installCtx, cancel := context.WithTimeout(ctx, 10*time.Minute)
		err := tc.RunNpmInstall(installCtx, workspaceDir, opts.Out, logMu)
		cancel()
		if err != nil {
			return fmt.Errorf("npm install: %w", err)
		}
	}

	// 4. Boot aepbase in-process.
	logf("[homestead] starting aepbase on :%d\n", opts.AepbasePort)
	aep, creds, err := aepbaserun.Start(aepbaserun.Options{
		Port:    opts.AepbasePort,
		DataDir: dataDir,
	})
	if err != nil {
		return fmt.Errorf("start aepbase: %w", err)
	}

	// 5. Spawn the file watcher (mirrors user's modules/ into workspace).
	watcherCtx, cancelWatcher := context.WithCancel(ctx)
	watcherDone := make(chan struct{})
	go func() {
		defer close(watcherDone)
		err := project.WatchModules(
			watcherCtx,
			opts.Project.ModulesDir,
			filepath.Join(workspaceDir, "modules"),
			opts.Out,
		)
		if err != nil {
			logf("[homestead] watcher exited: %v\n", err)
		}
	}()

	// 6. Spawn next dev with creds injected.
	logf("[homestead] starting next dev on :%d\n", opts.FrontendPort)
	nextEnv := map[string]string{
		"AEPBASE_URL":            "http://127.0.0.1:" + strconv.Itoa(opts.AepbasePort),
		"AEPBASE_ADMIN_EMAIL":    creds.Email,
		"AEPBASE_ADMIN_PASSWORD": creds.Password,
		"PORT":                   strconv.Itoa(opts.FrontendPort),
	}
	next, err := tc.NextDev(workspaceDir, opts.FrontendPort, nextEnv, opts.Out, logMu)
	if err != nil {
		// Best-effort cleanup before bailing.
		_ = aep.Shutdown(context.Background())
		cancelWatcher()
		<-watcherDone
		return fmt.Errorf("start next: %w", err)
	}

	// 7. Wait for both ports to accept connections, then print the banner.
	readyCtx, cancelReady := context.WithTimeout(ctx, 90*time.Second)
	if err := WaitForPort(readyCtx, opts.FrontendPort, 200*time.Millisecond); err != nil {
		cancelReady()
		logf("[homestead] frontend never became reachable: %v\n", err)
	} else {
		cancelReady()
		logf("\n[homestead] ready\n")
		logf("[homestead]   frontend  http://localhost:%d\n", opts.FrontendPort)
		logf("[homestead]   aepbase   http://localhost:%d\n", opts.AepbasePort)
		logf("[homestead]   superuser %s / %s\n\n", creds.Email, creds.Password)
	}

	// 8. Wait for signal OR for either subprocess to exit on its own.
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	nextDone := make(chan error, 1)
	go func() { nextDone <- next.Wait() }()
	aepDone := make(chan error, 1)
	go func() { aepDone <- aep.Wait() }()

	select {
	case s := <-sigCh:
		logf("[homestead] received %s, shutting down\n", s)
	case err := <-nextDone:
		logf("[homestead] next exited: %v\n", err)
	case err := <-aepDone:
		logf("[homestead] aepbase exited: %v\n", err)
	case <-ctx.Done():
		logf("[homestead] context cancelled, shutting down\n")
	}
	signal.Stop(sigCh)

	// 9. Shutdown order: Next first (drains /api/aep connections cleanly),
	//    then aepbase, then watcher.
	stopCtx, cancelStop := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancelStop()
	if err := next.Stop(stopCtx); err != nil {
		logf("[homestead] next stop: %v\n", err)
	}
	if err := aep.Shutdown(stopCtx); err != nil {
		logf("[homestead] aepbase shutdown: %v\n", err)
	}
	cancelWatcher()
	<-watcherDone
	return nil
}
