# Pharmacy Locator - Implementation Plan

**Project:** Pharmacily  
**Design Spec:** `docs/superpowers/specs/2026-08-26-pharmacy-locator-design.md`  
**Stack:** Supabase + Go (Railway) + React (Vercel)  
**Team:** 1-2 developers  
**Target:** MVP in 8-10 weeks

---

## Phase 1: Foundation (Weeks 1-2)

### 1.1 Supabase Project Setup
- [ ] Create Supabase project (organization: personal)
- [ ] Enable extensions: `postgis`, `pgcrypto`, `uuid-ossp`
- [ ] Configure Auth: Email magic links, OAuth (Google), disable password auth
- [ ] Set up Vault for API credentials
- [ ] Configure Realtime: enable on `inventory` table
- [ ] Create database roles: `api_service` (Go), `web_client` (React)
- [ ] Apply RLS policies (see Section 1.4)

### 1.2 Database Schema Migration
- [ ] Run migration for all 6 core tables (see design spec)
- [ ] Add indexes: `idx_inventory_drug_pharmacy`, `idx_pharmacies_location` (PostGIS), `idx_inventory_updated`
- [ ] Seed `pharmacy_chains` with: CVS, Walgreens, Walmart, Rite Aid, independent
- [ ] Seed `drugs` with FDA NDC dataset (~200k rows) -- use `openfda` CSV import
- [ ] Verify PostGIS geocoding works: `SELECT * FROM pharmacies WHERE earth_box(ll_to_earth(40.7128, -74.0060), 16093) @> ll_to_earth(latitude, longitude);`

### 1.3 Go Service Scaffold (Railway)
- [ ] Initialize Go module: `github.com/pharmacily/api`
- [ ] Framework: `chi` router + `sqlc` for type-safe queries + `pgx` driver
- [ ] Config: `koanf` (YAML + env), structured logging: `zerolog`
- [ ] Health endpoints: `GET /health`, `GET /ready`
- [ ] Database connection: Supabase connection pooler (transaction mode)
- [ ] Supabase client: `supabase-go` for Vault access
- [ ] Dockerfile: multi-stage, distroless final image
- [ ] Railway config: `railway.toml` with web + worker services

### 1.4 React App Scaffold (Vercel)
- [ ] `npm create vite@latest pharmacily-web -- --template react-ts`
- [ ] Install: `tailwindcss`, `@tailwindcss/vite`, `shadcn/ui`, `@tanstack/react-query`, `react-router-dom`, `leaflet`, `react-leaflet`, `zod`, `@supabase/supabase-js`
- [ ] Configure: TypeScript strict, ESLint (Airbnb), Prettier, Husky pre-commit
- [ ] Supabase client setup: browser client + server client (for SSR if needed)
- [ ] Auth context: `useAuth()` hook with session management
- [ ] Deploy to Vercel: connect GitHub repo, configure env vars
- [ ] Verify: auth flow works (magic link -> redirect -> session)

### 1.5 CI/CD Pipeline
- [ ] GitHub Actions: `.github/workflows/ci.yml`
  - Go: `golangci-lint`, `go test ./...`, `go build`, `sqlc generate`
  - React: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`
- [ ] Railway: auto-deploy on push to `main` (Go service)
- [ ] Vercel: auto-deploy on push to `main` (React app)
- [ ] Supabase: migrations via CLI in CI (`supabase db push`)

### 1.6 RLS Policies (Critical)
```sql
-- Pharmacies: public read, api_service write
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON pharmacies FOR SELECT USING (true);
CREATE POLICY "api_write" ON pharmacies FOR ALL TO api_service USING (true);

-- Inventory: public read (for search), api_service write
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON inventory FOR SELECT USING (true);
CREATE POLICY "api_write" ON inventory FOR ALL TO api_service USING (true);

-- Drugs: public read
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read" ON drugs FOR SELECT USING (true);

-- User favorites: user owns their rows
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own" ON user_favorites FOR ALL USING (auth.uid() = user_id);

-- Pharmacy API configs: pharmacy staff only (via custom claim)
ALTER TABLE pharmacy_api_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pharmacy_staff" ON pharmacy_api_configs FOR ALL 
  USING (auth.jwt() ->> 'role' = 'pharmacy_staff');
```

---

## Phase 2: Core API (Weeks 2-4)

### 2.1 Drug & Pharmacy CRUD (Go)
- [ ] `sqlc` queries for all tables
- [ ] `GET /api/v1/drugs/search?q={query}&limit=20` -- autocomplete (trigram index on `drugs.name`)
- [ ] `GET /api/v1/drugs/{id}` -- drug details
- [ ] `GET /api/v1/pharmacies/nearby?lat={lat}&lng={lng}&radius_km={r}&limit=50` -- PostGIS query
- [ ] `GET /api/v1/pharmacies/{id}` -- pharmacy details + hours
- [ ] `GET /api/v1/pharmacies/{id}/inventory?drug_id={id}` -- stock check

### 2.2 Inventory Search Endpoint (Core)
```go
// GET /api/v1/search?drug_id={id}&lat={lat}&lng={lng}&radius_km=25&in_stock_only=true
// Returns: pharmacies with stock, distance, price, hours_open_now
```
- [ ] Join `inventory` + `pharmacies` + `drugs` with PostGIS distance
- [ ] Filter: `quantity > 0`, `is_active = true`, `earth_distance < radius`
- [ ] Sort: distance ASC, then price_cents ASC
- [ ] Pagination: cursor-based (last_seen_id)
- [ ] Cache: Redis (Railway plugin) or in-memory with 30s TTL

### 2.3 First Pharmacy Adapter (NCPDP or Custom)
- [ ] Define `InventorySync` interface (see design)
- [ ] Implement `NCPDPAdapter` or `CustomAdapter` for first chain
- [ ] Config-driven: endpoint, auth, rate limits from `pharmacy_api_configs`
- [ ] Credential retrieval: Supabase Vault -> decrypt at runtime
- [ ] Unit tests: mock HTTP server, test success/error/rate-limit scenarios

### 2.4 Background Sync Worker
- [ ] Cron job: `0 2 * * *` (nightly 02:00 UTC)
- [ ] For each enabled `pharmacy_api_configs`:
  1. Fetch adapter by `api_type`
  2. Call `FetchInventory()`
  3. Upsert to `inventory` table (idempotent on `pharmacy_id + drug_id`)
  4. Update `last_sync_at`, `last_sync_status`
  5. Emit metrics: synced_count, failed_count, duration
- [ ] Retry queue: failed syncs -> `sync_retry_queue` table -> exponential backoff worker

### 2.5 Webhook Endpoint
- [ ] `POST /api/v1/webhooks/inventory/{pharmacy_id}`
- [ ] Verify signature (HMAC or mutual TLS)
- [ ] Parse payload -> normalize -> upsert inventory
- [ ] Return 200 within 5s (async processing via queue if needed)
- [ ] Idempotency: `Idempotency-Key` header -> deduplicate

### 2.6 OpenAPI Spec & Client Generation
- [ ] Annotate Go handlers with `oapi-codegen` tags
- [ ] Generate: `openapi.yaml` -> TypeScript client for React (`orval` or `openapi-typescript-codegen`)
- [ ] Share Zod schemas between Go and React

---

## Phase 3: Consumer UI (Weeks 4-7)

### 3.1 Layout & Navigation
- [ ] App shell: Header (logo, search), Main, Footer
- [ ] Routes: `/` (landing), `/search` (results), `/drug/:id` (detail), `/pharmacy/:id` (detail), `/favorites` (auth required)
- [ ] Responsive: mobile-first, Tailwind breakpoints

### 3.2 Drug Search (Landing + Autocomplete)
- [ ] Debounced search input (300ms) -> `GET /api/v1/drugs/search`
- [ ] Keyboard navigation (arrow keys, enter)
- [ ] Recent searches (localStorage)
- [ ] Popular drugs carousel (from `inventory` most-queried)

### 3.3 Search Results Page
- [ ] URL state: `/search?drug_id={id}&lat={lat}&lng={lng}&radius=25`
- [ ] Geolocation: browser API -> fallback to IP geolocation (Supabase Edge Function)
- [ ] Map (Leaflet + OpenStreetMap):
  - Markers clustered (`leaflet.markercluster`)
  - Custom icons: in-stock (green), low-stock (yellow), out-of-stock (gray)
  - Popup: name, distance, price, hours, stock level
- [ ] List view (TanStack Table):
  - Columns: Name, Distance, Price, Stock, Hours, Actions
  - Sortable: distance, price
  - Filter chips: "Open now", "In stock", "Under $X"
- [ ] Infinite scroll / pagination
- [ ] Empty state: "No pharmacies found" -> expand radius button

### 3.4 Pharmacy Detail Page
- [ ] Info card: name, address, phone, hours (highlight current day)
- [ ] Map: single marker + directions link (Google Maps / Apple Maps / Waze)
- [ ] Inventory for searched drug: quantity, price, last updated
- [ ] "Notify me" button (auth required) -> creates `user_favorites` with `notify_on_stock=true`
- [ ] Other drugs at this pharmacy (optional cross-sell)

### 3.5 Favorites & Notifications
- [ ] `/favorites` page: list of saved drug+pharmacy pairs
- [ ] Toggle notifications per favorite
- [ ] Supabase Realtime subscription: listen to `inventory` updates for favorited drugs
- [ ] Toast notification: "Your drug is now in stock at Pharmacy X"
- [ ] Email fallback (Supabase Edge Function + Resend/SendGrid) if not online

### 3.6 Realtime Stock Updates
- [ ] TanStack Query: `queryKey: ['inventory', drugId]` with `staleTime: 30000`
- [ ] Supabase Realtime channel per drug (see design spec)
- [ ] Optimistic updates: "Sync Now" button -> invalidate queries
- [ ] Visual indicator: pulsing dot on pharmacy marker when live update received

---

## Phase 4: Pharmacy Dashboard (Weeks 7-9)

### 4.1 Auth & Access Control
- [ ] Supabase Auth: magic link only for pharmacy staff
- [ ] Custom JWT claim: `role: pharmacy_staff`, `pharmacy_id: {uuid}`
- [ ] RLS policy uses `auth.jwt() ->> 'pharmacy_id'`
- [ ] Invite flow: admin creates `pharmacy_api_configs` -> sends invite link

### 4.2 Dashboard Layout
- [ ] Sidebar: Inventory, Sync Status, Settings
- [ ] Header: pharmacy name, last sync time, connection status

### 4.3 Inventory Editor
- [ ] TanStack Table: virtualized, 1000+ rows
- [ ] Columns: Drug (searchable), Quantity (editable), Price (editable), Last Updated, Source, Actions
- [ ] Inline edit: click cell -> input -> blur to save (debounced 500ms)
- [ ] Bulk actions: "Mark all in stock", "Update prices by %"
- [ ] Validation: quantity >= 0, price_cents > 0
- [ ] Optimistic UI + rollback on error

### 4.4 Sync Status Panel
- [ ] Last sync: timestamp, status (success/partial/failed), items synced
- [ ] Error log: expandable rows with error message, retry button
- [ ] "Sync Now" button -> triggers background job -> polls status
- [ ] Webhook test: "Send test payload" button

### 4.5 Settings
- [ ] API Configuration: endpoint, credentials (Vault UI), sync schedule (cron expression builder)
- [ ] Notification preferences: email on sync failure, low stock alerts
- [ ] Staff management: invite/remove team members (Supabase Auth admin API)

---

## Phase 5: Multi-Chain & Polish (Weeks 9-10+)

### 5.1 Additional Adapters
- [ ] CVS / Walgreens / Walmart adapters (research their APIs)
- [ ] Independent pharmacy: generic CSV/SFTP adapter
- [ ] Surescripts adapter (if available)
- [ ] Each adapter: unit tests, integration test against sandbox

### 5.2 Geocoding Service
- [ ] Supabase Edge Function: `geocode(address)` -> Nominatim (free) or Google Maps
- [ ] Cache results in `geocode_cache` table (address_hash -> lat/lng)
- [ ] Batch geocode on pharmacy import

### 5.3 Monitoring & Observability
- [ ] Sentry: Go + React (free tier: 5k events/mo)
- [ ] Supabase Logs: query performance, RLS violations
- [ ] Railway Metrics: CPU, memory, request latency
- [ ] Custom metrics: sync success rate, API latency p95, search latency p95

### 5.4 Performance Optimization
- [ ] Add materialized view for search: `mv_pharmacy_inventory` (refresh nightly)
- [ ] CDN caching: Vercel ISR for drug search, pharmacy detail
- [ ] Database: `pg_stat_statements` -> find slow queries
- [ ] Frontend: code splitting, lazy load map, virtualized lists

### 5.5 Testing
- [ ] Go: unit tests (80% coverage), integration tests (testcontainers PostGIS)
- [ ] React: Vitest + React Testing Library (components), Playwright (E2E: search -> result -> favorite)
- [ ] Contract tests: Pact for pharmacy adapters
- [ ] Load test: k6 script for search endpoint (100 VUs)

### 5.6 Documentation & Handoff
- [ ] API docs: Swagger UI at `/docs` (Go service)
- [ ] Architecture decision records (ADRs) in `/docs/adr/`
- [ ] Runbook: common ops (credential rotation, failed sync debug, scaling)
- [ ] Onboarding guide for new pharmacy chains

---

## Open Questions to Resolve

| # | Question | Decision Needed By |
|---|----------|-------------------|
| 1 | Geocoding: Nominatim (free, rate-limited) vs Google Maps API (paid, reliable)? | Phase 1 |
| 2 | Drug data source: FDA openFDA (free, ~200k NDCs) vs commercial (RxNorm, Medi-Span)? | Phase 1 |
| 3 | Pharmacy onboarding: self-serve signup vs manual admin approval? | Phase 4 |
| 4 | Monitoring: Sentry free tier sufficient or need Datadog/New Relic? | Phase 5 |
| 5 | Testing: Pact contract tests for adapters -- worth the setup time? | Phase 2 |

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Pharmacy APIs unavailable/undocumented | High | High | Start with 1 chain; build adapter framework first; fallback to manual CSV upload |
| Supabase free tier limits hit early | Medium | Medium | Monitor usage; optimize queries; plan migration to Pro at 80% capacity |
| Go service complexity grows | Medium | Medium | Keep adapters isolated; strict interface; regular refactoring |
| Real-time sync reliability | Medium | High | Idempotency keys, dead letter queue, comprehensive logging |
| Geocoding accuracy for rural areas | Low | Medium | Fallback to zip-code centroid; allow manual lat/lng override |

---

## Definition of Done (MVP)

- [ ] User searches drug -> sees map/list of pharmacies with stock/price within 25km
- [ ] Results update in real-time when inventory changes
- [ ] Pharmacy staff logs in -> edits inventory -> sees sync status
- [ ] All deployed on free tiers, CI/CD passing
- [ ] Basic monitoring: Sentry alerts on errors
- [ ] Documentation: API spec, runbook, onboarding guide

---

## Next Steps

1. **User reviews this plan** -- approve or request changes
2. **Invoke `writing-plans` skill** to break into actionable tasks (if not already done)
3. **Start Phase 1** -- Foundation setup
