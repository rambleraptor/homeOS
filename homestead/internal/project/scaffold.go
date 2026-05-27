package project

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// ScaffoldOptions controls what `homestead init` writes into a project dir.
type ScaffoldOptions struct {
	// Dir is the directory to scaffold into. It must either not exist or
	// be empty — we never clobber existing files.
	Dir string

	// Force lets the scaffolder write into a non-empty dir, skipping files
	// that already exist. Future use; not exposed on the CLI yet.
	Force bool
}

// Scaffold writes a starter Homestead project: homestead.config.ts plus a
// modules/ directory. Deliberately minimal — no package.json, no
// node_modules. The launcher does all the heavy lifting at `homestead
// start` time, so the user's project dir stays clean. Editor type
// support is a follow-up (the workspace inside the cache has it).
func Scaffold(opts ScaffoldOptions) error {
	dir, err := filepath.Abs(opts.Dir)
	if err != nil {
		return fmt.Errorf("resolve %q: %w", opts.Dir, err)
	}

	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("mkdir %s: %w", dir, err)
	}

	if !opts.Force {
		entries, err := os.ReadDir(dir)
		if err != nil {
			return fmt.Errorf("read %s: %w", dir, err)
		}
		for _, e := range entries {
			if e.Name() == "." || e.Name() == ".." {
				continue
			}
			return fmt.Errorf("%s is not empty — pick a fresh directory", dir)
		}
	}

	files := []struct {
		path    string
		body    string
		dirMode os.FileMode
	}{
		{filepath.Join(dir, "homestead.config.ts"), scaffoldConfigTS, 0o755},
		{filepath.Join(dir, "modules", "README.md"), scaffoldModulesReadme, 0o755},
		{filepath.Join(dir, ".gitignore"), scaffoldGitignore, 0o755},
	}
	for _, f := range files {
		if err := os.MkdirAll(filepath.Dir(f.path), f.dirMode); err != nil {
			return fmt.Errorf("mkdir %s: %w", filepath.Dir(f.path), err)
		}
		if opts.Force {
			if _, err := os.Stat(f.path); err == nil {
				continue
			} else if !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("stat %s: %w", f.path, err)
			}
		}
		if err := os.WriteFile(f.path, []byte(f.body), 0o644); err != nil {
			return fmt.Errorf("write %s: %w", f.path, err)
		}
	}
	return nil
}

const scaffoldConfigTS = `/**
 * Homestead instance configuration.
 *
 * This is the ONE file you edit to choose what your homestead serves.
 * Comment out a module to remove it; import a new one to add it.
 *
 * To add a custom module, drop a .ts file under ./modules/ exporting a
 * HomeModule, then add the import + array entry below.
 */

import {
  dashboardModule,
  giftCardsModule,
  groceriesModule,
  recipesModule,
  todosModule,
} from '@rambleraptor/homestead-modules';
import type { HomesteadConfig } from '@rambleraptor/homestead-core/modules/config';

const config: HomesteadConfig = {
  modules: [
    dashboardModule,
    todosModule,
    giftCardsModule,
    groceriesModule,
    recipesModule,
  ],
};

export default config;
`

const scaffoldModulesReadme = `# Custom Modules

Drop .ts files in this directory and import them from
` + "`../homestead.config.ts`" + ` to add custom features to your Homestead
instance.

Example module:

` + "```ts" + `
// modules/hello.ts
import type { HomeModule } from '@rambleraptor/homestead-core/modules/types';
import { Home } from 'lucide-react';

export const helloModule: HomeModule = {
  id: 'hello',
  name: 'Hello',
  description: 'A custom module',
  icon: Home,
  basePath: '/hello',
  routes: [
    {
      path: '',
      index: true,
      component: () => <div>Hello, Homestead!</div>,
    },
  ],
  showInNav: true,
  navOrder: 100,
  enabled: true,
};
` + "```" + `

Then in ` + "`../homestead.config.ts`" + `:

` + "```ts" + `
import { helloModule } from './modules/hello';

const config: HomesteadConfig = {
  modules: [
    // ...existing modules,
    helloModule,
  ],
};
` + "```" + `

The launcher copies the contents of this directory into the build
workspace each time you run ` + "`homestead start`" + `, so HMR picks up
edits automatically in dev mode.
`

const scaffoldGitignore = `# Local aepbase data (sqlite db + uploaded files + superuser credentials)
data/

# Anything the launcher might cache inside the project (currently none)
.homestead/
`
