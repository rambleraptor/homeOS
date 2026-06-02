package aepbaserun

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/rambleraptor/aepbase/pkg/oauth"
)

// envProvider is the JSON shape of one entry in OAUTH_PROVIDERS. The
// authorize/token/userinfo endpoints are explicit (aepbase does no OIDC
// discovery). For Google use:
//
//	auth_url:     https://accounts.google.com/o/oauth2/v2/auth
//	token_url:    https://oauth2.googleapis.com/token
//	userinfo_url: https://openidconnect.googleapis.com/v1/userinfo
type envProvider struct {
	Name              string   `json:"name"`
	DisplayName       string   `json:"display_name"`
	ClientID          string   `json:"client_id"`
	ClientSecret      string   `json:"client_secret"`
	Scopes            []string `json:"scopes"`
	AuthURL           string   `json:"auth_url"`
	TokenURL          string   `json:"token_url"`
	UserInfoURL       string   `json:"userinfo_url"`
	AllowRegistration bool     `json:"allow_registration"`
}

// oauthProvidersFromEnv builds aepbase OAuth providers from environment
// variables, returning nil when OAUTH_PROVIDERS is unset (OAuth disabled).
// Recognized variables:
//
//	OAUTH_PROVIDERS         JSON array of {name, display_name, client_id,
//	                        client_secret, scopes, auth_url, token_url,
//	                        userinfo_url, allow_registration?}.
//	OAUTH_REDIRECT_BASE_URL externally-reachable base mapping to the aepbase
//	                        root, e.g. "http://localhost:3000/api/aep". Each
//	                        provider's RedirectURL is
//	                        {base}/oauth/{name}/callback.
//	OAUTH_SUCCESS_REDIRECT  SPA URL the callback returns to with the minted
//	                        token in the fragment, e.g.
//	                        "http://localhost:3000/auth/callback".
//
// Login is existing-users-only unless a provider sets allow_registration.
func oauthProvidersFromEnv() ([]oauth.Provider, error) {
	raw := os.Getenv("OAUTH_PROVIDERS")
	if raw == "" {
		return nil, nil
	}
	var entries []envProvider
	if err := json.Unmarshal([]byte(raw), &entries); err != nil {
		return nil, fmt.Errorf("parsing OAUTH_PROVIDERS: %w", err)
	}
	if len(entries) == 0 {
		return nil, nil
	}

	redirectBase := os.Getenv("OAUTH_REDIRECT_BASE_URL")
	if redirectBase == "" {
		return nil, fmt.Errorf("OAUTH_REDIRECT_BASE_URL is required when OAUTH_PROVIDERS is set")
	}
	success := os.Getenv("OAUTH_SUCCESS_REDIRECT")
	if success == "" {
		return nil, fmt.Errorf("OAUTH_SUCCESS_REDIRECT is required when OAUTH_PROVIDERS is set")
	}
	redirectBase = strings.TrimRight(redirectBase, "/")

	providers := make([]oauth.Provider, 0, len(entries))
	for _, e := range entries {
		if e.Name == "" {
			return nil, fmt.Errorf("oauth provider missing name")
		}
		providers = append(providers, oauth.Provider{
			Name:               e.Name,
			DisplayName:        e.DisplayName,
			ClientID:           e.ClientID,
			ClientSecret:       e.ClientSecret,
			Scopes:             e.Scopes,
			AuthURL:            e.AuthURL,
			TokenURL:           e.TokenURL,
			UserInfoURL:        e.UserInfoURL,
			RedirectURL:        redirectBase + "/oauth/" + e.Name + "/callback",
			SuccessRedirectURL: success,
			AllowRegistration:  e.AllowRegistration,
		})
	}
	return providers, nil
}
