package config

import (
	"testing"
)

// Regression test: PHARMACILY_* env vars must override file/default config.
// A prior koanf env-provider callback returned keys unchanged, so nested
// keys never mapped and env was silently ignored (Railway containers ran
// with localhost defaults and failed healthchecks).
func TestLoadEnvOverlay(t *testing.T) {
	t.Setenv("PHARMACILY_ENVIRONMENT", "staging")
	t.Setenv("PHARMACILY_SERVER_HOST", "0.0.0.0")
	t.Setenv("PHARMACILY_SERVER_PORT", "8081")
	t.Setenv("PHARMACILY_DATABASE_HOST", "db.example.supabase.co")
	t.Setenv("PHARMACILY_DATABASE_PORT", "5432")
	t.Setenv("PHARMACILY_DATABASE_USER", "postgres")
	t.Setenv("PHARMACILY_DATABASE_PASSWORD", "secret")
	t.Setenv("PHARMACILY_DATABASE_NAME", "postgres")
	t.Setenv("PHARMACILY_SUPABASE_URL", "https://example.supabase.co")
	t.Setenv("PHARMACILY_SUPABASE_ANON_KEY", "anon-key")
	t.Setenv("PHARMACILY_SUPABASE_SERVICE_ROLE_KEY", "service-key")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.Environment != "staging" {
		t.Errorf("Environment = %q, want staging", cfg.Environment)
	}
	if cfg.Server.Host != "0.0.0.0" || cfg.Server.Port != 8081 {
		t.Errorf("Server = %s:%d, want 0.0.0.0:8081", cfg.Server.Host, cfg.Server.Port)
	}
	if cfg.Database.Host != "db.example.supabase.co" || cfg.Database.Port != 5432 {
		t.Errorf("Database = %s:%d, want db.example.supabase.co:5432", cfg.Database.Host, cfg.Database.Port)
	}
	if cfg.Supabase.URL != "https://example.supabase.co" || cfg.Supabase.AnonKey != "anon-key" {
		t.Errorf("Supabase URL/anon not applied: %+v", cfg.Supabase)
	}
	if got := cfg.DatabaseURL(); got != "postgres://postgres:secret@db.example.supabase.co:5432/postgres" {
		t.Errorf("DatabaseURL() = %q", got)
	}
}

// Bare PORT (Railway, PaaS) must win over PHARMACILY_SERVER_PORT.
func TestLoadBarePortWins(t *testing.T) {
	t.Setenv("PHARMACILY_SERVER_PORT", "8080")
	t.Setenv("PORT", "9000")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.Server.Port != 9000 {
		t.Errorf("Server.Port = %d, want 9000 (bare PORT wins)", cfg.Server.Port)
	}
}

// Unparsable values must not clobber file/default config.
func TestLoadBadEnvIgnored(t *testing.T) {
	t.Setenv("PHARMACILY_SERVER_PORT", "not-a-port")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error: %v", err)
	}
	if cfg.Server.Port != 8080 {
		t.Errorf("Server.Port = %d, want default 8080", cfg.Server.Port)
	}
}
