package main

import (
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	_ "github.com/ncruces/go-sqlite3/driver"
	"github.com/rambleraptor/aepbase/pkg/user"
)

func TestFirstSegment(t *testing.T) {
	cases := map[string]string{
		"":                       "",
		"/":                      "",
		"/gift-cards":            "gift-cards",
		"/gift-cards/":           "gift-cards",
		"/gift-cards/abc":        "gift-cards",
		"/users/123/preferences": "users",
		"/openapi.json":          "openapi.json",
	}
	for in, want := range cases {
		if got := firstSegment(in); got != want {
			t.Errorf("firstSegment(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestIsAllowlistedPath(t *testing.T) {
	get := func(p string) *http.Request {
		return httptest.NewRequest(http.MethodGet, p, nil)
	}
	post := func(p string) *http.Request {
		return httptest.NewRequest(http.MethodPost, p, nil)
	}
	opts := func() *http.Request {
		return httptest.NewRequest(http.MethodOptions, "/anything", nil)
	}

	allowed := []*http.Request{
		get("/openapi.json"),
		post("/users/:login"),
		opts(),
		get("/users/123"),
		get("/aep-resource-definitions/gift-card"),
		get("/module-flags"),
		get("/module-authorizations/default"),
		get("/operations/abc"),
		get("/users/123/preferences"),
	}
	for _, r := range allowed {
		if !isAllowlistedPath(r) {
			t.Errorf("expected %s %s to be allowlisted", r.Method, r.URL.Path)
		}
	}

	blocked := []*http.Request{
		get("/gift-cards"),
		get("/gift-cards/123/transactions"),
		get("/recipes/foo"),
		// POST to anything other than /users/:login is gated, including
		// /users/{id}/notifications (owned by the notifications module).
	}
	for _, r := range blocked {
		if isAllowlistedPath(r) {
			t.Errorf("expected %s %s to NOT be allowlisted", r.Method, r.URL.Path)
		}
	}
}

func TestAllowed(t *testing.T) {
	regular := &user.User{Type: user.TypeRegular}
	superuser := &user.User{Type: user.TypeSuperuser}

	cases := []struct {
		vis  string
		u    *user.User
		want bool
	}{
		{"all", regular, true},
		{"all", superuser, true},
		{"superusers", regular, false},
		{"superusers", superuser, true},
		{"none", regular, false},
		{"none", superuser, false}, // no bypass — matches frontend
		{"", regular, true},        // empty/unknown → default to allow
		{"bogus", regular, true},
	}
	for _, c := range cases {
		if got := allowed(c.vis, c.u); got != c.want {
			t.Errorf("allowed(%q, type=%q) = %v, want %v", c.vis, c.u.Type, got, c.want)
		}
	}
}

func TestModuleForPath(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	// Insert the mapping row.
	_, err := db.Exec(
		`INSERT INTO module_authorizations (id, mapping_json) VALUES (?, ?)`,
		"default",
		`{"mappings":[
			{"plural":"gift-cards","singular":"gift-card","module_id":"gift-cards"},
			{"plural":"transactions","singular":"transaction","module_id":"gift-cards"},
			{"plural":"recipes","singular":"recipe","module_id":"recipes"}
		]}`,
	)
	if err != nil {
		t.Fatal(err)
	}
	cache := newAuthCache(db, 5*time.Second)

	cases := map[string]struct {
		mod string
		ok  bool
	}{
		"/gift-cards":                           {"gift-cards", true},
		"/gift-cards/abc":                       {"gift-cards", true},
		"/gift-cards/abc/transactions":          {"gift-cards", true}, // parent wins
		"/gift-cards/abc/transactions/xyz":      {"gift-cards", true},
		"/gift-cards/abc/transactions:download": {"gift-cards", true}, // custom method suffix stripped
		"/recipes/foo":                          {"recipes", true},
		"/unknown-thing":                        {"", false},
		"/":                                     {"", false},
	}
	for p, want := range cases {
		gotMod, gotOk := cache.moduleForPath(p)
		if gotOk != want.ok || gotMod != want.mod {
			t.Errorf("moduleForPath(%q) = (%q, %v), want (%q, %v)", p, gotMod, gotOk, want.mod, want.ok)
		}
	}
}

func TestVisibility(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	// Two columns: gift_cards__enabled = 'none', recipes__enabled = 'superusers'.
	if _, err := db.Exec(`CREATE TABLE module_flags (id TEXT PRIMARY KEY, gift_cards__enabled TEXT, recipes__enabled TEXT)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO module_flags (id, gift_cards__enabled, recipes__enabled) VALUES (?, ?, ?)`, "default", "none", "superusers"); err != nil {
		t.Fatal(err)
	}

	cache := newAuthCache(db, 5*time.Second)

	got, err := cache.visibility("gift-cards")
	if err != nil {
		t.Fatal(err)
	}
	if got != "none" {
		t.Errorf("gift-cards visibility: got %q, want %q", got, "none")
	}

	got, err = cache.visibility("recipes")
	if err != nil {
		t.Fatal(err)
	}
	if got != "superusers" {
		t.Errorf("recipes visibility: got %q, want %q", got, "superusers")
	}

	// Unknown module → empty (caller treats as default-allow).
	got, err = cache.visibility("non-existent")
	if err != nil {
		t.Fatal(err)
	}
	if got != "" {
		t.Errorf("non-existent module: got %q, want empty", got)
	}
}

func TestVisibilityWithoutTables(t *testing.T) {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	cache := newAuthCache(db, 5*time.Second)

	// No table → fail-open: empty mapping, empty visibility.
	if mod, ok := cache.moduleForPath("/gift-cards/abc"); ok {
		t.Errorf("expected no module match before tables exist, got %q", mod)
	}
	got, err := cache.visibility("gift-cards")
	if err != nil {
		t.Fatalf("expected no error pre-table, got %v", err)
	}
	if got != "" {
		t.Errorf("expected empty visibility pre-table, got %q", got)
	}
}

func TestBearerToken(t *testing.T) {
	cases := map[string]string{
		"":                       "",
		"basic abc":              "",
		"Bearer foo":             "foo",
		"bearer FOO":             "FOO",
		"Bearer   spaced-token ": "spaced-token",
	}
	for header, want := range cases {
		r := httptest.NewRequest(http.MethodGet, "/x", nil)
		if header != "" {
			r.Header.Set("Authorization", header)
		}
		if got := bearerToken(r); got != want {
			t.Errorf("bearerToken(%q) = %q, want %q", header, got, want)
		}
	}
}

// setupTestDB returns an in-memory SQLite with just the table the
// module_authorizations row lives in. Tests that need module_flags
// create that table themselves so they control the dynamic columns.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`CREATE TABLE module_authorizations (id TEXT PRIMARY KEY, mapping_json TEXT)`); err != nil {
		_ = db.Close()
		t.Fatal(err)
	}
	return db
}
