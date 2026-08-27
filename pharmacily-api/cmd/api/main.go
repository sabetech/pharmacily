package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pharmacily/api/internal/adapter"
	"github.com/pharmacily/api/internal/config"
	"github.com/pharmacily/api/internal/db"
	"github.com/pharmacily/api/internal/handler"
	"github.com/pharmacily/api/internal/worker"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

func main() {
	var configPath string
	flag.StringVar(&configPath, "config", "", "Path to config file")
	flag.Parse()

	// Setup logging
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load config")
	}

	// Set log level
	if cfg.Environment == "development" {
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	} else {
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}

	ctx := context.Background()

	// Initialize database pool
	pool, err := db.NewPool(ctx, &cfg.Database)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create database pool")
	}
	defer pool.Close()

	// Initialize queries
	queries := db.New(pool)

	// Initialize adapter registry
	adapterReg := adapter.NewAdapterRegistry()
	adapterReg.Register("mock", adapter.NewMockAdapter)
	adapterReg.Register("custom", adapter.NewMockAdapter) // Use mock for custom too
	adapterReg.Register("csv", adapter.NewMockAdapter)
	adapterReg.Register("ncpdpp", adapter.NewMockAdapter)
	adapterReg.Register("surescripts", adapter.NewMockAdapter)

	// Initialize HTTP handler
	api := handler.NewAPI(queries, cfg, adapterReg)

	// Initialize sync worker
	syncWorker := worker.NewSyncWorker(queries, cfg, adapterReg)

	// Setup HTTP server
	router := chi.NewRouter()
	router.Mount("/", api.Routes())

	server := &http.Server{
		Addr:         cfg.Server.Host + ":" + strconv.Itoa(cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
		IdleTimeout:  cfg.Server.IdleTimeout,
	}

	// Start worker in background
	if err := syncWorker.Start(ctx); err != nil {
		log.Fatal().Err(err).Msg("Failed to start sync worker")
	}
	defer syncWorker.Stop()

	// Start HTTP server
	go func() {
		log.Info().
			Str("host", cfg.Server.Host).
			Int("port", cfg.Server.Port).
			Msg("Starting HTTP server")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("HTTP server failed")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("Shutting down server...")

	// Graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("Server forced to shutdown")
	}

	log.Info().Msg("Server exited")
}