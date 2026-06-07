package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// moduleAccessConfig is the JSON object carried in AEPBASE_MODULE_ACCESS, which
// the launcher serializes from the TypeScript module registry (see
// packages/homestead-cli/src/module-access.js). It is the static half of the
// access decision: which module owns a gated collection, and each module's
// default visibility. The dynamic half (current flag values, the caller's tags)
// is read live from the database by the middleware.
type moduleAccessConfig struct {
	// CollectionToModule maps a collection plural (e.g. "gift-cards") to its
	// owning module id (e.g. "gift-cards"). Only gated feature collections are
	// present; core/built-in collections are intentionally absent.
	CollectionToModule map[string]string `json:"collectionToModule"`
	// ModuleDefaults maps a module id to its default visibility, used when no
	// flag value is stored yet ("superusers"/"all"/"none"/"tagged").
	ModuleDefaults map[string]string `json:"moduleDefaults"`
}

// moduleAccessFromEnv reads AEPBASE_MODULE_ACCESS and returns the parsed config.
// Returns nil when the var is unset/empty/null — module enforcement is then off
// (e.g. standalone aepbase via run.sh), matching pre-enforcement behavior.
func moduleAccessFromEnv() (*moduleAccessConfig, error) {
	raw := strings.TrimSpace(os.Getenv("AEPBASE_MODULE_ACCESS"))
	if raw == "" || raw == "null" {
		return nil, nil
	}
	var cfg moduleAccessConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, fmt.Errorf("parsing AEPBASE_MODULE_ACCESS: %w", err)
	}
	if cfg.CollectionToModule == nil {
		cfg.CollectionToModule = map[string]string{}
	}
	if cfg.ModuleDefaults == nil {
		cfg.ModuleDefaults = map[string]string{}
	}
	return &cfg, nil
}
