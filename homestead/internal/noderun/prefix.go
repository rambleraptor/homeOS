package noderun

import (
	"bufio"
	"io"
	"sync"
)

// PrefixPipe wraps a writer so each line written to it is prefixed with
// `tag` before being forwarded to dst. Designed to be plugged into
// exec.Cmd.Stdout / Stderr to multiplex multiple subprocesses' logs into
// one stream without interleaving mid-line.
type PrefixPipe struct {
	tag string
	dst io.Writer
	mu  sync.Mutex
}

// CopyPrefixed reads lines from src and writes them to dst with each
// line prefixed by `tag + " "`. Blocks until src returns EOF or error.
// Returns the first non-EOF error encountered.
func CopyPrefixed(dst io.Writer, src io.Reader, tag string, mu *sync.Mutex) error {
	scanner := bufio.NewScanner(src)
	// Default Scanner buffer caps at 64KB; long Next.js compile lines can
	// exceed that. Give it room.
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
