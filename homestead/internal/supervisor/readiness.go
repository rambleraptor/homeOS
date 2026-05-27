package supervisor

import (
	"context"
	"net"
	"strconv"
	"time"
)

// WaitForPort polls 127.0.0.1:port every interval until it accepts a TCP
// connection or ctx is done. Returns nil on success, ctx.Err() on
// cancellation/timeout.
func WaitForPort(ctx context.Context, port int, interval time.Duration) error {
	addr := "127.0.0.1:" + strconv.Itoa(port)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		conn, err := net.DialTimeout("tcp", addr, 250*time.Millisecond)
		if err == nil {
			_ = conn.Close()
			return nil
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(interval):
		}
	}
}
