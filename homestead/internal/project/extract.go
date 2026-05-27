package project

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

// Extract materializes a build-ready workspace at dest.
//
// The flow is:
//  1. If dest already exists, treat it as a cache hit (the cache key
//     already covered every input — see CacheKey). Re-overlay the user's
//     config + modules anyway, in case the user mutated them in a way the
//     hash didn't catch (e.g. they edited a file mid-run; the next start
//     would recompute the key, but during this run we always want the
//     latest user files in the workspace).
//  2. Otherwise, dump the embedded FS to a sibling tmp dir, overlay the
//     user files, then atomic-rename into dest.
//
// The atomic rename keeps a half-extracted workspace from being mistaken
// for a cache hit if the binary dies mid-extract.
func Extract(embedFS fs.FS, p *Project, dest string) error {
	if info, err := os.Stat(dest); err == nil {
		if !info.IsDir() {
			return fmt.Errorf("cache target %s is not a directory", dest)
		}
		return overlayUserFiles(p, dest)
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("stat %s: %w", dest, err)
	}

	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", filepath.Dir(dest), err)
	}

	tmp, err := os.MkdirTemp(filepath.Dir(dest), "workspace-tmp-*")
	if err != nil {
		return fmt.Errorf("mktemp: %w", err)
	}
	defer os.RemoveAll(tmp) // best-effort cleanup if anything below fails

	if err := dumpFS(embedFS, tmp); err != nil {
		return fmt.Errorf("dump embedded source: %w", err)
	}
	if err := overlayUserFiles(p, tmp); err != nil {
		return fmt.Errorf("overlay user files: %w", err)
	}
	if err := os.Rename(tmp, dest); err != nil {
		return fmt.Errorf("rename %s -> %s: %w", tmp, dest, err)
	}
	return nil
}

func dumpFS(src fs.FS, dest string) error {
	return fs.WalkDir(src, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		target := filepath.Join(dest, path)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		// .gitkeep placeholder in the embed mirror — skip it.
		if filepath.Base(path) == ".gitkeep" {
			return nil
		}
		in, err := src.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
		if err != nil {
			return err
		}
		if _, err := io.Copy(out, in); err != nil {
			out.Close()
			return err
		}
		return out.Close()
	})
}

func overlayUserFiles(p *Project, workspaceDir string) error {
	// 1. Copy user's homestead.config.ts to <workspace>/homestead.config.ts,
	//    overwriting the default that came from the embed.
	cfgTarget := filepath.Join(workspaceDir, "homestead.config.ts")
	if err := copyFile(p.ConfigPath, cfgTarget); err != nil {
		return fmt.Errorf("copy homestead.config.ts: %w", err)
	}

	// 2. Wipe <workspace>/modules/ and re-copy from p.ModulesDir.
	modulesTarget := filepath.Join(workspaceDir, "modules")
	if err := os.RemoveAll(modulesTarget); err != nil {
		return fmt.Errorf("clear %s: %w", modulesTarget, err)
	}
	if p.ModulesDir == "" {
		return nil
	}
	if err := copyTree(p.ModulesDir, modulesTarget); err != nil {
		return fmt.Errorf("copy modules: %w", err)
	}
	return nil
}

func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, in); err != nil {
		out.Close()
		return err
	}
	return out.Close()
}

func copyTree(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		return copyFile(path, target)
	})
}
