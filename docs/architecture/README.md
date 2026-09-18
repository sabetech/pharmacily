# Pharmacily architecture

## System design (staging)

![System design diagram](system-design.png)

SVG version: [system-design.svg](system-design.svg) · Source: [system-design.mmd](system-design.mmd)

```mermaid
%% (inline copy — GitHub renders this block; system-design.mmd is authoritative)
flowchart TB
    patient(["Patient / Tester<br/>Finds medicine stock"]) ~~~ staff(["Pharmacy staff<br/>Sells, adjusts, counts"]) ~~~ owner(["Pharmacy owner<br/>Onboards shops"])
    subgraph vercel["Vercel"]
        spa["Pharmacily Web<br/>React 19, Vite, TS<br/>Locator + pharmacy dashboard"]
    end
    subgraph railway["Railway"]
        goapi["Pharmacily API<br/>Go, Chi, pgx<br/>REST /api/v1 + expiry cron"]
    end
    patient -->|"Searches stock"| spa
    staff -->|"Manages stock"| spa
    owner -->|"Onboards shops"| spa
    spa -->|"REST /api/v1<br/>HTTPS"| goapi
    subgraph supabase["Hosted Supabase"]
        direction TB
        db[("Postgres + PostGIS<br/>pharmacies, drugs, inventory<br/>RLS-gated access")]
        auth["Auth + Realtime<br/>Magic-link auth<br/>Live inventory channel"]
    end
    spa -->|"Login + live updates<br/>HTTPS / WS"| auth
    spa -->|"Favorites, alerts<br/>PostgREST"| db
    goapi -->|"Reads + writes<br/>service_role"| db
    goapi -->|"Verify JWTs"| auth
    osm["OpenStreetMap<br/>Map tiles"] ~~~ wa["WhatsApp<br/>Chat links"] ~~~ google["Google OAuth<br/>Sign-in"] ~~~ smtp["SMTP<br/>Magic-link mail"]
    spa -->|"Tiles"| osm
    spa -->|"Chat links"| wa
    auth -->|"OAuth"| google
    auth -->|"Magic links"| smtp
```

## Provenance

- Generated 2026-09-17 via [archy-mcp](https://github.com/phxdev1/archy-mcp)
  (cloned to `~/dev/archy-mcp`, built from source).
- Finding: archy's `generate_diagram_from_github` and
  `generate_diagram_from_text` return canned template output that ignores
  their inputs (GitHub run returned a generic "A software system" C4; text
  run returned an "Internet Banking System" diagram for a pharmacy
  description). The boxes and edges above were therefore authored from the
  repo itself — verified against `vercel.json`, `railway.toml`,
  `Dockerfile`, `internal/config/config.go`, `supabase/migrations/` and
  `AGENTS.md` — and rendered with the Mermaid toolchain.
- The AI-powered archy tools (`generate_diagram_from_code`,
  `generate_diagram_from_text_with_ai`) require an `OPENROUTER_API_KEY` and
  were not exercised. If you want archy registered persistently in
  `~/.config/opencode/opencode.json`, say so — otherwise it stays a
  one-shot setup at `~/dev/archy-mcp` (`node build/src/index.js`; note the
  upstream `npm run build` is broken — `tsc` output in `build/src/` is what
  runs).
