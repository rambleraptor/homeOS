package main

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func TestRegexpOperator(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	cases := []struct {
		value, pattern string
		want           bool
	}{
		{"hello world", "^hello", true},
		{"hello world", "^world", false},
		{"abc123", `\d+`, true},
		{"abc", `\d+`, false},
	}
	for _, c := range cases {
		var got bool
		if err := db.QueryRow("SELECT ? REGEXP ?", c.value, c.pattern).Scan(&got); err != nil {
			t.Fatalf("REGEXP %q against %q: %v", c.pattern, c.value, err)
		}
		if got != c.want {
			t.Errorf("REGEXP %q against %q: got %v, want %v", c.pattern, c.value, got, c.want)
		}
	}

	// Bad patterns should surface as a query error, not a panic.
	if err := db.QueryRow("SELECT ? REGEXP ?", "x", "[").Scan(new(bool)); err == nil {
		t.Error("expected error for invalid regex pattern, got nil")
	}
}
