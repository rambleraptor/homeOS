// Package project models the user's Homestead instance — the homestead.config.ts
// they edit, their custom modules/, and the data dir aepbase will write to.
package project

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// Project describes the layout of a user's Homestead project directory.
//
// The launcher always runs against one Project. Most commands resolve it
// from CWD via Load.
type Project struct {
	// Root is the absolute path to the project directory.
	Root string

	// ConfigPath is the absolute path to <Root>/homestead.config.ts.
	ConfigPath string

	// ModulesDir is the absolute path to <Root>/modules. Empty string if
	// the user has no custom modules directory.
	ModulesDir string

	// DataDir is where aepbase will keep its sqlite db + uploaded files.
	// Defaults to <Root>/data; the start command may override it.
	DataDir string
}

// Load locates a project from the given directory (typically CWD).
//
// A directory counts as a project root if it contains homestead.config.ts.
// We don't walk up to a parent — explicit beats implicit, and the binary
// is meant to be run from inside the user's project.
func Load(dir string) (*Project, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return nil, fmt.Errorf("resolve %q: %w", dir, err)
	}
	cfg := filepath.Join(abs, "homestead.config.ts")
	if _, err := os.Stat(cfg); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil, fmt.Errorf("no homestead.config.ts in %s — run `homestead init` to scaffold one", abs)
		}
		return nil, fmt.Errorf("stat %s: %w", cfg, err)
	}

	p := &Project{
		Root:       abs,
		ConfigPath: cfg,
		DataDir:    filepath.Join(abs, "data"),
	}

	modulesDir := filepath.Join(abs, "modules")
	if info, err := os.Stat(modulesDir); err == nil && info.IsDir() {
		p.ModulesDir = modulesDir
	}

	return p, nil
}
