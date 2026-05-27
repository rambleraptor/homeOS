package aepbaserun

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/rambleraptor/aepbase/pkg/user"
)

const (
	credentialsFileName = "credentials.json"
	bootstrapEmail      = "admin@example.com"
)

// bootstrapSuperuser handles the first-boot superuser creation that
// upstream aepbase normally does inside EnableUsers (and prints to stdout
// where we can't recover it). We want the credentials in hand so they
// can be passed to the Next subprocess for the schema-sync step.
//
// Flow:
//
//   - If credentials.json exists in dataDir, reuse it (whether or not the
//     user actually exists in the DB).
//   - Otherwise count users in the DB. If zero, generate a password,
//     insert the superuser ourselves with the same shape EnableUsers
//     would have used, and persist credentials.json. EnableUsers then
//     sees count > 0 and skips its bootstrap branch.
//   - If users exist but credentials.json is missing, return an error —
//     we have no way to recover the password. Operators should pass
//     --reset-admin (followup) or delete data/ and restart.
func bootstrapSuperuser(d *sql.DB, dataDir string) (*Credentials, error) {
	if err := user.CreateUsersTable(d); err != nil {
		return nil, fmt.Errorf("ensure users table: %w", err)
	}

	credsPath := filepath.Join(dataDir, credentialsFileName)
	if c, err := readCreds(credsPath); err == nil {
		return c, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("read %s: %w", credsPath, err)
	}

	count, err := user.CountUsers(d)
	if err != nil {
		return nil, fmt.Errorf("count users: %w", err)
	}
	if count > 0 {
		return nil, fmt.Errorf("aepbase database already contains users but %s is missing — delete %s and restart, or restore the credentials file", credsPath, dataDir)
	}

	password, err := randomPassword()
	if err != nil {
		return nil, fmt.Errorf("generate password: %w", err)
	}
	hash, err := user.HashPassword(password)
	if err != nil {
		return nil, fmt.Errorf("hash password: %w", err)
	}
	id := user.GenerateID()
	now := time.Now().UTC().Format(time.RFC3339)
	u := &user.User{
		ID:          id,
		Path:        "users/" + id,
		Email:       bootstrapEmail,
		DisplayName: "Admin",
		Type:        user.TypeSuperuser,
		CreateTime:  now,
		UpdateTime:  now,
	}
	if err := user.InsertUser(d, u, hash); err != nil {
		return nil, fmt.Errorf("insert superuser: %w", err)
	}

	creds := &Credentials{Email: bootstrapEmail, Password: password}
	if err := writeCreds(credsPath, creds); err != nil {
		return nil, fmt.Errorf("persist %s: %w", credsPath, err)
	}
	return creds, nil
}

func randomPassword() (string, error) {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}

type credsFile struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func readCreds(path string) (*Credentials, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var c credsFile
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse credentials: %w", err)
	}
	if c.Email == "" || c.Password == "" {
		return nil, fmt.Errorf("credentials file at %s is missing email or password", path)
	}
	return &Credentials{Email: c.Email, Password: c.Password}, nil
}

func writeCreds(path string, c *Credentials) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	body, err := json.MarshalIndent(credsFile{Email: c.Email, Password: c.Password}, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, body, 0o600)
}
