package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/rambleraptor/aepbase/pkg/oauth"
)

// oauthProviderConfig is one entry in AEPBASE_OAUTH.providers. Field names are
// camelCase to match the TypeScript `auth.oauth` shape in homestead.config.ts
// that the launcher serializes verbatim.
type oauthProviderConfig struct {
	Name              string   `json:"name"`
	DisplayName       string   `json:"displayName"`
	ClientID          string   `json:"clientId"`
	ClientSecret      string   `json:"clientSecret"`
	Scopes            []string `json:"scopes"`
	AuthURL           string   `json:"authUrl"`
	TokenURL          string   `json:"tokenUrl"`
	UserInfoURL       string   `json:"userInfoUrl"`
	AllowRegistration bool     `json:"allowRegistration"`
}

// oauthConfig is the JSON object carried in AEPBASE_OAUTH.
type oauthConfig struct {
	RedirectBaseURL string                `json:"redirectBaseUrl"`
	SuccessRedirect string                `json:"successRedirect"`
	Providers       []oauthProviderConfig `json:"providers"`
}

// oauthProvidersFromEnv reads AEPBASE_OAUTH — a JSON object the launcher
// serializes from homestead.config.ts `auth.oauth` — and returns aepbase OAuth
// providers. Returns nil when AEPBASE_OAUTH is unset/empty/null (OAuth off).
//
// This env var is the only coupling point between the launcher and aepbase's
// OAuth config; it's intentionally the single place to swap to another
// transport (e.g. the child's stdin) later.
func oauthProvidersFromEnv() ([]oauth.Provider, error) {
	raw := strings.TrimSpace(os.Getenv("AEPBASE_OAUTH"))
	if raw == "" || raw == "null" {
		return nil, nil
	}
	var cfg oauthConfig
	if err := json.Unmarshal([]byte(raw), &cfg); err != nil {
		return nil, fmt.Errorf("parsing AEPBASE_OAUTH: %w", err)
	}
	return buildProviders(cfg)
}

// buildProviders maps the parsed config to aepbase providers, composing each
// provider's RedirectURL from the shared redirect base. Pure (no env / I/O) so
// it can be unit-tested without spawning the process.
func buildProviders(cfg oauthConfig) ([]oauth.Provider, error) {
	if len(cfg.Providers) == 0 {
		return nil, nil
	}
	if cfg.RedirectBaseURL == "" {
		return nil, fmt.Errorf("redirectBaseUrl is required when providers are set")
	}
	if cfg.SuccessRedirect == "" {
		return nil, fmt.Errorf("successRedirect is required when providers are set")
	}
	base := strings.TrimRight(cfg.RedirectBaseURL, "/")

	providers := make([]oauth.Provider, 0, len(cfg.Providers))
	for _, p := range cfg.Providers {
		if p.Name == "" {
			return nil, fmt.Errorf("oauth provider missing name")
		}
		providers = append(providers, oauth.Provider{
			Name:               p.Name,
			DisplayName:        p.DisplayName,
			ClientID:           p.ClientID,
			ClientSecret:       p.ClientSecret,
			Scopes:             p.Scopes,
			AuthURL:            p.AuthURL,
			TokenURL:           p.TokenURL,
			UserInfoURL:        p.UserInfoURL,
			RedirectURL:        base + "/oauth/" + p.Name + "/callback",
			SuccessRedirectURL: cfg.SuccessRedirect,
			AllowRegistration:  p.AllowRegistration,
		})
	}
	return providers, nil
}
