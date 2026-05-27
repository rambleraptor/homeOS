package aepbaserun

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/rambleraptor/aepbase/pkg/db"
	"github.com/rambleraptor/aepbase/pkg/user"
)

// Verifies the bootstrap interception:
//   - On a fresh DB, we generate and persist credentials, and the inserted
//     user is exactly what aepbase.EnableUsers would have created (same
//     email, same TypeSuperuser, etc.) so EnableUsers's count > 0 branch
//     takes over and the upstream code never prints to stdout.
//   - A second call reuses credentials.json instead of regenerating.
func TestBootstrapSuperuser_RoundTrip(t *testing.T) {
	dataDir := t.TempDir()
	sqlDB, err := db.Init(filepath.Join(dataDir, "aepbase.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	creds, err := bootstrapSuperuser(sqlDB, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if creds.Email != bootstrapEmail {
		t.Errorf("email = %q want %q", creds.Email, bootstrapEmail)
	}
	if len(creds.Password) < 16 {
		t.Errorf("password too short: %q", creds.Password)
	}

	// Confirm aepbase will see count > 0 and skip its own bootstrap.
	count, err := user.CountUsers(sqlDB)
	if err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Errorf("expected 1 user after bootstrap, got %d", count)
	}

	// Credentials file persisted.
	if _, err := os.Stat(filepath.Join(dataDir, credentialsFileName)); err != nil {
		t.Errorf("credentials file not written: %v", err)
	}

	// Second call returns the same creds (reads from disk).
	creds2, err := bootstrapSuperuser(sqlDB, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	if creds2.Password != creds.Password {
		t.Errorf("credentials changed between calls: %q vs %q", creds.Password, creds2.Password)
	}
}

// If the DB already has users but credentials.json is missing, we should
// refuse rather than silently locking the user out.
func TestBootstrapSuperuser_UsersExistNoCreds(t *testing.T) {
	dataDir := t.TempDir()
	sqlDB, err := db.Init(filepath.Join(dataDir, "aepbase.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()

	if _, err := bootstrapSuperuser(sqlDB, dataDir); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(dataDir, credentialsFileName)); err != nil {
		t.Fatal(err)
	}
	if _, err := bootstrapSuperuser(sqlDB, dataDir); err == nil {
		t.Errorf("expected error when DB has users but credentials.json is missing")
	}
}
