// Package noderun runs Node.js subprocesses (npm ci, next dev/start) and
// multiplexes their stdout/stderr into a single line-prefixed stream.
package noderun

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"syscall"
)

// Toolchain resolves the host's Node.js + npm binaries up front so we can
// fail fast with a clear message if either is missing.
type Toolchain struct {
	NodePath string
	NpmPath  string
}

// FindToolchain looks up node + npm on PATH. Returns an error mentioning
// both if either is missing.
func FindToolchain() (*Toolchain, error) {
	node, err := exec.LookPath("node")
	if err != nil {
		return nil, fmt.Errorf("node not found on PATH (install Node.js 20+ from https://nodejs.org)")
	}
	npm, err := exec.LookPath("npm")
	if err != nil {
		return nil, fmt.Errorf("npm not found on PATH (comes with Node.js 20+)")
	}
	return &Toolchain{NodePath: node, NpmPath: npm}, nil
}

// RunNpmInstall runs `npm install` in workspaceDir, line-prefixing output
// with [npm]. Notes on flag choices:
//
//   - `install` (not `ci`): the embedded lockfile is whatever-platform
//     the binary was built on, and `npm ci` refuses to add missing
//     platform-specific optional deps (e.g. @img/sharp-darwin-arm64 when
//     the lockfile was generated on Linux). `npm install` resolves those
//     freshly and rewrites the workspace's lockfile. Each cache dir owns
//     its own lockfile, so the embed isn't mutated.
//
//   - `--ignore-scripts`: works around a sharp + npm 11 + Node 22+
//     ordering bug where sharp's `install` script runs before its
//     platform-specific optional deps (`@img/sharp-darwin-arm64` etc.)
//     are extracted into node_modules. With the script skipped, the
//     optional deps land normally and sharp finds them at runtime
//     without needing the postinstall. None of our other workspace
//     deps require a postinstall step.
func (tc *Toolchain) RunNpmInstall(ctx context.Context, workspaceDir string, out io.Writer, outMu *sync.Mutex) error {
	cmd := exec.CommandContext(ctx, tc.NpmPath, "install",
		"--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error")
	cmd.Dir = workspaceDir
	cmd.Env = append(os.Environ(),
		"NODE_NO_WARNINGS=1",
		"NEXT_TELEMETRY_DISABLED=1",
	)
	return runWithPrefix(cmd, "[npm]", out, outMu)
}

// NextDev starts `next dev` as a subprocess and returns once it's been
// spawned. Caller is responsible for calling Subprocess.Stop. Use
// Subprocess.Wait to block on exit.
func (tc *Toolchain) NextDev(
	workspaceDir string,
	port int,
	env map[string]string,
	out io.Writer,
	outMu *sync.Mutex,
) (*Subprocess, error) {
	return tc.startNext(workspaceDir, port, env, []string{"dev", "-p", strconv.Itoa(port), "-H", "127.0.0.1"}, out, outMu)
}

// NextStart starts `next start` (production server). Available once a
// build has been produced in <workspaceDir>/.next/.
func (tc *Toolchain) NextStart(
	workspaceDir string,
	port int,
	env map[string]string,
	out io.Writer,
	outMu *sync.Mutex,
) (*Subprocess, error) {
	return tc.startNext(workspaceDir, port, env, []string{"start", "-p", strconv.Itoa(port), "-H", "127.0.0.1"}, out, outMu)
}

// Subprocess wraps an exec.Cmd with helpers for graceful shutdown and
// multiplexed-log lifecycle.
type Subprocess struct {
	cmd      *exec.Cmd
	stopOnce sync.Once
	pipesWG  sync.WaitGroup
}

// Wait blocks until the subprocess has exited, including all log pumps.
func (s *Subprocess) Wait() error {
	err := s.cmd.Wait()
	s.pipesWG.Wait()
	return err
}

// Stop attempts a graceful shutdown (SIGINT to the process group), then
// SIGKILL if the context deadline elapses.
func (s *Subprocess) Stop(ctx context.Context) error {
	if s.cmd.Process == nil {
		return nil
	}
	var stopErr error
	s.stopOnce.Do(func() {
		// SIGINT to the whole process group (the child often spawns
		// helpers — e.g. Next's worker — that we also need to stop).
		_ = syscall.Kill(-s.cmd.Process.Pid, syscall.SIGINT)
		done := make(chan struct{})
		go func() {
			_ = s.cmd.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-ctx.Done():
			_ = syscall.Kill(-s.cmd.Process.Pid, syscall.SIGKILL)
			<-done
			stopErr = errors.New("subprocess killed after graceful shutdown deadline")
		}
		s.pipesWG.Wait()
	})
	return stopErr
}

// startNext launches `node node_modules/next/dist/bin/next <args...>`.
// Using node directly avoids PATH shims and keeps signals routed straight
// at the Node process (Next's binstub is just a node shebang script).
func (tc *Toolchain) startNext(
	workspaceDir string,
	port int,
	env map[string]string,
	args []string,
	out io.Writer,
	outMu *sync.Mutex,
) (*Subprocess, error) {
	// npm workspaces hoist deps to the root node_modules/, not per-package.
	nextBin := filepath.Join(workspaceDir, "node_modules", "next", "dist", "bin", "next")
	if _, err := os.Stat(nextBin); err != nil {
		return nil, fmt.Errorf("next binary not found at %s (did npm install run?): %w", nextBin, err)
	}
	cmd := exec.Command(tc.NodePath, append([]string{nextBin}, args...)...)
	cmd.Dir = filepath.Join(workspaceDir, "frontend")
	cmd.Env = mergeEnv(env)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	sp := &Subprocess{cmd: cmd}
	if err := setupPipes(cmd, sp, "[next]", out, outMu); err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start next: %w", err)
	}
	return sp, nil
}

func runWithPrefix(cmd *exec.Cmd, tag string, out io.Writer, outMu *sync.Mutex) error {
	sp := &Subprocess{cmd: cmd}
	if err := setupPipes(cmd, sp, tag, out, outMu); err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("start %s: %w", cmd.Path, err)
	}
	if err := cmd.Wait(); err != nil {
		sp.pipesWG.Wait()
		return fmt.Errorf("%s: %w", cmd.Path, err)
	}
	sp.pipesWG.Wait()
	return nil
}

func setupPipes(cmd *exec.Cmd, sp *Subprocess, tag string, out io.Writer, outMu *sync.Mutex) error {
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	sp.pipesWG.Add(2)
	go func() {
		defer sp.pipesWG.Done()
		_ = CopyPrefixed(out, stdout, tag, outMu)
	}()
	go func() {
		defer sp.pipesWG.Done()
		_ = CopyPrefixed(out, stderr, tag, outMu)
	}()
	return nil
}

func mergeEnv(extra map[string]string) []string {
	env := append([]string{},
		"NODE_NO_WARNINGS=1",
		"NEXT_TELEMETRY_DISABLED=1",
		"FORCE_COLOR=1",
	)
	env = append(env, os.Environ()...)
	for k, v := range extra {
		env = append(env, k+"="+v)
	}
	return env
}
