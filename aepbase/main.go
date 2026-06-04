// Command aepbase runs the Homestead aepbase server as a standalone,
// fully externally-configured process.
//
// It is a thin wrapper around github.com/rambleraptor/aepbase used as a
// library. Unlike upstream's aepbase.Run, this wrapper:
//
//   - opts into the library-only features Homestead needs (EnableUsers,
//     EnableFileFields) — these are not exposed as upstream flags;
//   - enables OAuth from configuration (see oauth.go) — upstream has no
//     OAuth hook on Run;
//   - intercepts the first-boot superuser bootstrap so the credentials are
//     persisted to data/credentials.json (see bootstrap.go) rather than only
//     printed to stdout, so the homestead launcher can read them for the
//     sidecar's schema-sync step;
//   - shuts down gracefully on SIGINT/SIGTERM.
//
// Everything is driven by flags (with env-var defaults), so it works both
// standalone (run.sh) and when spawned as a child by the homestead launcher.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/rambleraptor/aepbase/pkg/aepbase"
	"github.com/rambleraptor/aepbase/pkg/db"
	"github.com/rambleraptor/aepbase/pkg/meta"
)

func main() {
	port := flag.Int("port", envInt("AEPBASE_PORT", 8090), "port to listen on")
	dataDir := flag.String("data-dir", envStr("AEPBASE_DATA_DIR", "data"), "directory for the sqlite db + uploaded files")
	dbFile := flag.String("db", envStr("AEPBASE_DB", "aepbase.db"), "sqlite database file name (inside data-dir)")
	corsRaw := flag.String("cors-allowed-origins", envStr("AEPBASE_CORS", ""), "comma-separated list of allowed CORS origins")
	flag.Parse()

	if err := run(*port, *dataDir, *dbFile, splitCORS(*corsRaw)); err != nil {
		log.Fatal(err)
	}
}

// run boots aepbase and serves HTTP until SIGINT/SIGTERM, then shuts down
// gracefully. It mirrors the upstream aepbase.Run flow but adds superuser
// credential capture, OAuth, and a clean shutdown hook.
func run(port int, dataDir, dbFile string, cors []string) error {
	abs, err := filepath.Abs(dataDir)
	if err != nil {
		return fmt.Errorf("resolve data dir %q: %w", dataDir, err)
	}
	dataDir = abs
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return fmt.Errorf("create data dir %s: %w", dataDir, err)
	}

	dbPath := filepath.Join(dataDir, dbFile)
	sqlDB, err := db.Init(dbPath)
	if err != nil {
		return fmt.Errorf("init db at %s: %w", dbPath, err)
	}
	defer sqlDB.Close()

	// Bootstrap the superuser before EnableUsers so we own the credentials and
	// persist them to data/credentials.json. EnableUsers then sees a non-empty
	// users table and skips its own (stdout-only) bootstrap.
	creds, err := bootstrapSuperuser(sqlDB, dataDir)
	if err != nil {
		return fmt.Errorf("bootstrap superuser: %w", err)
	}

	serverURL := "http://localhost:" + strconv.Itoa(port)
	state := aepbase.NewState(sqlDB, serverURL)
	state.CORSAllowedOrigins = cors
	state.EnableFileFields(filepath.Join(dataDir, "files"))
	if err := state.EnableUsers(); err != nil {
		return fmt.Errorf("enable users: %w", err)
	}

	// OAuth is opt-in via AEPBASE_OAUTH (see oauth.go); unset means disabled.
	providers, err := oauthProvidersFromEnv()
	if err != nil {
		return fmt.Errorf("oauth config: %w", err)
	}
	if len(providers) > 0 {
		if err := state.EnableOAuth(providers...); err != nil {
			return fmt.Errorf("enable oauth: %w", err)
		}
		log.Printf("aepbase: oauth enabled (%d provider(s))", len(providers))
	}

	// Restore resource definitions persisted by a previous run.
	defs, err := meta.LoadAll(sqlDB)
	if err != nil {
		return fmt.Errorf("load resource definitions: %w", err)
	}
	for _, def := range topoSortDefs(defs) {
		if err := state.AddResource(def); err != nil {
			return fmt.Errorf("restore resource %q: %w", def.Singular, err)
		}
	}

	srv := &http.Server{Addr: ":" + strconv.Itoa(port), Handler: state.Handler()}

	shutdownDone := make(chan struct{})
	go func() {
		sigCh := make(chan os.Signal, 1)
		signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
		<-sigCh
		log.Printf("aepbase: signal received, shutting down")
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		if err := srv.Shutdown(ctx); err != nil {
			log.Printf("aepbase: shutdown: %v", err)
		}
		close(shutdownDone)
	}()

	log.Printf("aepbase: listening on :%d (data-dir=%s, superuser=%s)", port, dataDir, creds.Email)
	err = srv.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		<-shutdownDone
		return nil
	}
	return fmt.Errorf("serve: %w", err)
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

func envStr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func splitCORS(raw string) []string {
	if strings.TrimSpace(raw) == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	for i := range parts {
		parts[i] = strings.TrimSpace(parts[i])
	}
	return parts
}
