package project

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

// CacheRoot returns the base cache dir (~/.homestead/cache by default).
//
// Honors HOMESTEAD_CACHE_DIR for tests + power-user overrides.
func CacheRoot() (string, error) {
	if v := os.Getenv("HOMESTEAD_CACHE_DIR"); v != "" {
		return v, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, ".homestead", "cache"), nil
}

// CacheKey returns a stable hex SHA-256 of every input that should bust
// the build cache: the embedded source tree, the user's homestead.config.ts,
// and every file under the user's modules/ directory.
//
// Runtime concerns (ports, data-dir, env vars) deliberately don't bust
// the cache — they're injected into the Next subprocess at start time,
// not baked into the build.
func CacheKey(embedFS fs.FS, p *Project) (string, error) {
	h := sha256.New()

	if err := hashFS(h, embedFS); err != nil {
		return "", fmt.Errorf("hash embedded source: %w", err)
	}

	io.WriteString(h, "\x00user-config\x00")
	cfg, err := os.ReadFile(p.ConfigPath)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", p.ConfigPath, err)
	}
	h.Write(cfg)

	if p.ModulesDir != "" {
		io.WriteString(h, "\x00user-modules\x00")
		if err := hashDir(h, p.ModulesDir); err != nil {
			return "", fmt.Errorf("hash user modules: %w", err)
		}
	}

	return hex.EncodeToString(h.Sum(nil)), nil
}

// WorkspaceDir returns the per-cache-key build workspace directory.
func WorkspaceDir(cacheRoot, key string) string {
	return filepath.Join(cacheRoot, key, "workspace")
}

func hashFS(h io.Writer, f fs.FS) error {
	return fs.WalkDir(f, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if _, err := io.WriteString(h, path); err != nil {
			return err
		}
		if _, err := h.Write([]byte{0}); err != nil {
			return err
		}
		file, err := f.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(h, file)
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
}

func hashDir(h io.Writer, root string) error {
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if _, err := io.WriteString(h, filepath.ToSlash(rel)); err != nil {
			return err
		}
		if _, err := h.Write([]byte{0}); err != nil {
			return err
		}
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(h, file)
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
}
