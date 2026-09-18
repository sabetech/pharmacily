package db

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pharmacily/api/internal/config"
	"github.com/rs/zerolog/log"
)

// buildDSN renders the pgxpool connection string. Credentials are
// URL-encoded: a raw password containing URL metacharacters (#, @, /, ?…)
// would otherwise truncate or corrupt the DSN and fail ParseConfig.
func buildDSN(cfg *config.DatabaseConfig) string {
	credentials := url.UserPassword(cfg.User, cfg.Password).String()
	return fmt.Sprintf(
		"postgres://%s@%s:%d/%s?pool_max_conns=%d&pool_min_conns=%d&pool_max_conn_lifetime=%s&pool_max_conn_idle_time=%s",
		credentials, cfg.Host, cfg.Port, cfg.Name,
		cfg.MaxConns, cfg.MinConns,
		cfg.MaxConnLifetime.String(),
		cfg.MaxConnIdleTime.String(),
	)
}

func NewPool(ctx context.Context, cfg *config.DatabaseConfig) (*pgxpool.Pool, error) {
	dsn := buildDSN(cfg)

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	poolConfig.AfterConnect = func(ctx context.Context, conn *pgx.Conn) error {
		// Set search path
		_, err := conn.Exec(ctx, "SET search_path TO public")
		return err
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	// Verify connection
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}

	log.Info().
		Str("host", cfg.Host).
		Int("port", cfg.Port).
		Str("database", cfg.Name).
		Msg("Database connection pool created")

	return pool, nil
}