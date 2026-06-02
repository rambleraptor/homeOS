// Package usersadmin provides direct-to-SQLite CRUD on aepbase users for the
// `homestead users` CLI command.
//
// It deliberately mirrors internal/aepbaserun/bootstrap.go: open the project's
// data/aepbase.db with db.Init and drive the github.com/rambleraptor/aepbase
// pkg/user functions. This needs no auth/credentials, and because db.Init opens
// the database in WAL mode with a busy timeout, the command works while
// `homestead start` is running — the live server reads user rows per-request,
// so changes land immediately without a restart.
package usersadmin

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/rambleraptor/aepbase/pkg/db"
	"github.com/rambleraptor/aepbase/pkg/user"
)

// DefaultDBFile is the sqlite file name inside the data dir.
const DefaultDBFile = "aepbase.db"

// listPageSize is the page size used when paging through ListUsers.
const listPageSize = 200

// Open opens the aepbase sqlite database under dataDir and ensures the users
// table exists. The caller is responsible for closing the returned DB.
//
// dbFile defaults to DefaultDBFile when empty.
func Open(dataDir, dbFile string) (*sql.DB, error) {
	if dbFile == "" {
		dbFile = DefaultDBFile
	}
	d, err := db.Init(filepath.Join(dataDir, dbFile))
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := user.CreateUsersTable(d); err != nil {
		d.Close()
		return nil, fmt.Errorf("ensure users table: %w", err)
	}
	if err := user.CreateTokensTable(d); err != nil {
		d.Close()
		return nil, fmt.Errorf("ensure tokens table: %w", err)
	}
	return d, nil
}

// List returns every user, paging through ListUsers until exhausted.
func List(d *sql.DB) ([]user.User, error) {
	var all []user.User
	token := ""
	for {
		page, next, err := user.ListUsers(d, listPageSize, token)
		if err != nil {
			return nil, fmt.Errorf("list users: %w", err)
		}
		all = append(all, page...)
		if next == "" {
			break
		}
		token = next
	}
	return all, nil
}

// Get resolves a single user by id, falling back to an email lookup when the
// selector contains an "@" and no user matched by id. Returns nil if no user
// matched.
func Get(d *sql.DB, idOrEmail string) (*user.User, error) {
	u, _, err := user.GetUserByID(d, idOrEmail)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	if u == nil && strings.Contains(idOrEmail, "@") {
		u, _, err = user.GetUserByEmail(d, idOrEmail)
		if err != nil {
			return nil, fmt.Errorf("get user by email: %w", err)
		}
	}
	return u, nil
}

// CreateParams describes a new user. Type defaults to user.TypeRegular when
// empty. When Password is empty a random one is generated and returned.
type CreateParams struct {
	Email       string
	DisplayName string
	Type        string
	Password    string
}

// Create inserts a new user. It returns the created user and, when no password
// was supplied, the generated plaintext password (so the caller can surface it
// once). A supplied password is never echoed back.
func Create(d *sql.DB, p CreateParams) (*user.User, string, error) {
	email := strings.TrimSpace(p.Email)
	if email == "" {
		return nil, "", fmt.Errorf("email is required")
	}
	typ := p.Type
	if typ == "" {
		typ = user.TypeRegular
	}
	if err := validateType(typ); err != nil {
		return nil, "", err
	}

	existing, _, err := user.GetUserByEmail(d, email)
	if err != nil {
		return nil, "", fmt.Errorf("check existing email: %w", err)
	}
	if existing != nil {
		return nil, "", fmt.Errorf("a user with email %q already exists", email)
	}

	password := p.Password
	generated := ""
	if password == "" {
		password, err = randomPassword()
		if err != nil {
			return nil, "", fmt.Errorf("generate password: %w", err)
		}
		generated = password
	}
	hash, err := user.HashPassword(password)
	if err != nil {
		return nil, "", fmt.Errorf("hash password: %w", err)
	}

	id := user.GenerateID()
	now := time.Now().UTC().Format(time.RFC3339)
	u := &user.User{
		ID:          id,
		Path:        "users/" + id,
		Email:       email,
		DisplayName: p.DisplayName,
		Type:        typ,
		CreateTime:  now,
		UpdateTime:  now,
	}
	if err := user.InsertUser(d, u, hash); err != nil {
		return nil, "", fmt.Errorf("insert user: %w", err)
	}
	return u, generated, nil
}

// UpdateParams holds the fields to change on an existing user. A nil pointer
// means "leave unchanged"; a non-nil pointer (even to an empty string) updates
// the column.
type UpdateParams struct {
	Email       *string
	DisplayName *string
	Type        *string
	Password    *string
}

// Update applies the changed fields to the user with the given id. It refuses
// to demote the last remaining superuser unless force is true.
func Update(d *sql.DB, id string, p UpdateParams, force bool) (*user.User, error) {
	current, _, err := user.GetUserByID(d, id)
	if err != nil {
		return nil, fmt.Errorf("load user: %w", err)
	}
	if current == nil {
		return nil, fmt.Errorf("no user with id %q", id)
	}

	fields := map[string]string{}
	if p.Email != nil {
		email := strings.TrimSpace(*p.Email)
		if email == "" {
			return nil, fmt.Errorf("email cannot be empty")
		}
		if other, _, err := user.GetUserByEmail(d, email); err != nil {
			return nil, fmt.Errorf("check existing email: %w", err)
		} else if other != nil && other.ID != id {
			return nil, fmt.Errorf("a user with email %q already exists", email)
		}
		fields["email"] = email
	}
	if p.DisplayName != nil {
		fields["display_name"] = *p.DisplayName
	}
	if p.Type != nil {
		if err := validateType(*p.Type); err != nil {
			return nil, err
		}
		if current.Type == user.TypeSuperuser && *p.Type != user.TypeSuperuser && !force {
			if err := guardLastSuperuser(d, id); err != nil {
				return nil, err
			}
		}
		fields["type"] = *p.Type
	}
	if p.Password != nil {
		if *p.Password == "" {
			return nil, fmt.Errorf("password cannot be empty")
		}
		hash, err := user.HashPassword(*p.Password)
		if err != nil {
			return nil, fmt.Errorf("hash password: %w", err)
		}
		fields["password_hash"] = hash
	}

	if len(fields) == 0 {
		return current, nil
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if err := user.UpdateUser(d, id, fields, now); err != nil {
		return nil, fmt.Errorf("update user: %w", err)
	}
	updated, _, err := user.GetUserByID(d, id)
	if err != nil {
		return nil, fmt.Errorf("reload user: %w", err)
	}
	return updated, nil
}

// Delete removes the user with the given id (and revokes their tokens). It
// refuses to delete the last remaining superuser unless force is true. Returns
// false if no user matched.
func Delete(d *sql.DB, id string, force bool) (bool, error) {
	current, _, err := user.GetUserByID(d, id)
	if err != nil {
		return false, fmt.Errorf("load user: %w", err)
	}
	if current == nil {
		return false, nil
	}
	if current.Type == user.TypeSuperuser && !force {
		if err := guardLastSuperuser(d, id); err != nil {
			return false, err
		}
	}
	if err := user.DeleteTokensByUser(d, id); err != nil {
		return false, fmt.Errorf("revoke tokens: %w", err)
	}
	deleted, err := user.DeleteUser(d, id)
	if err != nil {
		return false, fmt.Errorf("delete user: %w", err)
	}
	return deleted, nil
}

// validateType ensures typ is one of the aepbase user types.
func validateType(typ string) error {
	switch typ {
	case user.TypeRegular, user.TypeSuperuser:
		return nil
	default:
		return fmt.Errorf("invalid type %q (want %q or %q)", typ, user.TypeRegular, user.TypeSuperuser)
	}
}

// guardLastSuperuser returns an error if removing or demoting the user with
// excludeID would leave the instance with no superuser.
func guardLastSuperuser(d *sql.DB, excludeID string) error {
	users, err := List(d)
	if err != nil {
		return err
	}
	for _, u := range users {
		if u.Type == user.TypeSuperuser && u.ID != excludeID {
			return nil
		}
	}
	return fmt.Errorf("refusing to remove or demote the last superuser (pass --force to override)")
}

// randomPassword returns a 24-char hex string, matching the shape used by the
// bootstrap superuser.
func randomPassword() (string, error) {
	var b [12]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(b[:]), nil
}
