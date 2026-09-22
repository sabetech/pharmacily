# Pharmacily - National Pharmacy Drug Locator

A web application that helps users locate pharmacies with specific medications in stock, with real-time inventory updates and price comparison.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + TanStack Query
- **Backend**: Go 1.25 + Chi + SQLC + PGX
- **Database**: PostgreSQL (Supabase) with PostGIS
- **Auth**: Supabase Auth (magic links)
- **Realtime**: Supabase Realtime
- **Hosting**: Vercel (frontend) + Railway (backend) + Supabase (database)
- **Maps**: Leaflet + OpenStreetMap

## Project Structure

```
pharmacily/
├── pharmacily-web/          # React frontend
├── pharmacily-api/          # Go backend API
├── supabase/                # Supabase configuration & migrations
├── .github/workflows/       # CI/CD pipelines
└── docs/                    # Documentation
```

## Getting Started

### Prerequisites

- Node.js 20+
- Go 1.25+
- Docker Desktop
- Supabase CLI (`brew install supabase/tap/supabase`)

### Local Development

1. **Start Supabase local stack:**
   ```bash
   supabase start
   ```

2. **Run database migrations:**
   ```bash
   supabase db push
   ```

3. **Start Go API (Terminal 1):**
   ```bash
   npm run dev:api
   ```
   This runs `go run ./cmd/api` inside `pharmacily-api/`, which picks up the
   untracked local `config.yaml` (API on :8081 — Homebrew Apache already holds
   :8080 on some machines). Copy `config.yaml.example` → `config.yaml` if it
   is missing. Note: `PHARMACILY_*` env vars in `.env` are currently ignored
   by config loading (koanf prefix bug) — `config.yaml` is the working local
   mechanism.

4. **Start React app (Terminal 2):**
   ```bash
   cd pharmacily-web
   cp .env.example .env
   npm run dev
   ```

5. **Access applications:**
   - Frontend: http://localhost:3000 (also http://127.0.0.1:3000 — both serve)
   - API: http://localhost:8081 (`/health`, `/ready`, `/api/v1/*`)
   - Supabase Studio: http://localhost:54323
   - Mailpit (email testing): http://localhost:54324

### Database

The local Supabase instance runs on:
- **Database**: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **API**: `http://127.0.0.1:54321`
- **Studio**: `http://127.0.0.1:54323`

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/drugs/search?q={query}` | Search drugs (autocomplete) |
| GET | `/api/v1/drugs/{id}` | Get drug details |
| GET | `/api/v1/pharmacies/nearby` | Find pharmacies near location |
| GET | `/api/v1/pharmacies/{id}` | Get pharmacy details |
| GET | `/api/v1/search` | Search inventory by drug + location |

### Deployment

1. **Frontend (Vercel):**
   - Connect GitHub repository
   - Set environment variables from `.env.example`
   - Deploy automatically on push to main

2. **Backend (Railway):**
   - Connect GitHub repository
   - Set environment variables from `.env.example`
   - Deploy automatically on push to main

3. **Database (Supabase):**
   - Create production project
   - Run migrations: `supabase db push --project-ref <ref>`
   - Configure Auth providers

## Features

### Consumer App
- Drug search with autocomplete
- Map-based pharmacy search with stock levels
- Price comparison across pharmacies
- Favorites and stock alerts
- Real-time inventory updates

### Pharmacy Dashboard
- Magic link authentication
- Inventory management
- Sync status monitoring
- API configuration

## CI/CD

- **Go**: Lint (golangci-lint), Test, Build, SQLC generate
- **Web**: Lint (ESLint), TypeCheck (tsc), Test (Vitest), Build
- **Supabase**: Migration verification

## License

MIT