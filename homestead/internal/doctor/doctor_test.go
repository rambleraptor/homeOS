package doctor

import (
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"homestead/cli/internal/project"
)

// freshProject scaffolds the minimum file layout that project.Load accepts.
func freshProject(t *testing.T) *project.Project {
	t.Helper()
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "homestead.config.ts"), []byte("export default { modules: [] };\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "modules"), 0o755); err != nil {
		t.Fatal(err)
	}
	p, err := project.Load(dir)
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func TestCheckModules_EmptyDir(t *testing.T) {
	p := freshProject(t)
	c := checkModules(p)
	if c.Status != OK || !strings.Contains(c.Detail, "empty") {
		t.Errorf("unexpected: %+v", c)
	}
}

func TestCheckModules_ListsFiles(t *testing.T) {
	p := freshProject(t)
	if err := os.WriteFile(filepath.Join(p.ModulesDir, "hello.ts"), []byte("export {}"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(p.ModulesDir, "world.ts"), []byte("export {}"), 0o644); err != nil {
		t.Fatal(err)
	}
	c := checkModules(p)
	if c.Status != OK {
		t.Errorf("status = %v", c.Status)
	}
	if !strings.Contains(c.Detail, "hello.ts") || !strings.Contains(c.Detail, "world.ts") {
		t.Errorf("detail missing files: %q", c.Detail)
	}
}

func TestCheckDataDir_MissingIsOK(t *testing.T) {
	p := freshProject(t)
	// p.DataDir is <project>/data, never created by freshProject.
	c := checkDataDir(p, "")
	if c.Status != OK {
		t.Errorf("status = %v, detail = %q", c.Status, c.Detail)
	}
}

func TestCheckDataDir_PresentWithCreds(t *testing.T) {
	p := freshProject(t)
	if err := os.MkdirAll(p.DataDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(p.DataDir, "credentials.json"), []byte("{}"), 0o600); err != nil {
		t.Fatal(err)
	}
	c := checkDataDir(p, "")
	if c.Status != OK || !strings.Contains(c.Detail, "credentials.json present") {
		t.Errorf("unexpected: %+v", c)
	}
}

func TestCheckPort_AvailableVsBusy(t *testing.T) {
	// Bind a port so we know it's busy.
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	busyPort := l.Addr().(*net.TCPAddr).Port

	c := checkPort("frontend port", busyPort)
	if c.Status != Warn {
		t.Errorf("expected Warn for busy port %d, got %v", busyPort, c.Status)
	}
	if !strings.Contains(c.Name, strconv.Itoa(busyPort)) {
		t.Errorf("name missing port: %q", c.Name)
	}

	// Free port — Listen then immediately close to grab a known-free port.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	freePort := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	c = checkPort("aepbase port", freePort)
	if c.Status != OK {
		t.Errorf("expected OK for free port %d, got %v (%q)", freePort, c.Status, c.Detail)
	}
}

func TestRun_NoProjectIsWarn(t *testing.T) {
	dir := t.TempDir() // no homestead.config.ts
	checks := Run(Options{ProjectDir: dir})
	var found bool
	for _, c := range checks {
		if c.Name == "project" {
			found = true
			if c.Status != Warn {
				t.Errorf("expected Warn, got %v: %q", c.Status, c.Detail)
			}
		}
	}
	if !found {
		t.Fatalf("project check missing from %v", checks)
	}
}

func TestHasFailures(t *testing.T) {
	if HasFailures(nil) {
		t.Error("nil should not be a failure")
	}
	if HasFailures([]Check{{Status: OK}, {Status: Warn}}) {
		t.Error("OK+Warn should not be a failure")
	}
	if !HasFailures([]Check{{Status: OK}, {Status: Fail}}) {
		t.Error("Fail should be a failure")
	}
}

func TestHumanBytes(t *testing.T) {
	cases := []struct {
		in   int64
		want string
	}{
		{0, "0B"},
		{1023, "1023B"},
		{1024, "1.0KB"},
		{1024 * 1024 * 5, "5.0MB"},
	}
	for _, c := range cases {
		got := humanBytes(c.in)
		if got != c.want {
			t.Errorf("humanBytes(%d) = %q, want %q", c.in, got, c.want)
		}
	}
}
