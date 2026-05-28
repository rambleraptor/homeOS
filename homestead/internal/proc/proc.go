// Package proc spawns and supervises child processes (the Bun sidecar and,
// in dev, the Vite dev server), multiplexing their stdout/stderr into a
// single line-prefixed stream.
package proc

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"syscall"
)

// Options configures a spawned process.
type Options struct {
	// Name is the executable path (absolute or resolved on PATH).
	Name string
	// Args are the command arguments.
	Args []string
	// Dir is the working directory.
	Dir string
	// Env holds extra environment vars merged over os.Environ().
	Env map[string]string
	// Tag prefixes each log line (e.g. "[sidecar]").
	Tag string
	// Out is where multiplexed logs go.
	Out io.Writer
	// OutMu serializes writes to Out across processes.
	OutMu *sync.Mutex
}

// Process wraps an exec.Cmd with graceful-shutdown + log-pump lifecycle.
type Process struct {
	cmd      *exec.Cmd
	stopOnce sync.Once
	pipesWG  sync.WaitGroup
}

// Spawn starts the process and returns once it's launched. The caller owns
// Wait/Stop. The child runs in its own process group so Stop can signal the
// whole group (Bun/Vite spawn helper processes).
func Spawn(opts Options) (*Process, error) {
	cmd := exec.Command(opts.Name, opts.Args...)
	cmd.Dir = opts.Dir
	cmd.Env = mergeEnv(opts.Env)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	p := &Process{cmd: cmd}
	if err := p.setupPipes(opts.Tag, opts.Out, opts.OutMu); err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("start %s: %w", opts.Name, err)
	}
	return p, nil
}

// Wait blocks until the process and its log pumps have exited.
func (p *Process) Wait() error {
	err := p.cmd.Wait()
	p.pipesWG.Wait()
	return err
}

// Stop sends SIGTERM to the process group, escalating to SIGKILL if ctx
// elapses first. Idempotent.
func (p *Process) Stop(ctx context.Context) error {
	if p.cmd.Process == nil {
		return nil
	}
	var stopErr error
	p.stopOnce.Do(func() {
		_ = syscall.Kill(-p.cmd.Process.Pid, syscall.SIGTERM)
		done := make(chan struct{})
		go func() {
			_ = p.cmd.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-ctx.Done():
			_ = syscall.Kill(-p.cmd.Process.Pid, syscall.SIGKILL)
			<-done
			stopErr = errors.New("process killed after graceful shutdown deadline")
		}
		p.pipesWG.Wait()
	})
	return stopErr
}

func (p *Process) setupPipes(tag string, out io.Writer, mu *sync.Mutex) error {
	stdout, err := p.cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := p.cmd.StderrPipe()
	if err != nil {
		return err
	}
	p.pipesWG.Add(2)
	go func() { defer p.pipesWG.Done(); _ = copyPrefixed(out, stdout, tag, mu) }()
	go func() { defer p.pipesWG.Done(); _ = copyPrefixed(out, stderr, tag, mu) }()
	return nil
}

func mergeEnv(extra map[string]string) []string {
	env := append([]string{}, os.Environ()...)
	for k, v := range extra {
		env = append(env, k+"="+v)
	}
	return env
}

// copyPrefixed reads lines from src and writes them to dst prefixed by
// `tag + " "`, holding mu around each line so concurrent producers don't
// interleave mid-line.
func copyPrefixed(dst io.Writer, src io.Reader, tag string, mu *sync.Mutex) error {
	scanner := bufio.NewScanner(src)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	prefix := []byte(tag + " ")
	for scanner.Scan() {
		line := scanner.Bytes()
		mu.Lock()
		_, _ = dst.Write(prefix)
		_, _ = dst.Write(line)
		_, _ = dst.Write([]byte{'\n'})
		mu.Unlock()
	}
	if err := scanner.Err(); err != nil && err != io.EOF {
		return err
	}
	return nil
}
