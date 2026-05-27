package cmd

import (
	"context"
	"flag"
	"fmt"

	"homestead/cli/internal/project"
	"homestead/cli/internal/supervisor"
)

func runStart(args []string) error {
	fs := flag.NewFlagSet("start", flag.ContinueOnError)
	dev := fs.Bool("dev", false, "run Next in dev (HMR) mode")
	port := fs.Int("port", 3000, "frontend port")
	aepPort := fs.Int("aepbase-port", 8090, "aepbase port")
	dataDir := fs.String("data-dir", "", "aepbase data dir (default <project>/data)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	if !*dev {
		return fmt.Errorf("only --dev mode is supported in this build; pass --dev")
	}

	p, err := project.Load(".")
	if err != nil {
		return err
	}

	mode := supervisor.Dev
	return supervisor.Run(context.Background(), supervisor.Options{
		Project:      p,
		Mode:         mode,
		FrontendPort: *port,
		AepbasePort:  *aepPort,
		DataDir:      *dataDir,
	})
}
