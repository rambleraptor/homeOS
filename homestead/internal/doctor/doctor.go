// Package doctor implements the `homestead doctor` self-check: a snapshot
// of whether `homestead start` will work in the current environment and,
// if not, what specifically is broken.
//
// Checks are intentionally cheap and read-only. We never start aepbase or
// Next here — that's what `homestead start` is for.
package doctor

import (
	"errors"
	"fmt"
	"io/fs"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"

	"homestead/cli/internal/project"
)

// Status is a check's outcome.
type Status int

const (
	OK Status = iota
	Warn
	Fail
)

// Check is one item in a doctor report.
type Check struct {
	Name   string
	Status Status
	Detail string
}

// Options configures a doctor run. Zero values are fine — defaults match
// `homestead start`'s defaults.
type Options struct {
	// ProjectDir is the dir to inspect for a homestead.config.ts. Empty
	// string means "use CWD". A missing project is a Warn, not a Fail.
	ProjectDir string

	// FrontendPort and AepbasePort are the ports to test for availability.
	// Zero values fall back to 3000 / 8090 (the same defaults `start`
	// uses).
	FrontendPort int
	AepbasePort  int

	// CustomDataDir, if set, overrides the inferred data dir (which is
	// <ProjectDir>/data otherwise).
	CustomDataDir string
}

// Run executes every check and returns the report. The slice ordering
// is stable, mirroring how a human would scan top-to-bottom: platform,
// toolchain, ports, project, data.
func Run(opts Options) []Check {
	if opts.FrontendPort == 0 {
		opts.FrontendPort = 3000
	}
	if opts.AepbasePort == 0 {
		opts.AepbasePort = 8090
	}

	var out []Check
	out = append(out, checkPlatform())
	out = append(out, checkNode())
	out = append(out, checkNpm())
	out = append(out, checkPort("frontend port", opts.FrontendPort))
	out = append(out, checkPort("aepbase port", opts.AepbasePort))

	proj, projCheck := loadProjectCheck(opts.ProjectDir)
	out = append(out, projCheck)

	out = append(out, checkModules(proj))
	out = append(out, checkDataDir(proj, opts.CustomDataDir))
	out = append(out, checkCache(proj))
	return out
}

// HasFailures reports whether any check is Fail. Caller decides what to
// do with Warn.
func HasFailures(checks []Check) bool {
	for _, c := range checks {
		if c.Status == Fail {
			return true
		}
	}
	return false
}

// checkPlatform flags Windows because the launcher hasn't been validated
// there yet. macOS + Linux are OK.
func checkPlatform() Check {
	plat := runtime.GOOS + "/" + runtime.GOARCH
	switch runtime.GOOS {
	case "darwin", "linux":
		return Check{"platform", OK, plat}
	case "windows":
		return Check{"platform", Warn, plat + " — Windows isn't validated yet; macOS + Linux are supported"}
	default:
		return Check{"platform", Warn, plat + " — unknown OS; macOS + Linux are supported"}
	}
}

var nodeVersionRE = regexp.MustCompile(`v(\d+)\.`)

const minNodeMajor = 20

func checkNode() Check {
	path, err := exec.LookPath("node")
	if err != nil {
		return Check{"node", Fail, "not found on PATH — install Node " + strconv.Itoa(minNodeMajor) + "+ from https://nodejs.org"}
	}
	out, err := exec.Command(path, "--version").Output()
	if err != nil {
		return Check{"node", Fail, "found at " + path + " but `node --version` failed: " + err.Error()}
	}
	m := nodeVersionRE.FindStringSubmatch(strings.TrimSpace(string(out)))
	if m == nil {
		return Check{"node", Warn, "could not parse `node --version` output: " + strings.TrimSpace(string(out))}
	}
	major, _ := strconv.Atoi(m[1])
	if major < minNodeMajor {
		return Check{"node", Fail, fmt.Sprintf("found %s (need %d+)", strings.TrimSpace(string(out)), minNodeMajor)}
	}
	return Check{"node", OK, fmt.Sprintf("%s at %s", strings.TrimSpace(string(out)), path)}
}

func checkNpm() Check {
	path, err := exec.LookPath("npm")
	if err != nil {
		return Check{"npm", Fail, "not found on PATH — comes bundled with Node " + strconv.Itoa(minNodeMajor) + "+"}
	}
	out, err := exec.Command(path, "--version").Output()
	if err != nil {
		return Check{"npm", Warn, "found at " + path + " but `npm --version` failed: " + err.Error()}
	}
	return Check{"npm", OK, fmt.Sprintf("v%s at %s", strings.TrimSpace(string(out)), path)}
}

// checkPort warns (not fails) if the port is busy. The launcher might
// still work if the user passes a different port via --port.
func checkPort(label string, port int) Check {
	name := fmt.Sprintf("%s (:%d)", label, port)
	ln, err := net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
	if err != nil {
		return Check{name, Warn, "in use — pass --port or --aepbase-port to override (" + err.Error() + ")"}
	}
	_ = ln.Close()
	return Check{name, OK, "available"}
}

func loadProjectCheck(dir string) (*project.Project, Check) {
	if dir == "" {
		dir = "."
	}
	p, err := project.Load(dir)
	if err != nil {
		abs, _ := filepath.Abs(dir)
		return nil, Check{"project", Warn, "no homestead.config.ts at " + abs + " — run `homestead init` to scaffold one"}
	}
	return p, Check{"project", OK, p.Root}
}

func checkModules(p *project.Project) Check {
	if p == nil || p.ModulesDir == "" {
		return Check{"custom modules", OK, "none (modules/ dir not present)"}
	}
	var tsFiles []string
	err := filepath.WalkDir(p.ModulesDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && strings.HasSuffix(path, ".ts") {
			rel, _ := filepath.Rel(p.ModulesDir, path)
			tsFiles = append(tsFiles, rel)
		}
		return nil
	})
	if err != nil {
		return Check{"custom modules", Warn, "could not scan " + p.ModulesDir + ": " + err.Error()}
	}
	if len(tsFiles) == 0 {
		return Check{"custom modules", OK, "modules/ dir is present but empty"}
	}
	return Check{"custom modules", OK, fmt.Sprintf("%d file(s): %s", len(tsFiles), strings.Join(tsFiles, ", "))}
}

func checkDataDir(p *project.Project, override string) Check {
	dir := override
	if dir == "" && p != nil {
		dir = p.DataDir
	}
	if dir == "" {
		return Check{"data dir", OK, "(will be created on first start under <project>/data)"}
	}
	info, err := os.Stat(dir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Check{"data dir", OK, dir + " (will be created on first start)"}
		}
		return Check{"data dir", Warn, "stat " + dir + ": " + err.Error()}
	}
	if !info.IsDir() {
		return Check{"data dir", Fail, dir + " exists but isn't a directory"}
	}
	creds := filepath.Join(dir, "credentials.json")
	if _, err := os.Stat(creds); err == nil {
		return Check{"data dir", OK, dir + " (credentials.json present)"}
	}
	return Check{"data dir", OK, dir + " (no credentials.json yet — first start will generate)"}
}

func checkCache(_ *project.Project) Check {
	root, err := project.CacheRoot()
	if err != nil {
		return Check{"build cache", Warn, "could not resolve cache root: " + err.Error()}
	}
	entries, err := os.ReadDir(root)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return Check{"build cache", OK, root + " (none yet — first start will populate)"}
		}
		return Check{"build cache", Warn, "read " + root + ": " + err.Error()}
	}
	var dirs int
	var size int64
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dirs++
		size += dirSize(filepath.Join(root, e.Name()))
	}
	return Check{"build cache", OK, fmt.Sprintf("%s (%d workspace(s), %s)", root, dirs, humanBytes(size))}
}

func dirSize(root string) int64 {
	var total int64
	_ = filepath.WalkDir(root, func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // best-effort
		}
		if d.IsDir() {
			return nil
		}
		info, err := d.Info()
		if err == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}

func humanBytes(n int64) string {
	const unit = 1024
	if n < unit {
		return fmt.Sprintf("%dB", n)
	}
	div, exp := int64(unit), 0
	for n2 := n / unit; n2 >= unit; n2 /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%cB", float64(n)/float64(div), "KMGT"[exp])
}
