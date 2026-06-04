package main

import (
	"strings"
	"testing"
)

func TestBuildProvidersDisabledWhenEmpty(t *testing.T) {
	got, err := buildProviders(oauthConfig{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil providers, got %v", got)
	}
}

func TestBuildProvidersComposesRedirectURL(t *testing.T) {
	cfg := oauthConfig{
		RedirectBaseURL: "http://localhost:3000/api/aep/", // trailing slash trimmed
		SuccessRedirect: "http://localhost:3000/auth/callback",
		Providers: []oauthProviderConfig{{
			Name:              "google",
			DisplayName:       "Google",
			ClientID:          "cid",
			ClientSecret:      "secret",
			Scopes:            []string{"openid", "email"},
			AuthURL:           "https://accounts.google.com/o/oauth2/v2/auth",
			TokenURL:          "https://oauth2.googleapis.com/token",
			UserInfoURL:       "https://openidconnect.googleapis.com/v1/userinfo",
			AllowRegistration: true,
		}},
	}
	got, err := buildProviders(cfg)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 {
		t.Fatalf("expected 1 provider, got %d", len(got))
	}
	p := got[0]
	if want := "http://localhost:3000/api/aep/oauth/google/callback"; p.RedirectURL != want {
		t.Errorf("RedirectURL = %q, want %q", p.RedirectURL, want)
	}
	if p.SuccessRedirectURL != cfg.SuccessRedirect {
		t.Errorf("SuccessRedirectURL = %q, want %q", p.SuccessRedirectURL, cfg.SuccessRedirect)
	}
	if p.ClientSecret != "secret" || !p.AllowRegistration {
		t.Errorf("provider fields not mapped: %+v", p)
	}
}

func TestBuildProvidersRequiresRedirectAndSuccess(t *testing.T) {
	base := oauthConfig{
		Providers: []oauthProviderConfig{{Name: "google"}},
	}
	if _, err := buildProviders(base); err == nil || !strings.Contains(err.Error(), "redirectBaseUrl") {
		t.Errorf("expected redirectBaseUrl error, got %v", err)
	}

	withBase := base
	withBase.RedirectBaseURL = "http://x/api/aep"
	if _, err := buildProviders(withBase); err == nil || !strings.Contains(err.Error(), "successRedirect") {
		t.Errorf("expected successRedirect error, got %v", err)
	}
}

func TestBuildProvidersRequiresName(t *testing.T) {
	cfg := oauthConfig{
		RedirectBaseURL: "http://x/api/aep",
		SuccessRedirect: "http://x/cb",
		Providers:       []oauthProviderConfig{{ClientID: "cid"}},
	}
	if _, err := buildProviders(cfg); err == nil || !strings.Contains(err.Error(), "name") {
		t.Errorf("expected missing name error, got %v", err)
	}
}
