package cmd

import (
	"context"
	"flag"

	"homestead/cli/internal/project"
	"homestead/cli/internal/supervisor"
)

func runStart(args []string) error {
	fs := flag.NewFlagSet("start", flag.ContinueOnError)
	dev := fs.Bool("dev", false, "serve the SPA via Vite (HMR) instead of the embedded build")
	port := fs.Int("port", 3000, "user-facing port")
	aepPort := fs.Int("aepbase-port", 8090, "aepbase port (loopback)")
	sidecarPort := fs.Int("sidecar-port", 4000, "sidecar port (loopback)")
	vitePort := fs.Int("vite-port", 5173, "Vite dev server port (--dev only)")
	dataDir := fs.String("data-dir", "", "aepbase data dir (default <project>/data)")
	if err := fs.Parse(args); err != nil {
		return err
	}

	p, err := project.Load(".")
	if err != nil {
		return err
	}

	mode := supervisor.Prod
	if *dev {
		mode = supervisor.Dev
	}
	return supervisor.Run(context.Background(), supervisor.Options{
		Project:      p,
		Mode:         mode,
		FrontendPort: *port,
		AepbasePort:  *aepPort,
		SidecarPort:  *sidecarPort,
		VitePort:     *vitePort,
		DataDir:      *dataDir,
	})
}
