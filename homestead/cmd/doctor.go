package cmd

import (
	"flag"
	"fmt"
	"os"

	"homestead/cli/internal/doctor"
)

func runDoctor(args []string) error {
	fs := flag.NewFlagSet("doctor", flag.ContinueOnError)
	port := fs.Int("port", 3000, "frontend port to test")
	aepPort := fs.Int("aepbase-port", 8090, "aepbase port to test")
	dataDir := fs.String("data-dir", "", "data dir to inspect (default <project>/data)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	checks := doctor.Run(doctor.Options{
		FrontendPort:  *port,
		AepbasePort:   *aepPort,
		CustomDataDir: *dataDir,
	})

	w := os.Stdout
	for _, c := range checks {
		fmt.Fprintln(w, formatCheck(c))
	}
	fmt.Fprintln(w)
	if doctor.HasFailures(checks) {
		fmt.Fprintln(w, "✗ doctor found one or more failures — fix the items above before `homestead start`")
		os.Exit(1)
	}
	fmt.Fprintln(w, "✓ ready for `homestead start`")
	return nil
}

func formatCheck(c doctor.Check) string {
	mark := "✓"
	switch c.Status {
	case doctor.Warn:
		mark = "⚠"
	case doctor.Fail:
		mark = "✗"
	}
	return fmt.Sprintf("  %s  %-22s  %s", mark, c.Name, c.Detail)
}
