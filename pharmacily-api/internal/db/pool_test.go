package db

import (
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pharmacily/api/internal/config"
)

// Regression test: passwords with URL metacharacters (#, @, …) must be
// encoded in the DSN. A raw interpolation truncated the URL at '#' and
// pgxpool.ParseConfig failed on Railway, failing every healthcheck.
func TestBuildDSNEncodesCredentials(t *testing.T) {
	cfg := &config.DatabaseConfig{
		Host: "db.example.supabase.co", Port: 5432,
		User: "postgres", Password: "blender3D#vpl$es5!",
		Name: "postgres", MaxConns: 25, MinConns: 5,
		MaxConnLifetime: 30 * time.Minute, MaxConnIdleTime: 5 * time.Minute,
	}
	dsn := buildDSN(cfg)
	if strings.Contains(dsn, "blender3D#") {
		t.Errorf("DSN contains raw '#': %s", dsn)
	}
	if _, err := pgxpool.ParseConfig(dsn); err != nil {
		t.Errorf("ParseConfig(%q) error: %v", dsn, err)
	}
}
