package cmd

import (
	"flag"
	"fmt"
	"path/filepath"

	"homestead/cli/internal/project"
)

func runInit(args []string) error {
	fs := flag.NewFlagSet("init", flag.ContinueOnError)
	if err := fs.Parse(args); err != nil {
		return err
	}
	rest := fs.Args()
	dir := "."
	if len(rest) > 0 {
		dir = rest[0]
	}

	abs, err := filepath.Abs(dir)
	if err != nil {
		return err
	}
	if err := project.Scaffold(project.ScaffoldOptions{Dir: dir}); err != nil {
		return err
	}

	fmt.Printf("scaffolded Homestead project at %s\n\n", abs)
	fmt.Println("Next steps:")
	fmt.Printf("  cd %s\n", abs)
	fmt.Println("  homestead start --dev")
	fmt.Println()
	fmt.Println("Edit homestead.config.ts to pick which modules ship.")
	fmt.Println("Drop custom modules under modules/ and import them from the config.")
	return nil
}
