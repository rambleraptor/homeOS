// Package cmd holds the subcommand dispatch for the homestead binary.
package cmd

import (
	"fmt"
	"strings"
)

// Dispatch routes the user's argv to the right subcommand.
func Dispatch(args []string) error {
	if len(args) == 0 || args[0] == "help" || args[0] == "-h" || args[0] == "--help" {
		printUsage()
		return nil
	}
	sub, rest := args[0], args[1:]
	switch sub {
	case "start":
		return runStart(rest)
	case "init":
		return runInit(rest)
	case "doctor":
		return runDoctor(rest)
	default:
		printUsage()
		return fmt.Errorf("unknown subcommand %q", sub)
	}
}

func printUsage() {
	lines := []string{
		"homestead — run a Homestead instance from a single binary.",
		"",
		"Usage:",
		"  homestead init [<dir>]        Scaffold a new project (homestead.config.ts + modules/).",
		"  homestead start [--dev]       Boot aepbase + sidecar + SPA using the homestead.config.ts in CWD.",
		"  homestead doctor              Check whether the host can run `homestead start`.",
		"",
		"Flags for `start`:",
		"  --dev                          Serve the SPA via Vite (HMR) instead of the embedded build.",
		"  --port=N                       User-facing port (default 3000).",
		"  --aepbase-port=N               aepbase port, loopback (default 8090).",
		"  --sidecar-port=N               sidecar port, loopback (default 4000).",
		"  --vite-port=N                  Vite dev server port, --dev only (default 5173).",
		"  --data-dir=PATH                Where aepbase keeps its sqlite db + files",
		"                                 (default <project>/data).",
	}
	fmt.Println(strings.Join(lines, "\n"))
}
