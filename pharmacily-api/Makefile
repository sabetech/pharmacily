.PHONY: help build run test lint generate clean docker-build docker-run

# Default target
help:
	@echo "Pharmacily API - Available targets:"
	@echo "  build        - Build the Go binary"
	@echo "  run          - Run the API server locally"
	@echo "  test         - Run tests"
	@echo "  lint         - Run linters"
	@echo "  generate     - Generate sqlc code"
	@echo "  clean        - Clean build artifacts"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run   - Run Docker container"
	@echo "  migrate      - Run database migrations"
	@echo "  dev          - Run with live reload (requires air)"

# Build the binary
build:
	CGO_ENABLED=0 go build -o bin/api ./cmd/api

# Run the API server
run: generate
	go run ./cmd/api

# Run tests
test:
	go test -v ./...

# Run linters
lint:
	golangci-lint run

# Generate sqlc code
generate:
	sqlc generate

# Clean build artifacts
clean:
	rm -rf bin/
	rm -f config.yaml

# Build Docker image
docker-build:
	docker build -t pharmacily-api:latest .

# Run Docker container
docker-run: docker-build
	docker run --rm -p 8080:8080 \
		-e PHARMACILY_DATABASE_HOST=host.docker.internal \
		-e PHARMACILY_DATABASE_PORT=54322 \
		-e PHARMACILY_DATABASE_USER=postgres \
		-e PHARMACILY_DATABASE_PASSWORD=postgres \
		-e PHARMACILY_DATABASE_NAME=postgres \
		-e PHARMACILY_SUPABASE_URL=http://host.docker.internal:54321 \
		-e PHARMACILY_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH \
		-e PHARMACILY_SUPABASE_SERVICE_ROLE_KEY=YOUR_LOCAL_SUPABASE_SERVICE_ROLE_KEY \
		-e PHARMACILY_SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long \
		pharmacily-api:latest

# Run database migrations (using Supabase CLI)
migrate:
	supabase db push

# Run with live reload (requires: go install github.com/air-verse/air@latest)
dev:
	air -c .air.toml

# Generate OpenAPI spec
openapi:
	oapi-codegen -generate types,chi-server,spec -o internal/handler/openapi.gen.go openapi.yaml

# Setup development environment
setup:
	go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
	go install github.com/air-verse/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest
	go mod tidy
	sqlc generate