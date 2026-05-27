package project

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScaffold_FreshDir(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "demo")
	if err := Scaffold(ScaffoldOptions{Dir: dir}); err != nil {
		t.Fatal(err)
	}
	cfg, err := os.ReadFile(filepath.Join(dir, "homestead.config.ts"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(cfg), "HomesteadConfig") {
		t.Errorf("config template missing HomesteadConfig import: %s", cfg)
	}
	if _, err := os.Stat(filepath.Join(dir, "modules", "README.md")); err != nil {
		t.Errorf("modules/README.md not written: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, ".gitignore")); err != nil {
		t.Errorf(".gitignore not written: %v", err)
	}

	// Load should now succeed on the scaffolded dir.
	if _, err := Load(dir); err != nil {
		t.Errorf("Load on scaffolded dir failed: %v", err)
	}
}

func TestScaffold_RefusesNonEmptyDir(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "stray.txt"), []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Scaffold(ScaffoldOptions{Dir: dir}); err == nil {
		t.Errorf("expected refusal for non-empty dir")
	}
}
