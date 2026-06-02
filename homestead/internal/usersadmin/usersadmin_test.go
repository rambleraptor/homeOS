package usersadmin

import (
	"database/sql"
	"testing"

	"github.com/rambleraptor/aepbase/pkg/user"
)

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	d, err := Open(t.TempDir(), "")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { d.Close() })
	return d
}

func TestCreateGeneratesPasswordAndList(t *testing.T) {
	d := openTestDB(t)

	u, generated, err := Create(d, CreateParams{Email: "a@example.com"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if u.Type != user.TypeRegular {
		t.Errorf("type = %q, want %q", u.Type, user.TypeRegular)
	}
	if u.Path != "users/"+u.ID {
		t.Errorf("path = %q, want users/%s", u.Path, u.ID)
	}
	if len(generated) < 16 {
		t.Errorf("generated password too short: %q", generated)
	}

	// A supplied password is not echoed back.
	if _, gen2, err := Create(d, CreateParams{Email: "b@example.com", Password: "hunter2hunter2"}); err != nil {
		t.Fatalf("Create with password: %v", err)
	} else if gen2 != "" {
		t.Errorf("expected no generated password, got %q", gen2)
	}

	users, err := List(d)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(users) != 2 {
		t.Fatalf("List returned %d users, want 2", len(users))
	}
}

func TestCreateRejectsDuplicateEmailAndBadType(t *testing.T) {
	d := openTestDB(t)

	if _, _, err := Create(d, CreateParams{Email: "dup@example.com"}); err != nil {
		t.Fatalf("Create: %v", err)
	}
	if _, _, err := Create(d, CreateParams{Email: "dup@example.com"}); err == nil {
		t.Error("expected duplicate-email error")
	}
	if _, _, err := Create(d, CreateParams{Email: "x@example.com", Type: "admin"}); err == nil {
		t.Error("expected invalid-type error")
	}
	if _, _, err := Create(d, CreateParams{Email: ""}); err == nil {
		t.Error("expected missing-email error")
	}
}

func TestGetByIDAndEmail(t *testing.T) {
	d := openTestDB(t)
	created, _, err := Create(d, CreateParams{Email: "find@example.com"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	byID, err := Get(d, created.ID)
	if err != nil || byID == nil {
		t.Fatalf("Get by id: %v (user=%v)", err, byID)
	}
	byEmail, err := Get(d, "find@example.com")
	if err != nil || byEmail == nil {
		t.Fatalf("Get by email: %v (user=%v)", err, byEmail)
	}
	if byID.ID != byEmail.ID {
		t.Errorf("id/email lookups disagree: %s vs %s", byID.ID, byEmail.ID)
	}

	missing, err := Get(d, "nope@example.com")
	if err != nil {
		t.Fatalf("Get missing: %v", err)
	}
	if missing != nil {
		t.Errorf("expected nil for missing user, got %v", missing)
	}
}

func TestUpdateFieldsAndPassword(t *testing.T) {
	d := openTestDB(t)
	created, _, err := Create(d, CreateParams{Email: "u@example.com", DisplayName: "Old"})
	if err != nil {
		t.Fatalf("Create: %v", err)
	}

	newName := "New Name"
	newPass := "freshpassword123"
	updated, err := Update(d, created.ID, UpdateParams{DisplayName: &newName, Password: &newPass}, false)
	if err != nil {
		t.Fatalf("Update: %v", err)
	}
	if updated.DisplayName != newName {
		t.Errorf("display_name = %q, want %q", updated.DisplayName, newName)
	}
	if updated.Email != created.Email {
		t.Errorf("email changed unexpectedly: %q", updated.Email)
	}

	// Empty password is rejected.
	empty := ""
	if _, err := Update(d, created.ID, UpdateParams{Password: &empty}, false); err == nil {
		t.Error("expected error for empty password")
	}

	// Unknown id is rejected.
	if _, err := Update(d, "does-not-exist", UpdateParams{DisplayName: &newName}, false); err == nil {
		t.Error("expected error for unknown id")
	}
}

func TestDeleteAndLastSuperuserGuard(t *testing.T) {
	d := openTestDB(t)
	su, _, err := Create(d, CreateParams{Email: "su@example.com", Type: user.TypeSuperuser})
	if err != nil {
		t.Fatalf("Create superuser: %v", err)
	}
	reg, _, err := Create(d, CreateParams{Email: "reg@example.com"})
	if err != nil {
		t.Fatalf("Create regular: %v", err)
	}

	// Deleting the only superuser is refused without force.
	if _, err := Delete(d, su.ID, false); err == nil {
		t.Error("expected last-superuser guard to block delete")
	}
	// Demoting the only superuser is refused without force.
	regType := user.TypeRegular
	if _, err := Update(d, su.ID, UpdateParams{Type: &regType}, false); err == nil {
		t.Error("expected last-superuser guard to block demotion")
	}

	// A regular user deletes fine.
	deleted, err := Delete(d, reg.ID, false)
	if err != nil || !deleted {
		t.Fatalf("Delete regular: deleted=%v err=%v", deleted, err)
	}

	// With force, the last superuser can be deleted.
	deleted, err = Delete(d, su.ID, true)
	if err != nil || !deleted {
		t.Fatalf("forced Delete superuser: deleted=%v err=%v", deleted, err)
	}

	// Deleting a non-existent user reports false, no error.
	if deleted, err := Delete(d, "ghost", false); err != nil || deleted {
		t.Errorf("Delete ghost: deleted=%v err=%v", deleted, err)
	}
}
