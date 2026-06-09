package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rambleraptor/aepbase/pkg/aepbase"
	"github.com/rambleraptor/aepbase/pkg/user"
)

// App visibility values. These mirror APP_VISIBILITY_OPTIONS in
// packages/homestead-core/settings/visibility.ts — keep the two in sync.
const (
	visibilityNone       = "none"
	visibilityAll        = "all"
	visibilitySuperusers = "superusers"
	visibilityTagged     = "tagged"
	defaultVisibility    = visibilityAll
)

// defaultAccessCacheTTLMs bounds how stale a cached app_flags row / user tag
// set may be by default. Flags and tags change rarely (admin actions), so a few
// seconds keeps the per-request DB cost near zero while staying responsive.
// Override with AEPBASE_ACCESS_CACHE_TTL_MS (0 = read fresh every request, used
// by e2e so a flag change takes effect immediately).
const defaultAccessCacheTTLMs = 5000

// accessCacheTTLFromEnv resolves the cache TTL from AEPBASE_ACCESS_CACHE_TTL_MS,
// falling back to the default when unset or unparseable.
func accessCacheTTLFromEnv() time.Duration {
	if raw := strings.TrimSpace(os.Getenv("AEPBASE_ACCESS_CACHE_TTL_MS")); raw != "" {
		if ms, err := strconv.Atoi(raw); err == nil && ms >= 0 {
			return time.Duration(ms) * time.Millisecond
		}
	}
	return defaultAccessCacheTTLMs * time.Millisecond
}

// appAccessMiddleware enforces, on every authenticated request to a gated
// feature collection, the same rule the frontend applies in resolveVisibility
// (packages/homestead-core/settings/hooks/useIsAppEnabled.ts):
//
//	none        → deny everyone (even superusers)
//	all         → any signed-in user
//	superusers  → only type=="superuser"
//	tagged      → the caller's account tags intersect the app's enabled_tags
//
// It is registered via state.Use AFTER EnableUsers, so the built-in auth
// middleware has already resolved the caller into the request context.
func appAccessMiddleware(db *sql.DB, cfg *appAccessConfig) aepbase.Middleware {
	store := &accessStore{db: db, tags: map[string]tagEntry{}, ttl: accessCacheTTLFromEnv()}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// CORS preflight + the auth-exempt routes never reach a gated
			// collection; pass them straight through.
			if r.Method == http.MethodOptions {
				next.ServeHTTP(w, r)
				return
			}

			plural := firstPathSegment(r.URL.Path)
			appID, gated := cfg.CollectionToApp[plural]
			if !gated {
				// Core/built-in collections (users, account-tags, app-flags,
				// meta, operations, …) are never gated.
				next.ServeHTTP(w, r)
				return
			}

			u := user.FromContext(r.Context())
			if u == nil {
				// Auth middleware should have rejected this already; defensive.
				writeAccessError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			vis, enabledTags := store.visibility(appID, cfg.AppDefaults[appID])
			if !decide(vis, u.Type == user.TypeSuperuser, store.userTags(u.ID), enabledTags) {
				writeAccessError(w, http.StatusForbidden, "you do not have access to this app")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// decide is the pure port of resolveVisibility. `vis` is assumed normalized to
// one of the four known values (see accessStore.visibility).
func decide(vis string, isSuperuser bool, userTags []string, enabledTags string) bool {
	switch vis {
	case visibilityNone:
		return false
	case visibilitySuperusers:
		return isSuperuser
	case visibilityTagged:
		allowed := parseTagSet(enabledTags)
		if len(allowed) == 0 {
			return false
		}
		for _, t := range userTags {
			if allowed[t] {
				return true
			}
		}
		return false
	default: // visibilityAll (and any unexpected value, matching the frontend default)
		return true
	}
}

// parseTagSet splits a comma-separated tag list into a set of trimmed,
// non-empty names. Mirrors parseTagList in settings/visibility.ts.
func parseTagSet(raw string) map[string]bool {
	out := map[string]bool{}
	for _, part := range strings.Split(raw, ",") {
		tag := strings.TrimSpace(part)
		if tag != "" {
			out[tag] = true
		}
	}
	return out
}

// firstPathSegment returns the first path segment (the top-level collection
// plural). A child path like /gift-cards/{id}/transactions returns
// "gift-cards", which owns the same app as its children.
func firstPathSegment(p string) string {
	p = strings.TrimPrefix(p, "/")
	if i := strings.IndexByte(p, '/'); i >= 0 {
		return p[:i]
	}
	return p
}

func writeAccessError(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"error": map[string]any{"code": code, "message": msg},
	})
}

// appFieldName builds the flattened app_flags column name for a
// (appId, key) pair. Mirrors fieldName in settings/flags.ts:
// "gift-cards" + "enabled" → "gift_cards__enabled".
func appFieldName(appID, key string) string {
	return strings.ReplaceAll(appID, "-", "_") + "__" + key
}

// accessStore reads the dynamic half of the decision — the household-wide
// app_flags row and per-user account_tags — from aepbase's own SQLite,
// caching both behind a short TTL to avoid a per-request query fan-out.
type accessStore struct {
	db  *sql.DB
	ttl time.Duration

	mu      sync.Mutex
	flags   map[string]string // column name → value, from the single app_flags row
	flagsAt time.Time
	tags    map[string]tagEntry // user id → tags + fetch time
}

type tagEntry struct {
	tags []string
	at   time.Time
}

// visibility resolves an app's effective visibility + enabled_tags from the
// cached app_flags row, falling back to the app default (then "all")
// when no value is stored.
func (s *accessStore) visibility(appID, appDefault string) (vis, enabledTags string) {
	flags := s.loadFlags()
	vis = flags[appFieldName(appID, "enabled")]
	if vis == "" {
		vis = appDefault
	}
	switch vis {
	case visibilityNone, visibilityAll, visibilitySuperusers, visibilityTagged:
		// known value, keep it
	default:
		vis = defaultVisibility
	}
	return vis, flags[appFieldName(appID, "enabled_tags")]
}

// loadFlags returns the single app_flags row as a column→value map, cached
// for accessCacheTTL. A missing table/row (fresh DB before the first schema
// sync) yields an empty map, so callers fall back to app defaults.
func (s *accessStore) loadFlags() map[string]string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.flags != nil && time.Since(s.flagsAt) < s.ttl {
		return s.flags
	}
	flags := queryFlagsRow(s.db)
	s.flags = flags
	s.flagsAt = time.Now()
	return flags
}

// userTags returns the caller's account tag names, cached per user for
// accessCacheTTL.
func (s *accessStore) userTags(userID string) []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if e, ok := s.tags[userID]; ok && time.Since(e.at) < s.ttl {
		return e.tags
	}
	tags := queryUserTags(s.db, userID)
	s.tags[userID] = tagEntry{tags: tags, at: time.Now()}
	return tags
}

// queryFlagsRow reads the lone app_flags row into a column→value map. The
// table name is the plural with dashes turned to underscores (db.SanitizeTableName).
func queryFlagsRow(db *sql.DB) map[string]string {
	out := map[string]string{}
	rows, err := db.Query(`SELECT * FROM app_flags LIMIT 1`)
	if err != nil {
		return out // table not created yet → defaults
	}
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil || !rows.Next() {
		return out
	}
	vals := make([]sql.NullString, len(cols))
	ptrs := make([]any, len(cols))
	for i := range vals {
		ptrs[i] = &vals[i]
	}
	if err := rows.Scan(ptrs...); err != nil {
		return out
	}
	for i, c := range cols {
		if vals[i].Valid {
			out[c] = vals[i].String
		}
	}
	return out
}

// queryUserTags reads the caller's account tag names. account-tags are parented
// under user, so the parent id column is user_id (db.ParentRef → "<parent>_id").
func queryUserTags(db *sql.DB, userID string) []string {
	rows, err := db.Query(`SELECT name FROM account_tags WHERE user_id = ?`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var tags []string
	for rows.Next() {
		var name sql.NullString
		if err := rows.Scan(&name); err != nil {
			return tags
		}
		if name.Valid && name.String != "" {
			tags = append(tags, name.String)
		}
	}
	return tags
}
