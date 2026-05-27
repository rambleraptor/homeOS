package project

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
)

func writeProject(t *testing.T, root string, files map[string]string) {
	t.Helper()
	for rel, body := range files {
		full := filepath.Join(root, rel)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func TestLoad_FindsConfigAndModules(t *testing.T) {
	root := t.TempDir()
	writeProject(t, root, map[string]string{
		"homestead.config.ts": "export default { modules: [] };\n",
		"modules/hello.ts":    "export const helloModule = {};\n",
	})

	p, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	if p.ConfigPath != filepath.Join(root, "homestead.config.ts") {
		t.Errorf("config path = %q", p.ConfigPath)
	}
	if p.ModulesDir == "" {
		t.Errorf("expected ModulesDir to be set")
	}
}

func TestLoad_MissingConfig(t *testing.T) {
	if _, err := Load(t.TempDir()); err == nil {
		t.Fatalf("expected error for project without homestead.config.ts")
	}
}

func TestCacheKey_StableAndSensitive(t *testing.T) {
	embed := fstest.MapFS{
		"frontend/package.json": &fstest.MapFile{Data: []byte(`{"name":"x"}`)},
		"packages/a/index.ts":   &fstest.MapFile{Data: []byte(`export {}`)},
	}
	root := t.TempDir()
	writeProject(t, root, map[string]string{
		"homestead.config.ts": "export default { modules: [] };\n",
		"modules/hello.ts":    "export const helloModule = {};\n",
	})
	p, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}

	k1, err := CacheKey(embed, p)
	if err != nil {
		t.Fatal(err)
	}
	k2, err := CacheKey(embed, p)
	if err != nil {
		t.Fatal(err)
	}
	if k1 != k2 {
		t.Errorf("cache key not stable: %q vs %q", k1, k2)
	}

	// Mutating user config busts the key.
	if err := os.WriteFile(p.ConfigPath, []byte("export default { modules: ['x'] };\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	k3, err := CacheKey(embed, p)
	if err != nil {
		t.Fatal(err)
	}
	if k3 == k1 {
		t.Errorf("expected key to change after editing user config")
	}

	// Mutating a custom module busts the key.
	if err := os.WriteFile(filepath.Join(p.ModulesDir, "hello.ts"), []byte("export const helloModule = { id: 1 };\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	k4, err := CacheKey(embed, p)
	if err != nil {
		t.Fatal(err)
	}
	if k4 == k3 {
		t.Errorf("expected key to change after editing a custom module")
	}
}

func TestExtract_WritesEmbedThenOverlay(t *testing.T) {
	embed := fstest.MapFS{
		"homestead.config.ts":         &fstest.MapFile{Data: []byte("default config\n")},
		"frontend/package.json":       &fstest.MapFile{Data: []byte(`{"name":"frontend"}`)},
		"packages/core/index.ts":      &fstest.MapFile{Data: []byte("export {};\n")},
		"frontend/.gitkeep":           &fstest.MapFile{Data: []byte("")},
	}
	root := t.TempDir()
	writeProject(t, root, map[string]string{
		"homestead.config.ts": "USER CONFIG\n",
		"modules/hello.ts":    "USER MODULE\n",
	})
	p, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}

	dest := filepath.Join(t.TempDir(), "ws")
	if err := Extract(embed, p, dest); err != nil {
		t.Fatal(err)
	}

	cfg, err := os.ReadFile(filepath.Join(dest, "homestead.config.ts"))
	if err != nil {
		t.Fatal(err)
	}
	if string(cfg) != "USER CONFIG\n" {
		t.Errorf("expected user config to overwrite default, got %q", cfg)
	}
	mod, err := os.ReadFile(filepath.Join(dest, "modules", "hello.ts"))
	if err != nil {
		t.Fatal(err)
	}
	if string(mod) != "USER MODULE\n" {
		t.Errorf("modules/hello.ts = %q", mod)
	}
	if _, err := os.Stat(filepath.Join(dest, "frontend", "package.json")); err != nil {
		t.Errorf("expected embedded frontend/package.json: %v", err)
	}
}

func TestExtract_IsIdempotent(t *testing.T) {
	embed := fstest.MapFS{
		"homestead.config.ts": &fstest.MapFile{Data: []byte("default\n")},
	}
	root := t.TempDir()
	writeProject(t, root, map[string]string{
		"homestead.config.ts": "v1\n",
	})
	p, err := Load(root)
	if err != nil {
		t.Fatal(err)
	}
	dest := filepath.Join(t.TempDir(), "ws")
	if err := Extract(embed, p, dest); err != nil {
		t.Fatal(err)
	}

	// Edit user config; a second extract should overlay the new value
	// without re-dumping the embedded source (cache hit path).
	if err := os.WriteFile(p.ConfigPath, []byte("v2\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := Extract(embed, p, dest); err != nil {
		t.Fatal(err)
	}
	cfg, _ := os.ReadFile(filepath.Join(dest, "homestead.config.ts"))
	if string(cfg) != "v2\n" {
		t.Errorf("expected user config refresh on second extract, got %q", cfg)
	}
}
