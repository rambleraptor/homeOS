package aepbaserun

import (
	"context"
	"io"
	"net"
	"net/http"
	"testing"
	"time"
)

// End-to-end smoke: Start binds a port, the server accepts requests,
// and Shutdown returns cleanly.
func TestStart_ServesAndShuts(t *testing.T) {
	port := freePort(t)
	srv, creds, err := Start(Options{
		Port:    port,
		DataDir: t.TempDir(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if creds.Email == "" || creds.Password == "" {
		t.Errorf("missing creds: %+v", creds)
	}

	resp, err := http.Get("http://127.0.0.1:" + itoa(port) + "/openapi.json")
	if err != nil {
		t.Fatalf("GET /openapi.json: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("status = %d", resp.StatusCode)
	}
	_, _ = io.Copy(io.Discard, resp.Body)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		t.Fatalf("shutdown: %v", err)
	}
	if err := srv.Wait(); err != nil {
		t.Errorf("serve err: %v", err)
	}
}

func freePort(t *testing.T) int {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	p := l.Addr().(*net.TCPAddr).Port
	l.Close()
	return p
}

func itoa(n int) string {
	// Avoid pulling in strconv just for tests.
	if n == 0 {
		return "0"
	}
	var buf [10]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
