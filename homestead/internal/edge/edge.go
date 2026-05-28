// Package edge is the user-facing HTTP server. It exposes a single port and
// fans requests out to the in-process aepbase, the Bun sidecar, and the SPA
// (served from the embedded build in prod, or proxied to the Vite dev server
// in --dev).
package edge

import (
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strings"
)

// Options configures the edge server.
type Options struct {
	// Port is the user-facing listen port.
	Port int
	// AepbaseURL is the loopback aepbase base URL (e.g. http://127.0.0.1:8090).
	AepbaseURL string
	// SidecarURL is the loopback sidecar base URL (e.g. http://127.0.0.1:4000).
	SidecarURL string
	// DevSPAURL, when non-empty, proxies non-API requests (and HMR websockets)
	// to the Vite dev server. When empty, the embedded SPA is served from SPA.
	DevSPAURL string
	// SPA is the built SPA filesystem. Required when DevSPAURL is empty.
	SPA fs.FS
}

// NewServer builds the edge http.Server. The caller runs ListenAndServe and
// Shutdown.
func NewServer(opts Options) (*http.Server, error) {
	mux := http.NewServeMux()

	aep, err := url.Parse(opts.AepbaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse aepbase url %q: %w", opts.AepbaseURL, err)
	}
	side, err := url.Parse(opts.SidecarURL)
	if err != nil {
		return nil, fmt.Errorf("parse sidecar url %q: %w", opts.SidecarURL, err)
	}

	// aepbase: the browser uses same-origin `/api/aep/*`; strip that prefix
	// and forward the rest (matches the legacy Next rewrite).
	mux.Handle("/api/aep/", http.StripPrefix("/api/aep", httputil.NewSingleHostReverseProxy(aep)))

	// sidecar: forward with the path intact (it mounts /api/omnibox, etc.).
	sideProxy := httputil.NewSingleHostReverseProxy(side)
	mux.Handle("/api/omnibox/", sideProxy)
	mux.Handle("/api/notifications/", sideProxy)
	mux.Handle("/api/modules/", sideProxy)

	if opts.DevSPAURL != "" {
		dev, err := url.Parse(opts.DevSPAURL)
		if err != nil {
			return nil, fmt.Errorf("parse dev spa url %q: %w", opts.DevSPAURL, err)
		}
		// ReverseProxy forwards the Upgrade handshake, so Vite HMR websockets
		// tunnel through here too.
		mux.Handle("/", httputil.NewSingleHostReverseProxy(dev))
	} else {
		if opts.SPA == nil {
			return nil, fmt.Errorf("no embedded SPA in this build — rebuild with `-tags release`, or run with --dev")
		}
		mux.Handle("/", spaHandler(opts.SPA))
	}

	return &http.Server{
		Addr:    fmt.Sprintf(":%d", opts.Port),
		Handler: mux,
	}, nil
}

// spaHandler serves static assets from fsys and falls back to index.html for
// any path that isn't a real file, so client-side routes deep-link cleanly.
func spaHandler(fsys fs.FS) http.Handler {
	fileServer := http.FileServer(http.FS(fsys))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := strings.TrimPrefix(path.Clean(r.URL.Path), "/")
		if p == "" || p == "." {
			serveIndex(w, fsys)
			return
		}
		if _, err := fs.Stat(fsys, p); err != nil {
			serveIndex(w, fsys)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func serveIndex(w http.ResponseWriter, fsys fs.FS) {
	b, err := fs.ReadFile(fsys, "index.html")
	if err != nil {
		http.Error(w, "index.html missing from SPA build", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(b)
}
