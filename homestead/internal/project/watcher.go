package project

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/fsnotify/fsnotify"
)

// WatchModules mirrors edits in the user's modules/ dir into the build
// workspace's modules/ dir. It blocks until ctx is cancelled. Errors are
// written to logOut with a [watcher] prefix; the loop keeps running so
// transient hiccups (e.g. a momentarily-missing file) don't kill HMR.
//
// Implementation note: instead of tracking individual files, we re-copy
// the whole modules directory on every change. The dirs are small
// (kilobytes) and this avoids correctness bugs around renames and
// nested adds. Events are debounced by 150ms so a burst of fs activity
// collapses into one copy.
func WatchModules(ctx context.Context, projectModulesDir, workspaceModulesDir string, logOut io.Writer) error {
	if projectModulesDir == "" {
		// User has no modules/ dir — nothing to watch.
		<-ctx.Done()
		return nil
	}

	w, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("create watcher: %w", err)
	}
	defer w.Close()

	if err := addRecursive(w, projectModulesDir); err != nil {
		return fmt.Errorf("watch %s: %w", projectModulesDir, err)
	}

	debounce := time.NewTimer(0)
	if !debounce.Stop() {
		<-debounce.C
	}
	debouncing := false

	for {
		select {
		case <-ctx.Done():
			return nil
		case ev, ok := <-w.Events:
			if !ok {
				return nil
			}
			// If a directory was just created, start watching it too
			// (fsnotify on macOS doesn't watch subdirs recursively).
			if ev.Op&fsnotify.Create != 0 {
				if info, statErr := os.Stat(ev.Name); statErr == nil && info.IsDir() {
					_ = w.Add(ev.Name)
				}
			}
			if !debouncing {
				debouncing = true
				debounce.Reset(150 * time.Millisecond)
			}
		case err, ok := <-w.Errors:
			if !ok {
				return nil
			}
			fmt.Fprintf(logOut, "[watcher] error: %v\n", err)
		case <-debounce.C:
			debouncing = false
			if err := mirrorModules(projectModulesDir, workspaceModulesDir); err != nil {
				fmt.Fprintf(logOut, "[watcher] mirror failed: %v\n", err)
			}
		}
	}
}

func addRecursive(w *fsnotify.Watcher, root string) error {
	return filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return w.Add(path)
		}
		return nil
	})
}

// mirrorModules clears dest and re-copies src into it. Caller's responsibility
// to ensure both paths are well-formed.
func mirrorModules(src, dest string) error {
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	return copyTree(src, dest)
}
