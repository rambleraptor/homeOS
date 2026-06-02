// Package aepbaserun boots an aepbase server in-process.
//
// We can't use the upstream aepbase.Run because it blocks on
// http.ListenAndServe with no shutdown hook, registers global CLI flags,
// and prints the bootstrap superuser's password to stdout where we can't
// capture it. This package reimplements the ~80 lines of Run on top of
// the lower-level public API (db.Init, aepbase.NewState, state.EnableUsers,
// state.Handler), with three differences:
//
//   - We intercept the bootstrap-superuser flow (see bootstrap.go) so we
//     own the credentials and persist them on first boot.
//   - We hold our own http.Server + net.Listener so the caller can
//     Shutdown gracefully.
//   - Shutdown order is enforced by the caller (supervisor) — we close
//     the DB only after the HTTP listener has drained.
package aepbaserun

import (
	"context"
	"database/sql"
	"fmt"
	"net"
	"net/http"
	"path/filepath"
	"strconv"
	"sync"

	"github.com/rambleraptor/aepbase/pkg/aepbase"
	"github.com/rambleraptor/aepbase/pkg/db"
	"github.com/rambleraptor/aepbase/pkg/meta"
)

// Options configures the in-process aepbase server.
type Options struct {
	// Port to listen on.
	Port int

	// DataDir is where the sqlite db file and file-field uploads live.
	// Must be an absolute path; the launcher resolves it before calling us.
	DataDir string

	// DBFile is the sqlite file name inside DataDir. Defaults to
	// "aepbase.db" if empty.
	DBFile string

	// CORSAllowedOrigins is forwarded to the aepbase state.
	CORSAllowedOrigins []string
}

// Credentials are the superuser credentials for the running aepbase
// instance. On first boot we generate and persist them. On subsequent
// boots we read them from disk so the Next subprocess can authenticate
// for the schema-sync step.
type Credentials struct {
	Email    string
	Password string
}

// Server is a running in-process aepbase server.
type Server struct {
	addr   string
	srv    *http.Server
	db     *sql.DB
	wg     sync.WaitGroup
	exited chan struct{}
	serveErr error
	mu     sync.Mutex
}

// Addr returns the listen address the server bound to.
func (s *Server) Addr() string { return s.addr }

// Wait blocks until the server has exited (either via Shutdown or a fatal
// serve error). Returns the serve error, if any.
func (s *Server) Wait() error {
	<-s.exited
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.serveErr
}

// Shutdown stops the HTTP server and closes the database. Safe to call
// from a signal handler.
func (s *Server) Shutdown(ctx context.Context) error {
	if err := s.srv.Shutdown(ctx); err != nil {
		return fmt.Errorf("shutdown http: %w", err)
	}
	s.wg.Wait()
	if err := s.db.Close(); err != nil {
		return fmt.Errorf("close db: %w", err)
	}
	return nil
}

// Start boots aepbase and begins serving HTTP. It returns once the
// listener is ready to accept connections (so callers can rely on
// readiness without polling).
func Start(opts Options) (*Server, *Credentials, error) {
	if opts.DBFile == "" {
		opts.DBFile = "aepbase.db"
	}
	if opts.Port == 0 {
		return nil, nil, fmt.Errorf("Port is required")
	}
	if opts.DataDir == "" {
		return nil, nil, fmt.Errorf("DataDir is required")
	}

	dbPath := filepath.Join(opts.DataDir, opts.DBFile)
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		return nil, nil, fmt.Errorf("init db at %s: %w", dbPath, err)
	}

	// Bootstrap superuser before EnableUsers — see bootstrap.go.
	creds, err := bootstrapSuperuser(sqlDB, opts.DataDir)
	if err != nil {
		sqlDB.Close()
		return nil, nil, fmt.Errorf("bootstrap superuser: %w", err)
	}

	serverURL := "http://localhost:" + strconv.Itoa(opts.Port)
	state := aepbase.NewState(sqlDB, serverURL)
	state.CORSAllowedOrigins = opts.CORSAllowedOrigins
	state.EnableFileFields(filepath.Join(opts.DataDir, "files"))
	if err := state.EnableUsers(); err != nil {
		sqlDB.Close()
		return nil, nil, fmt.Errorf("enable users: %w", err)
	}

	// OAuth login is opt-in via OAUTH_* env vars. With OAUTH_PROVIDERS unset
	// this returns no providers and we leave OAuth off.
	providers, err := oauthProvidersFromEnv()
	if err != nil {
		sqlDB.Close()
		return nil, nil, fmt.Errorf("oauth config: %w", err)
	}
	if len(providers) > 0 {
		if err := state.EnableOAuth(providers...); err != nil {
			sqlDB.Close()
			return nil, nil, fmt.Errorf("enable oauth: %w", err)
		}
	}

	defs, err := meta.LoadAll(sqlDB)
	if err != nil {
		sqlDB.Close()
		return nil, nil, fmt.Errorf("load resource definitions: %w", err)
	}
	for _, def := range topoSortDefs(defs) {
		if err := state.AddResource(def); err != nil {
			sqlDB.Close()
			return nil, nil, fmt.Errorf("restore resource %q: %w", def.Singular, err)
		}
	}

	ln, err := net.Listen("tcp", ":"+strconv.Itoa(opts.Port))
	if err != nil {
		sqlDB.Close()
		return nil, nil, fmt.Errorf("listen on :%d: %w", opts.Port, err)
	}

	srv := &http.Server{Handler: state.Handler()}
	s := &Server{
		addr:   ln.Addr().String(),
		srv:    srv,
		db:     sqlDB,
		exited: make(chan struct{}),
	}
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		defer close(s.exited)
		if err := srv.Serve(ln); err != http.ErrServerClosed {
			s.mu.Lock()
			s.serveErr = err
			s.mu.Unlock()
		}
	}()
	return s, creds, nil
}

// topoSortDefs orders resource definitions so parents come before children.
// Mirror of the unexported aepbase.topoSortDefs.
func topoSortDefs(defs []meta.ResourceDefinition) []meta.ResourceDefinition {
	byName := make(map[string]meta.ResourceDefinition, len(defs))
	for _, d := range defs {
		byName[d.Singular] = d
	}
	visited := make(map[string]bool, len(defs))
	var sorted []meta.ResourceDefinition
	var visit func(string)
	visit = func(name string) {
		if visited[name] {
			return
		}
		visited[name] = true
		d, ok := byName[name]
		if !ok {
			return
		}
		for _, p := range d.Parents {
			visit(p)
		}
		sorted = append(sorted, d)
	}
	for _, d := range defs {
		visit(d.Singular)
	}
	return sorted
}
