package adapter

import (
	"context"
	"time"

	"github.com/sony/gobreaker"
)

type InventoryItem struct {
	DrugNDC     string
	DrugName    string
	GenericName string
	Strength    string
	Form        string
	Quantity    int
	PriceCents  *int
	LastUpdated time.Time
	Source      string
}

type Pharmacy struct {
	ID              string
	Name            string
	ChainID         string
	APIType         string
	Endpoint        string
	CredentialsRef  string
	RateLimit       int
	RequestTimeout  time.Duration
}

type RateLimitConfig struct {
	RequestsPerMinute int
	Burst             int
}

type InventorySync interface {
	FetchInventory(ctx context.Context, pharmacy Pharmacy) ([]InventoryItem, error)
	PushInventory(ctx context.Context, pharmacy Pharmacy, items []InventoryItem) error
	GetRateLimit() RateLimitConfig
	HealthCheck(ctx context.Context) error
	GetCircuitBreaker() *gobreaker.CircuitBreaker
}

type AdapterRegistry struct {
	adapters map[string]func(Config) InventorySync
}

type Config struct {
	Endpoint        string
	CredentialsRef  string
	RateLimit       int
	RequestTimeout  time.Duration
}

func NewAdapterRegistry() *AdapterRegistry {
	return &AdapterRegistry{
		adapters: make(map[string]func(Config) InventorySync),
	}
}

func (r *AdapterRegistry) Register(apiType string, factory func(Config) InventorySync) {
	r.adapters[apiType] = factory
}

func (r *AdapterRegistry) Get(apiType string) (func(Config) InventorySync, bool) {
	factory, ok := r.adapters[apiType]
	return factory, ok
}

func (r *AdapterRegistry) MustGet(apiType string) func(Config) InventorySync {
	factory, ok := r.adapters[apiType]
	if !ok {
		panic("adapter not registered: " + apiType)
	}
	return factory
}