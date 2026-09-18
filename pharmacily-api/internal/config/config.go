package config

import (
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/knadh/koanf/parsers/yaml"
	"github.com/knadh/koanf/providers/file"
	"github.com/knadh/koanf/providers/structs"
	"github.com/knadh/koanf/v2"
)

type Config struct {
	Environment string         `koanf:"environment"`
	Server      ServerConfig  `koanf:"server"`
	Database    DatabaseConfig `koanf:"database"`
	Supabase    SupabaseConfig `koanf:"supabase"`
	Worker      WorkerConfig  `koanf:"worker"`
	Adapter     AdapterConfig `koanf:"adapter"`
}

type ServerConfig struct {
	Host           string        `koanf:"host"`
	Port           int           `koanf:"port"`
	ReadTimeout    time.Duration `koanf:"read_timeout"`
	WriteTimeout   time.Duration `koanf:"write_timeout"`
	IdleTimeout    time.Duration `koanf:"idle_timeout"`
	AllowedOrigins []string      `koanf:"allowed_origins"`
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
			AllowedOrigins: []string{
				"http://localhost:3000",
				"http://127.0.0.1:3000",
				"http://192.168.1.99:3000",
			},
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
			SyncCronSchedule: "0 0 2 * * *",
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
		if err := k.Load(file.Provider("config.yaml"), yaml.Parser()); err != nil {
			return nil, err
		}
	}

	var cfg Config
	if err := k.Unmarshal("", &cfg); err != nil {
		return nil, err
	}

	// Explicit PHARMACILY_* overlay. (koanf's env provider was dropped: its
	// callback returned keys unchanged, so nested keys never mapped and env
	// was silently ignored in favor of config.yaml. Explicit parsing here
	// keeps the .env.example contract working on Railway/Vercel.)
	overlayFromEnv(&cfg)

	return &cfg, nil
}

// overlayFromEnv applies PHARMACILY_* environment variables on top of the
// loaded config. Unset or unparsable values leave the current value alone.
func overlayFromEnv(cfg *Config) {
	if v := os.Getenv("PHARMACILY_ENVIRONMENT"); v != "" {
		cfg.Environment = v
	}
	if v := os.Getenv("PHARMACILY_SERVER_HOST"); v != "" {
		cfg.Server.Host = v
	}
	if n, ok := envInt("PHARMACILY_SERVER_PORT"); ok {
		cfg.Server.Port = n
	}
	if v := os.Getenv("PHARMACILY_SERVER_ALLOWED_ORIGINS"); v != "" {
		origins := splitList(v)
		if len(origins) > 0 {
			cfg.Server.AllowedOrigins = origins
		}
	}
	if v := os.Getenv("PHARMACILY_DATABASE_HOST"); v != "" {
		cfg.Database.Host = v
	}
	if n, ok := envInt("PHARMACILY_DATABASE_PORT"); ok {
		cfg.Database.Port = n
	}
	if v := os.Getenv("PHARMACILY_DATABASE_USER"); v != "" {
		cfg.Database.User = v
	}
	if v := os.Getenv("PHARMACILY_DATABASE_PASSWORD"); v != "" {
		cfg.Database.Password = v
	}
	if v := os.Getenv("PHARMACILY_DATABASE_NAME"); v != "" {
		cfg.Database.Name = v
	}
	if n, ok := envInt("PHARMACILY_DATABASE_MAX_CONNS"); ok {
		cfg.Database.MaxConns = n
	}
	if v := os.Getenv("PHARMACILY_SUPABASE_URL"); v != "" {
		cfg.Supabase.URL = v
	}
	if v := os.Getenv("PHARMACILY_SUPABASE_ANON_KEY"); v != "" {
		cfg.Supabase.AnonKey = v
	}
	if v := os.Getenv("PHARMACILY_SUPABASE_SERVICE_ROLE_KEY"); v != "" {
		cfg.Supabase.ServiceRoleKey = v
	}
	if v := os.Getenv("PHARMACILY_SUPABASE_JWT_SECRET"); v != "" {
		cfg.Supabase.JWTSecret = v
	}
	if v := os.Getenv("PHARMACILY_WORKER_SYNC_CRON_SCHEDULE"); v != "" {
		cfg.Worker.SyncCronSchedule = v
	}
	if d, ok := envDuration("PHARMACILY_WORKER_RETRY_BASE_DELAY"); ok {
		cfg.Worker.RetryBaseDelay = d
	}
	if n, ok := envInt("PHARMACILY_WORKER_MAX_RETRIES"); ok {
		cfg.Worker.MaxRetries = n
	}
	if n, ok := envInt("PHARMACILY_ADAPTER_DEFAULT_RATE_LIMIT"); ok {
		cfg.Adapter.DefaultRateLimit = n
	}
	if d, ok := envDuration("PHARMACILY_ADAPTER_REQUEST_TIMEOUT"); ok {
		cfg.Adapter.RequestTimeout = d
	}

	// Railway (and most PaaS hosts) inject the listen port as bare PORT.
	// Honor it when set so the service binds where the platform routes.
	if n, ok := envInt("PORT"); ok {
		cfg.Server.Port = n
	}
}

func envInt(key string) (int, bool) {
	v := os.Getenv(key)
	if v == "" {
		return 0, false
	}
	n, err := strconv.Atoi(strings.TrimSpace(v))
	if err != nil || n <= 0 {
		return 0, false
	}
	return n, true
}

func envDuration(key string) (time.Duration, bool) {
	v := os.Getenv(key)
	if v == "" {
		return 0, false
	}
	d, err := time.ParseDuration(strings.TrimSpace(v))
	if err != nil || d <= 0 {
		return 0, false
	}
	return d, true
}

// splitList parses comma- or space-separated lists (CORS origins etc.).
func splitList(v string) []string {
	v = strings.ReplaceAll(v, ",", " ")
	var out []string
	for _, s := range strings.Fields(v) {
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}


func (c *Config) DatabaseURL() string {
	return "postgres://" + c.Database.User + ":" + c.Database.Password + "@" + c.Database.Host + ":" + strconv.Itoa(c.Database.Port) + "/" + c.Database.Name
}