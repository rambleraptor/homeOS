package main

import (
	"testing"
	"time"

	"github.com/rambleraptor/aepbase/pkg/db"
)

func TestDecide(t *testing.T) {
	cases := []struct {
		name        string
		vis         string
		superuser   bool
		userTags    []string
		enabledTags string
		want        bool
	}{
		{"none denies regular", visibilityNone, false, nil, "", false},
		{"none denies superuser", visibilityNone, true, nil, "", false},
		{"all allows regular", visibilityAll, false, nil, "", true},
		{"all allows superuser", visibilityAll, true, nil, "", true},
		{"superusers denies regular", visibilitySuperusers, false, nil, "", false},
		{"superusers allows superuser", visibilitySuperusers, true, nil, "", true},
		{"tagged with no enabled_tags denies", visibilityTagged, false, []string{"adults"}, "", false},
		{"tagged with overlap allows", visibilityTagged, false, []string{"adults"}, "adults,teens", true},
		{"tagged with no overlap denies", visibilityTagged, false, []string{"kids"}, "adults,teens", false},
		{"tagged ignores superuser status", visibilityTagged, true, nil, "adults", false},
		{"tagged with spaces still matches", visibilityTagged, false, []string{"teens"}, " adults , teens ", true},
		{"unknown value treated as allow", "bogus", false, nil, "", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := decide(c.vis, c.superuser, c.userTags, c.enabledTags); got != c.want {
				t.Errorf("decide(%q, superuser=%v, tags=%v, enabled=%q) = %v, want %v",
					c.vis, c.superuser, c.userTags, c.enabledTags, got, c.want)
			}
		})
	}
}

func TestFirstPathSegment(t *testing.T) {
	cases := map[string]string{
		"/gift-cards":                       "gift-cards",
		"/gift-cards/abc":                   "gift-cards",
		"/gift-cards/abc/transactions/xyz":  "gift-cards",
		"/users/u1/account-tags":            "users",
		"gift-cards":                        "gift-cards",
		"/":                                 "",
	}
	for in, want := range cases {
		if got := firstPathSegment(in); got != want {
			t.Errorf("firstPathSegment(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestAppFieldName(t *testing.T) {
	if got := appFieldName("gift-cards", "enabled"); got != "gift_cards__enabled" {
		t.Errorf("appFieldName = %q, want gift_cards__enabled", got)
	}
	if got := appFieldName("todos", "enabled_tags"); got != "todos__enabled_tags" {
		t.Errorf("appFieldName = %q, want todos__enabled_tags", got)
	}
}

func TestAppAccessFromEnv(t *testing.T) {
	t.Setenv("AEPBASE_APP_ACCESS", "")
	if cfg, err := appAccessFromEnv(); err != nil || cfg != nil {
		t.Fatalf("empty env: got cfg=%v err=%v, want nil,nil", cfg, err)
	}

	t.Setenv("AEPBASE_APP_ACCESS", "null")
	if cfg, err := appAccessFromEnv(); err != nil || cfg != nil {
		t.Fatalf("null env: got cfg=%v err=%v, want nil,nil", cfg, err)
	}

	t.Setenv("AEPBASE_APP_ACCESS", `{"collectionToApp":{"gift-cards":"gift-cards"},"appDefaults":{"gift-cards":"tagged"}}`)
	cfg, err := appAccessFromEnv()
	if err != nil {
		t.Fatalf("valid env: unexpected err %v", err)
	}
	if cfg.CollectionToApp["gift-cards"] != "gift-cards" {
		t.Errorf("collectionToApp not parsed: %v", cfg.CollectionToApp)
	}
	if cfg.AppDefaults["gift-cards"] != "tagged" {
		t.Errorf("appDefaults not parsed: %v", cfg.AppDefaults)
	}

	t.Setenv("AEPBASE_APP_ACCESS", "{not json")
	if _, err := appAccessFromEnv(); err == nil {
		t.Error("malformed env: expected error, got nil")
	}
}

func TestAccessStoreVisibilityAndTags(t *testing.T) {
	d, err := db.Init(":memory:")
	if err != nil {
		t.Fatalf("db init: %v", err)
	}
	defer d.Close()

	// app_flags: one row carrying flattened per-app flag columns.
	if err := db.CreateResourceTable(d, "app-flags", nil, []db.ColumnDef{
		{Name: "gift_cards__enabled", SQLType: "TEXT"},
		{Name: "gift_cards__enabled_tags", SQLType: "TEXT"},
		{Name: "todos__enabled", SQLType: "TEXT"},
	}); err != nil {
		t.Fatalf("create app_flags: %v", err)
	}
	if _, err := d.Exec(
		`INSERT INTO app_flags (id, path, create_time, update_time, gift_cards__enabled, gift_cards__enabled_tags, todos__enabled)
		 VALUES ('singleton','app-flags/singleton','t','t','tagged','adults,teens','superusers')`,
	); err != nil {
		t.Fatalf("seed app_flags: %v", err)
	}

	// account_tags: parented under user → user_id column.
	if err := db.CreateResourceTable(d, "account-tags", []db.ParentRef{{Singular: "user"}}, []db.ColumnDef{
		{Name: "name", SQLType: "TEXT"},
	}); err != nil {
		t.Fatalf("create account_tags: %v", err)
	}
	if _, err := d.Exec(
		`INSERT INTO account_tags (id, path, create_time, update_time, user_id, name)
		 VALUES ('t1','x','t','t','u1','adults'), ('t2','y','t','t','u1','parents'), ('t3','z','t','t','u2','kids')`,
	); err != nil {
		t.Fatalf("seed account_tags: %v", err)
	}

	store := &accessStore{db: d, tags: map[string]tagEntry{}}

	// Stored value wins over the default.
	if vis, tags := store.visibility("gift-cards", "all"); vis != "tagged" || tags != "adults,teens" {
		t.Errorf("gift-cards visibility = (%q,%q), want (tagged, adults,teens)", vis, tags)
	}
	if vis, _ := store.visibility("todos", "all"); vis != "superusers" {
		t.Errorf("todos visibility = %q, want superusers", vis)
	}
	// App with no stored value falls back to the supplied default.
	if vis, _ := store.visibility("recipes", "none"); vis != "none" {
		t.Errorf("recipes visibility = %q, want none (default)", vis)
	}

	if tags := store.userTags("u1"); len(tags) != 2 {
		t.Errorf("u1 tags = %v, want 2", tags)
	}
	if tags := store.userTags("nobody"); len(tags) != 0 {
		t.Errorf("unknown user tags = %v, want empty", tags)
	}

	// End-to-end: u1 (adults) passes the tagged gift-cards gate; u2 (kids) doesn't.
	visGC, tagsGC := store.visibility("gift-cards", "all")
	if !decide(visGC, false, store.userTags("u1"), tagsGC) {
		t.Error("u1 should pass tagged gift-cards gate")
	}
	if decide(visGC, false, store.userTags("u2"), tagsGC) {
		t.Error("u2 should NOT pass tagged gift-cards gate")
	}
}

func TestAccessCacheTTLFromEnv(t *testing.T) {
	t.Setenv("AEPBASE_ACCESS_CACHE_TTL_MS", "")
	if got := accessCacheTTLFromEnv(); got != defaultAccessCacheTTLMs*time.Millisecond {
		t.Errorf("unset → %v, want default", got)
	}
	t.Setenv("AEPBASE_ACCESS_CACHE_TTL_MS", "0")
	if got := accessCacheTTLFromEnv(); got != 0 {
		t.Errorf("0 → %v, want 0", got)
	}
	t.Setenv("AEPBASE_ACCESS_CACHE_TTL_MS", "250")
	if got := accessCacheTTLFromEnv(); got != 250*time.Millisecond {
		t.Errorf("250 → %v, want 250ms", got)
	}
	t.Setenv("AEPBASE_ACCESS_CACHE_TTL_MS", "garbage")
	if got := accessCacheTTLFromEnv(); got != defaultAccessCacheTTLMs*time.Millisecond {
		t.Errorf("garbage → %v, want default", got)
	}
}

func TestQueryFlagsRowMissingTable(t *testing.T) {
	d, err := db.Init(":memory:")
	if err != nil {
		t.Fatalf("db init: %v", err)
	}
	defer d.Close()
	// No app_flags table created → empty map, no panic (fail open to defaults).
	if got := queryFlagsRow(d); len(got) != 0 {
		t.Errorf("queryFlagsRow on missing table = %v, want empty", got)
	}
}
