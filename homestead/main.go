// Command homestead is the single-binary launcher for a Homestead
// instance. It boots aepbase in-process and spawns the Bun sidecar (plus
// the Vite dev server in --dev), all driven by the user's
// homestead.config.ts.
package main

import (
	"fmt"
	"os"

	"homestead/cli/cmd"
)

func main() {
	if err := cmd.Dispatch(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "homestead:", err)
		os.Exit(1)
	}
}
