package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

// appAccessConfig is the JSON object carried in AEPBASE_APP_ACCESS, which
// the launcher serializes from the TypeScript app registry (see
// packages/homestead-cli/src/app-access.js). It is the static half of the
// access decision: which app owns a gated collection, and each app's
// default visibility. The dynamic half (current flag values, the caller's tags)
// is read live from the database by the middleware.
type appAccessConfig struct {
	// CollectionToApp maps a collection plural (e.g. "gift-cards") to its
	// owning app id (e.g. "gift-cards"). Only gated feature collections are
	// present; core/built-in collections are intentionally absent.
	CollectionToApp map[string]string `json:"collectionToApp"`
	// AppDefaults maps an app id to its default visibility, used when no
	// flag value is stored yet ("superusers"/"all"/"none"/"tagged").
	AppDefaults map[string]string `json:"appDefaults"`
}

// appAccessFromEnv reads AEPBASE_APP_ACCESS and returns the parsed config.
// Returns nil when the var is unset/empty/null — app enforcement is then off
// (e.g. standalone aepbase via run.sh), matching pre-enforcement behavior.
func appAccessFromEnv() (*appAccessConfig, error) {
	raw := strings.TrimSpace(os.Getenv("AEPBASE_APP_ACCESS"))
	if raw == "" || raw == "null" {
		return nil, nil
	}
	var cfg appAccessConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, fmt.Errorf("parsing AEPBASE_APP_ACCESS: %w", err)
	}
	if cfg.CollectionToApp == nil {
		cfg.CollectionToApp = map[string]string{}
	}
	if cfg.AppDefaults == nil {
		cfg.AppDefaults = map[string]string{}
	}
	return &cfg, nil
}
