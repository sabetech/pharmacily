package config

import (
	"os"
	"time"

	"github.com/knadh/koanf/providers/env"
	"github.com/knadh/koanf/providers/structs"
	"github.com/knadh/koanf/providers/yaml"
	"github.com/knadh/koanf/v2"
)

type Config struct {
	Environment string `koanf:"environment"`
	Server      ServerConfig
	Database    DatabaseConfig
	Supabase    SupabaseConfig
	Worker      WorkerConfig
	Adapter     AdapterConfig
}

type ServerConfig struct {
	Host         string        `koanf:"host"`
	Port         int           `koanf:"port"`
	ReadTimeout  time.Duration `koanf:"read_timeout"`
	WriteTimeout time.Duration `koanf:"write_timeout"`
	IdleTimeout  time.Duration `koanf:"idle_timeout"`
}

type DatabaseConfig struct {
	Host            string `koanf:"host"`
	Port            int    `koanf:"port"`
	User            string `koanf:"user"`
	Password        string `koanf:"password"`
	Name            string `koanf:"name"`
	MaxConns        int    `koanf:"max_conns"`
	MinConns        int    `koanf:"min_conns"`
	MaxConnLifetime time.Duration `koanf:"max_conn_lifetime"`
	MaxConnIdleTime time.Duration `koanf:"max_conn_idle_time"`
}

type SupabaseConfig struct {
	URL            string `koanf:"url"`
	AnonKey        string `koanf:"anon_key"`
	ServiceRoleKey string `koanf:"service_role_key"`
	JWTSecret      string `koanf:"jwt_secret"`
}

type WorkerConfig struct {
	SyncCronSchedule string        `koanf:"sync_cron_schedule"`
	RetryBaseDelay   time.Duration `koanf:"retry_base_delay"`
	MaxRetries       int           `koanf:"max_retries"`
}

type AdapterConfig struct {
	DefaultRateLimit int           `koanf:"default_rate_limit"`
	RequestTimeout   time.Duration `koanf:"request_timeout"`
}

func Load() (*Config, error) {
	k := koanf.New(".")

	// Default values
	defaults := Config{
		Environment: "development",
		Server: ServerConfig{
			Host:         "0.0.0.0",
			Port:         8080,
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
			IdleTimeout:  60 * time.Second,
		},
		Database: DatabaseConfig{
			Host:            "localhost",
			Port:            54322,
			User:            "postgres",
			Password:        "postgres",
			Name:            "postgres",
			MaxConns:        25,
			MinConns:        5,
			MaxConnLifetime: 30 * time.Minute,
			MaxConnIdleTime: 5 * time.Minute,
		},
		Worker: WorkerConfig{
			SyncCronSchedule: "0 2 * * *",
			RetryBaseDelay:   30 * time.Second,
			MaxRetries:       5,
		},
		Adapter: AdapterConfig{
			DefaultRateLimit: 60,
			RequestTimeout:   30 * time.Second,
		},
	}

	if err := k.Load(structs.Provider(defaults, "koanf"), nil); err != nil {
		return nil, err
	}

	// Load from YAML file if exists
	if _, err := os.Stat("config.yaml"); err == nil {
		if err := k.Load(yaml.File("config.yaml"), nil); err != nil {
			return nil, err
		}
	}

	// Load from environment variables (prefix: PHARMACILY_)
	if err := k.Load(env.Provider("PHARMACILY_", ".", func(s string) string {
		return s
	}), nil); err != nil {
		return nil, err
	}

	var cfg Config
	if err := k.Unmarshal("", &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}

func (c *Config) DatabaseURL() string {
	return "postgres://" + c.Database.User + ":" + c.Database.Password + "@" + c.Database.Host + ":" + string(rune(c.Database.Port)) + "/" + c.Database.Name
}