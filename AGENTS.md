# AGENTS.md – Pharmacily

> Single source of truth for AI agents working on Pharmacily. Two apps, one backend, one design language.

## 1. Product in 30s

Pharmacily solves: "I was prescribed a drug but can't find which pharmacy has it in stock."

- **Drug Locator (public web app):** search drug → see pharmacies with it in stock, price in Gh₵, quantity left, hours, phone/WhatsApp, distance. Map + list. Favorites + stock alerts.
- **Pharmacy Management System (pharmacy app):** pharmacies sign up, verify PCG licence, onboard, manage inventory / batches / expiry / sales / settings. Data entered here is what powers Locator availability.
- **Shared backend:** Supabase Postgres + PostGIS + Realtime. Pharmacy app writes; Locator reads only `verified + visible_to_public + in_stock`.

## 2. Repo map

```
pharmacily/
├── AGENTS.md
├── README.md
├── package.json                  # npm workspaces ["pharmacily-web"], husky
├── pharmacily-web/               # React 19 + TS + Vite 8 + Tailwind v4 + TQ5 + RR7
│   ├── src/App.tsx               # routes: / /search /favorites /auth/* /pharmacy/*
│   ├── src/pages/                # Landing, SearchResults, Favorites, PharmacyLogin, PharmacyDashboard, AuthCallback
│   ├── src/components/ui/        # Radix primitives
│   ├── src/hooks/useAuth.tsx
│   ├── src/index.css              # Tailwind v4 @theme — canonical tokens live here
│   ├── tailwind.config.ts         # STALE v3 style — do not use for new work
│   └── vite.config.ts
├── pharmacily-api/               # Go 1.25 + Chi v5 + pgx/v5 + sqlc + koanf + zerolog
│   ├── cmd/api/
│   ├── internal/adapter,config,db,handler,worker/
│   ├── sql/ + sqlc.yaml
│   └── Makefile
├── supabase/
│   ├── config.toml
│   └── migrations/20260827013558_init_schema.sql
├── UI-Inspiration/
│   ├── Pharmacily Design Language.dc.html  # NORMATIVE design spec
│   └── Pharmacily App.dc.html
└── docs/
```

## 3. Commands

```bash
# web
npm run dev:web                    # vite dev :3000
npm run build:web
npm run lint:web                   # oxlint --workspace=pharmacily-web
npm run test:web
# api
npm run dev:api                    # cd pharmacily-api && go run ./cmd/api :8081 (local config.yaml; :8080 is Apache on some machines)
npm run build:api
npm run lint:api                   # golangci-lint run ./...
npm run test:api                   # go test ./...
npm run generate:api               # sqlc generate
# db (requires Docker + Supabase CLI)
npm run db:start                    # supabase start (Studio :54323, DB :54322, API :54321)
npm run db:push                     # supabase db push
npm run db:reset
```

Prereqs: Node 20+, Go 1.25+, Docker Desktop, `brew install supabase/tap/supabase`.
Copy `.env.example` → `.env` in both `pharmacily-web/` and `pharmacily-api/` before running.

## 4. Architecture

- `pharmacily-web` (Vercel) → `pharmacily-api` (Railway, Chi `/api/v1/*`) → Supabase Postgres.
- Auth + Realtime go direct web → Supabase (magic links, `inventory` updates).
- Maps: Leaflet + OpenStreetMap + markercluster. No Google Maps.
- Currency stored as integer pesewas in DB/API, formatted as `Gh₵ 4,280.50` in UI with `tabular-nums`.

## 5. Design Language — normative

Source: `UI-Inspiration/Pharmacily Design Language.dc.html` — "A calm, pastel counter for people who work fast." This section wins over any default Tailwind/shadcn values.

### Tokens (Tailwind v4 `@theme` canonical)

```css
--color-ground: #EEF3EF;   /* page behind every card */
--color-card: #FFFFFF;      /* every data surface, radius 20, no border */
--color-deep: #0F4034;      /* one primary action per view, active nav */
--color-live: #1D7A5F;      /* hover, links, focus edge */
--color-ink: #16241D;       /* headings + figures only */
--color-muted: #5D7A6F;     /* labels, secondary rows */
--color-field: #F6FAF6;     /* all inputs — card stays brightest */
--color-sales-bg: #DFF0C2; --color-sales-ink: #243312; --color-sales-label: #4A6321;
--color-stock-bg: #C6E6DF; --color-stock-ink: #123830; --color-stock-label: #1F5B51;
--color-expiry-bg: #F7CDCD; --color-expiry-ink: #4D1B1E; --color-expiry-label: #8C3236;
--color-expiry-tint: #FDF3F3;
--color-people-bg: #D3D1F4; --color-people-ink: #241F52; --color-people-label: #403A86;
```

Pastels never drift: green = money in, teal = on shelf, rose = time running out + refunds, lilac = people + Rx. Never grey text on pastel. `OTC` pill is mint/muted only.

- Type: Outfit 600 headings/figures (Display 46/1.05, Section 24, Figure 30 tabular), Plus Jakarta Sans body 15/1.65 min, table rows 13.5 min, label 11.5px `.1em` uppercase `#5D7A6F`. Never bolder than 600. Sentence case. Money/counts/dates `font-variant-numeric: tabular-nums`.
- Shape: 10 fields/thumbs/pack photos, 14 nav/tiles, 16 drug rows, 20 cards/panels, 999 pills/buttons/avatars. Space `4/8/12/16/24/32/48`, card padding 24, card gap 20, page gutter 40 (16 mobile).
- Elevation (green-tinted only): resting `0 1px 3px rgba(16,50,40,.06)`, floating `0 4px 14px rgba(16,50,40,.09)`, modal `0 16px 40px rgba(16,50,40,.16)`. No borders on white cards.
- Components: pill buttons 40–44px `11px 20px`; pills `5px 12px` 12/500 (`In stock` teal, `Low stock` green, `Expires` rose, `Rx` lilac, `OTC` mint); fields `#F6FAF6` 10px (search 999) border `rgba(16,50,40,.1)` focus `1px #1D7A5F`; nav 14px active filled deep + `ph-fill` 17px, idle mint circle regular + rose badge; drug row 16px tile `#F6FAF6` (trouble `#FDF3F3`), 46px thumb, price Outfit 17 tabular; charts rounded bars in mint track, today deep-green, series green→teal→rose→lilac→peach `#F3CBA3`→orchid `#EAB7E2`; pack photo 88px square 10px, fallback pastel tile tinted by status.
- Icons: Phosphor `regular` 16–20px in soft circles, `fill` only for active nav. Phosphor is canonical for new UI; `lucide-react` is legacy — do not add new lucide icons.
- Voice: plain + specific. "5 items expire within 30 days", "Amoxicillin 500mg — 12 left, expires 28 Sep 2026". No exclamation marks.
- Logo: capsule-cross preferred (`44px` tile `rx14` `#0F4034` + `#D8ECB4`/`#A8DCCF`), reversed on dark. Min 20px.

`tailwind.config.ts` is stale v3 style — do not copy colors/radii from it. Put new tokens in `src/index.css` `@theme`.

## 6. Web conventions (`pharmacily-web/`)

- Router (`src/App.tsx`): `/`, `/search`, `/favorites` (protected), `/auth/login`, `/auth/callback`, `/pharmacy/login`, `/pharmacy/*` (pharmacy_staff, inside `PharmacyLayout` sidebar shell). Pharmacy routes: `/pharmacy` → redirect `dashboard`, `dashboard`, `sell`, `drugs`, `stock-take`, `stock-take/:sessionId`, `stock-take/:sessionId/review` (pharmacist only), `alerts`, `suppliers` + `reports` (pharmacist only, staff redirected). Sidebar lives in `src/components/pharmacy/` (`Sidebar`, `PharmacyLayout`, `PharmacyTopBar`, `StockPill`); role hook `usePharmacyRole` (`src/hooks/usePharmacyRole.ts`). Later: `/signup`, `/verify`, `/onboarding/*`, `/app/orders`, `/app/people`.
- Data: TanStack Query (`stale 5m, gc 10m, retry 1, no refocus`), Supabase client in `src/lib/`, zod validation, Radix + `cva` for primitives. Realtime subscribe to `inventory` for locator price/qty.
- Guards: `ProtectedRoute` (any user), `PharmacyProtectedRoute` (`app_metadata.role === 'pharmacy_staff'`). Role split via `pharmacy_role` app claim (`'pharmacist'|'staff'`, default staff = least privilege): staff get Sell + count entry + read-only drugs/alerts, hidden Suppliers/Reports/review; pharmacists get everything including variance approval and write-offs. JWT `app_metadata` nests — RLS must use `auth.jwt() -> 'app_metadata' ->> '...'` (top-level `->>` never matches; fixed 2026-09-09).
- Maps: Leaflet container `.map-container` 500px (400 mobile), `.pharmacy-marker` dots colored by status, cluster via `leaflet.markercluster`.
- Ghana formatting: `Gh₵` in UI (never `GHC`), `GHS`/pesewas in code, `+233` E.164 phones + WhatsApp deep link, `Africa/Accra` timezone, PCG licence. Example data: Kwabena, Ernest Chemists, Danadams.
- Touch targets 44px min, bottom tab bar + FAB on mobile, max content `1180px`.

## 7. API conventions (`pharmacily-api/`)

- Base `/api/v1`: `GET /health`, `GET /drugs/search?q=`, `GET /drugs/{id}`, `GET /pharmacies/nearby?lat&lng&radius`, `GET /pharmacies/{id}`, `GET /search?drug&lat&lng`. Manager adds: `POST/PATCH /pharmacy/profile`, `/pharmacy/inventory`, `/pharmacy/adjust`, `/pharmacy/sales`, `/pharmacy/settings`.
- Layers: `handler/` (Chi, DTO + validation) → `adapter/` → `db/` (sqlc + pgx). Config via koanf (`config.yaml` + env), logging zerolog, cron for expiry sweeps, gobreaker for chain syncs. CORS via `go-chi/cors` in `Routes()` with `server.allowed_origins` (dev: localhost/127.0.0.1/192.168.1.99 `:3000`; extend for prod) — the web app sends `Content-Type: application/json`, so preflight must pass or all UI search fails. Restart gotcha: kill the `:8081` listener by PID (`lsof -i :8081 -t | xargs kill`) — `pkill -f cmd/api` misses it.
- Validation: `price_pesewas > 0, qty >= 0, expiry_date > today, batch_no required if Rx`. Errors JSON `{error, details}` with proper status. Rx sale blocked unless `rx_confirmed=true`.
- Run `sqlc generate` after any `sql/` change; never hand-edit `db/` generated files.

## 8. Data + RLS (`supabase/`)

- Current: `pharmacies, pharmacy_chains, drugs (ndc_code), inventory (quantity, price_cents, source), user_favorites, pharmacy_api_configs, sync_retry_queue, geocode_cache` with pg_trgm + PostGIS `ll_to_earth`.
- Evolution (new migration, do not rewrite init): add `pharmacies.licence_no, verified bool, visible_to_public bool, geo GEOGRAPHY(Point)`; `inventory.price_pesewas INT>0, batch_no, expiry_date DATE, visible bool, low_stock_threshold INT, updated_at`; new `stock_ledger(inventory_id, delta, reason, actor)` + `sales(pharmacy_id, total_pesewas, lines JSONB, rx_confirmed)`. pg_cron sets `in_stock=false, visible=false` when expired.
- RLS: pharmacy writes only own `pharmacy_id`; public reads only `verified + visible_to_public + qty>0 + expiry>today`. Staff `INSERT/UPDATE` own-pharmacy `inventory` (pharmacist-only UI; `qty>=0`, `price>0` checked). `stock_take_sessions`/`stock_take_lines`: staff draft+count+submit own pharmacy; `approve/reject` requires `pharmacy_role='pharmacist'` in **both** `USING` and `WITH CHECK` (RLS OR-composes policies across clauses — role check in one clause only is bypassable). `updated_at` shown on locator as "Updated 2h ago". Search via `pg_trgm` on brand+generic, nearby via `ST_DWithin`.
- CSV import must preview resolved `drug_id` matches, reject missing price/expiry rows (rose highlight) before commit.

## 9. Quality gates

```bash
npm run lint:web && npm run test:web      # oxlint + vitest (web)
npm run lint:api && npm run test:api      # golangci-lint + go test (api)
# tsc -b in pharmacily-web before every PR
```

Contrast AA (dark ink on pastels only), keyboard-only run, 360px + 1280px pass, 3G throttle with skeletons + pastel fallbacks, seed Ernest Chemists/Danadams and verify locator reflects pharmacy edit <5s.

## 10. Dos / Don'ts

- DO: one deep-green primary per view; tint whole drug row + thumb when in trouble; bump `updated_at` on every sale/adjust; use tabular numerals.
- DON'T: add new colors, use grey text on pastel, put borders on white cards, use lucide for new icons, exceed 600 weight, free-text duplicate drugs (use catalogue autocomplete + trigram warning).

## 11. Subagent routing

- UI Designer → tokens, screens, flows in `UI-Inspiration/` language.
- Frontend Developer → `pharmacily-web/` routes/components.
- Backend Architect → `pharmacily-api/` Chi handlers, Chi+sqlc patterns.
- Database Optimizer → `supabase/migrations/` + RLS/indexes.
- Security Engineer → Vault creds, RLS, Rx gating. Minimal-change diffs only.
