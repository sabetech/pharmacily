package adapter

import (
	"context"
	"math/rand"
	"time"

	"github.com/sony/gobreaker"
)

type MockAdapter struct {
	config Config
	breaker *gobreaker.CircuitBreaker
}

func NewMockAdapter(config Config) InventorySync {
	settings := gobreaker.Settings{
		Name:        "mock-adapter",
		MaxRequests: 3,
		Interval:    10 * time.Second,
		Timeout:     30 * time.Second,
		ReadyToTrip: func(counts gobreaker.Counts) bool {
			return counts.TotalFailures >= 5
		},
		OnStateChange: func(name string, from gobreaker.State, to gobreaker.State) {
			// Log state changes
		},
	}

	return &MockAdapter{
		config: config,
		breaker: gobreaker.NewCircuitBreaker(settings),
	}
}

func (m *MockAdapter) FetchInventory(ctx context.Context, pharmacy Pharmacy) ([]InventoryItem, error) {
	_, err := m.breaker.Execute(func() (interface{}, error) {
		// Simulate API call delay
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Duration(rand.Intn(200)) * time.Millisecond):
		}

		// Simulate occasional errors (10% chance)
		if rand.Float64() < 0.1 {
			return nil, ErrAPIUnavailable
		}

		return nil, nil
	})

	if err != nil {
		return nil, err
	}

	// Generate mock inventory data
	drugs := []struct {
		NDC     string
		Name    string
		Generic string
		Strength string
		Form    string
	}{
		{"00002321401", "Lipitor", "Atorvastatin", "10mg", "tablet"},
		{"00002321402", "Lipitor", "Atorvastatin", "20mg", "tablet"},
		{"00002321403", "Lipitor", "Atorvastatin", "40mg", "tablet"},
		{"00002321404", "Lipitor", "Atorvastatin", "80mg", "tablet"},
		{"00074345601", "Metformin", "Metformin HCl", "500mg", "tablet"},
		{"00074345602", "Metformin", "Metformin HCl", "850mg", "tablet"},
		{"00074345603", "Metformin", "Metformin HCl", "1000mg", "tablet"},
		{"00009372010", "Lisinopril", "Lisinopril", "10mg", "tablet"},
		{"00009372020", "Lisinopril", "Lisinopril", "20mg", "tablet"},
		{"00009372040", "Lisinopril", "Lisinopril", "40mg", "tablet"},
		{"00002345678", "Amoxicillin", "Amoxicillin", "500mg", "capsule"},
		{"00002345679", "Amoxicillin", "Amoxicillin", "875mg", "tablet"},
		{"00002345680", "Azithromycin", "Azithromycin", "250mg", "tablet"},
		{"00002345681", "Azithromycin", "Azithromycin", "500mg", "tablet"},
		{"00002345682", "Levothyroxine", "Levothyroxine Sodium", "50mcg", "tablet"},
		{"00002345683", "Levothyroxine", "Levothyroxine Sodium", "75mcg", "tablet"},
		{"00002345684", "Levothyroxine", "Levothyroxine Sodium", "100mcg", "tablet"},
		{"00002345685", "Levothyroxine", "Levothyroxine Sodium", "125mcg", "tablet"},
	}

	items := make([]InventoryItem, 0, len(drugs))
	for _, d := range drugs {
		// Random quantity (0-100)
		qty := rand.Intn(101)

		// Random price (500-5000 cents)
		price := 500 + rand.Intn(4500)

		// 20% chance of being out of stock
		if rand.Float64() < 0.2 {
			qty = 0
		}

		items = append(items, InventoryItem{
			DrugNDC:     d.NDC,
			DrugName:    d.Name,
			GenericName: d.Generic,
			Strength:    d.Strength,
			Form:        d.Form,
			Quantity:    qty,
			PriceCents:  &price,
			LastUpdated: time.Now().Add(-time.Duration(rand.Intn(3600)) * time.Second),
			Source:      "api",
		})
	}

	return items, nil
}

func (m *MockAdapter) PushInventory(ctx context.Context, pharmacy Pharmacy, items []InventoryItem) error {
	_, err := m.breaker.Execute(func() (interface{}, error) {
		// Simulate API call
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(time.Duration(rand.Intn(100)) * time.Millisecond):
		}
		return nil, nil
	})
	return err
}

func (m *MockAdapter) GetRateLimit() RateLimitConfig {
	return RateLimitConfig{
		RequestsPerMinute: m.config.RateLimit,
		Burst:             m.config.RateLimit / 4,
	}
}

func (m *MockAdapter) HealthCheck(ctx context.Context) error {
	return m.breaker.Execute(func() (interface{}, error) {
		return nil, nil
	})
}

func (m *MockAdapter) GetCircuitBreaker() *gobreaker.CircuitBreaker {
	return m.breaker
}

var ErrAPIUnavailable = &APIError{Message: "API temporarily unavailable"}

type APIError struct {
	Message string
}

func (e *APIError) Error() string {
	return e.Message
}

func IsAPIError(err error) bool {
	_, ok := err.(*APIError)
	return ok
}