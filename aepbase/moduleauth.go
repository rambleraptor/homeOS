package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rambleraptor/aepbase/pkg/aepbase"
	"github.com/rambleraptor/aepbase/pkg/user"
)

// defaultCacheTTL is the lifetime of the mapping/flags cache when
// HOMESTEAD_MODULE_AUTH_TTL_MS is unset. Five seconds keeps SQLite
// load minimal while giving flag flips a snappy enough propagation
// window for an interactive UI. Tests set the env var to 0 to bypass.
const defaultCacheTTL = 5 * time.Second

func configuredCacheTTL() time.Duration {
	raw := os.Getenv("HOMESTEAD_MODULE_AUTH_TTL_MS")
	if raw == "" {
		return defaultCacheTTL
	}
	ms, err := strconv.Atoi(raw)
	if err != nil || ms < 0 {
		log.Printf("module-auth: ignoring invalid HOMESTEAD_MODULE_AUTH_TTL_MS=%q", raw)
		return defaultCacheTTL
	}
	return time.Duration(ms) * time.Millisecond
}

// moduleAuthMiddleware blocks aepbase requests targeting a module the
// caller can't access. It mirrors the frontend rule in
// packages/homestead-core/settings/hooks/useIsModuleEnabled.ts:
//
//	'all'        → any signed-in user
//	'superusers' → only User.Type == TypeSuperuser
//	'none'       → blocked for everyone (no superuser bypass)
//
// The resource→module mapping is pushed by Next.js instrumentation
// into the `module_authorizations` table; flag values come from
// `module_flags`. Both are read with a small TTL cache.
//
// Runs via ServerOptions.Middlewares, which currently fires *before*
// aepbase's built-in auth middleware, so we re-validate the bearer
// token ourselves. Requests without a valid token pass through and
// get 401'd by the auth layer downstream.
func moduleAuthMiddleware(db *sql.DB) aepbase.Middleware {
	cache := newAuthCache(db, configuredCacheTTL())
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isAllowlistedPath(r) {
				next.ServeHTTP(w, r)
				return
			}

			tok := bearerToken(r)
			if tok == "" {
				next.ServeHTTP(w, r) // auth middleware will 401
				return
			}
			u, err := user.GetUserByToken(db, tok)
			if err != nil || u == nil {
				next.ServeHTTP(w, r) // auth middleware will 401
				return
			}

			moduleID, ok := cache.moduleForPath(r.URL.Path)
			if !ok {
				next.ServeHTTP(w, r) // not a module-owned resource
				return
			}

			vis, err := cache.visibility(moduleID)
			if err != nil {
				// Fail-open with a log: locking everyone out on a fresh
				// boot (before the frontend pushes module-flags) would be
				// worse than a brief over-permissive window.
				log.Printf("module-auth: visibility lookup for %q: %v", moduleID, err)
				next.ServeHTTP(w, r)
				return
			}
			if !allowed(vis, u) {
				writeForbidden(w, moduleID)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// allowedNonModulePaths is the set of top-level URL segments whose
// requests are never gated by module flags. Auth endpoints, the
// settings collections themselves, and aepbase platform endpoints
// have to remain reachable so users can sign in, read their profile,
// and re-enable a disabled module. Compare against the FIRST
// non-empty path segment.
var allowedNonModulePaths = map[string]struct{}{
	"users":                    {}, // auth + profile + nested preferences/notifications collection root
	"aep-resource-definitions": {},
	"operations":               {},
	"module-flags":             {},
	"module-flag":              {},
	"module-authorizations":    {},
	"module-authorization":     {},
	"preferences":              {}, // user-preference singleton (built-in, not module-owned)
}

func isAllowlistedPath(r *http.Request) bool {
	if r.Method == http.MethodOptions {
		return true
	}
	if r.URL.Path == "/openapi.json" {
		return true
	}
	if r.Method == http.MethodPost && r.URL.Path == "/users/:login" {
		return true
	}
	first := firstSegment(r.URL.Path)
	if first == "" {
		return true
	}
	_, ok := allowedNonModulePaths[first]
	return ok
}

func firstSegment(p string) string {
	p = strings.TrimPrefix(p, "/")
	if i := strings.IndexByte(p, '/'); i >= 0 {
		return p[:i]
	}
	return p
}

func bearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	const prefix = "Bearer "
	if len(auth) < len(prefix) || !strings.EqualFold(auth[:len(prefix)], prefix) {
		return ""
	}
	return strings.TrimSpace(auth[len(prefix):])
}

func allowed(vis string, u *user.User) bool {
	switch vis {
	case "all":
		return true
	case "superusers":
		return u.Type == user.TypeSuperuser
	case "none":
		return false
	default:
		// DEFAULT_MODULE_VISIBILITY in TS is 'all'; mirror that for
		// missing or unrecognized values so a half-configured row
		// doesn't lock users out.
		return true
	}
}

func writeForbidden(w http.ResponseWriter, moduleID string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusForbidden)
	body := map[string]any{
		"error": map[string]any{
			"code":    http.StatusForbidden,
			"message": fmt.Sprintf("module %q is disabled for this user", moduleID),
		},
	}
	_ = json.NewEncoder(w).Encode(body)
}

// authCache caches the resource→module mapping and the module_flags
// row for a short TTL. Both are read from SQLite on demand; we keep
// the cache lifetime tiny (seconds) so flag flips show up quickly
// without making every request pay for a DB roundtrip.
type authCache struct {
	db  *sql.DB
	ttl time.Duration

	mu             sync.RWMutex
	mappingExpires time.Time
	pluralToModule map[string]string // plural → module_id (snake-cased? no, kebab — flag lookup re-snakes)

	flagsExpires time.Time
	enabledByMod map[string]string // module_id (kebab) → visibility string
}

type mappingPayload struct {
	Mappings []struct {
		Plural   string `json:"plural"`
		Singular string `json:"singular"`
		ModuleID string `json:"module_id"`
	} `json:"mappings"`
}

func newAuthCache(db *sql.DB, ttl time.Duration) *authCache {
	return &authCache{db: db, ttl: ttl}
}

func (c *authCache) moduleForPath(urlPath string) (string, bool) {
	mapping := c.loadMapping()
	if mapping == nil {
		return "", false
	}
	// Walk path segments; the first one matching a known plural wins.
	// In nested paths the parent appears first, and children always
	// belong to the same module as their parent, so picking the first
	// hit is correct.
	for _, seg := range strings.Split(strings.TrimPrefix(urlPath, "/"), "/") {
		if seg == "" {
			continue
		}
		// Strip a custom-method suffix (e.g. "transactions:download"
		// → "transactions") so :method calls inherit the resource's
		// module gating.
		if i := strings.IndexByte(seg, ':'); i > 0 {
			seg = seg[:i]
		}
		if mod, ok := mapping[seg]; ok {
			return mod, true
		}
	}
	return "", false
}

func (c *authCache) loadMapping() map[string]string {
	c.mu.RLock()
	if time.Now().Before(c.mappingExpires) && c.pluralToModule != nil {
		m := c.pluralToModule
		c.mu.RUnlock()
		return m
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()
	// Re-check under the write lock to avoid duplicate work.
	if time.Now().Before(c.mappingExpires) && c.pluralToModule != nil {
		return c.pluralToModule
	}

	row := c.db.QueryRow(`SELECT mapping_json FROM module_authorizations LIMIT 1`)
	var raw string
	if err := row.Scan(&raw); err != nil {
		// Either the table doesn't exist yet (fresh boot before
		// instrumentation pushed the resource definition) or no row
		// has been written yet. Either way: nothing to enforce.
		c.pluralToModule = map[string]string{}
		c.mappingExpires = time.Now().Add(c.ttl)
		return c.pluralToModule
	}

	var payload mappingPayload
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		log.Printf("module-auth: parse mapping_json: %v", err)
		c.pluralToModule = map[string]string{}
		c.mappingExpires = time.Now().Add(c.ttl)
		return c.pluralToModule
	}
	m := make(map[string]string, len(payload.Mappings))
	for _, entry := range payload.Mappings {
		m[entry.Plural] = entry.ModuleID
	}
	c.pluralToModule = m
	c.mappingExpires = time.Now().Add(c.ttl)
	return c.pluralToModule
}

func (c *authCache) visibility(moduleID string) (string, error) {
	c.mu.RLock()
	if time.Now().Before(c.flagsExpires) && c.enabledByMod != nil {
		vis, ok := c.enabledByMod[moduleID]
		c.mu.RUnlock()
		if !ok {
			return "", nil // missing → default visibility (allow in `allowed`)
		}
		return vis, nil
	}
	c.mu.RUnlock()

	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Now().Before(c.flagsExpires) && c.enabledByMod != nil {
		return c.enabledByMod[moduleID], nil
	}

	enabled, err := readEnabledFlags(c.db)
	if err != nil {
		return "", err
	}
	c.enabledByMod = enabled
	c.flagsExpires = time.Now().Add(c.ttl)
	return c.enabledByMod[moduleID], nil
}

// readEnabledFlags pulls every `${module_id_snake}__enabled` column
// from the singleton row of `module_flags`. The schema is generated
// per-deployment (one column per (module, flag) pair declared via
// getAllModuleFlagDefs), so we discover the columns at runtime
// rather than hardcoding them.
func readEnabledFlags(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query(`SELECT * FROM module_flags LIMIT 1`)
	if err != nil {
		// Table doesn't exist yet (fresh boot pre-sync) — nothing to enforce.
		return map[string]string{}, nil
	}
	defer rows.Close()

	if !rows.Next() {
		return map[string]string{}, nil // no row written yet
	}
	cols, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("read columns: %w", err)
	}
	dest := make([]any, len(cols))
	ptrs := make([]any, len(cols))
	for i := range dest {
		ptrs[i] = &dest[i]
	}
	if err := rows.Scan(ptrs...); err != nil {
		return nil, fmt.Errorf("scan flags row: %w", err)
	}

	const suffix = "__enabled"
	out := make(map[string]string)
	for i, col := range cols {
		if !strings.HasSuffix(col, suffix) {
			continue
		}
		val := dest[i]
		if val == nil {
			continue
		}
		var vis string
		switch v := val.(type) {
		case string:
			vis = v
		case []byte:
			vis = string(v)
		default:
			continue
		}
		if vis == "" {
			continue
		}
		moduleSnake := col[:len(col)-len(suffix)]
		moduleID := strings.ReplaceAll(moduleSnake, "_", "-")
		out[moduleID] = vis
	}
	return out, nil
}
