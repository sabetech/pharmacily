-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- cube + earthdistance power ll_to_earth() used by idx_pharmacies_location.
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Custom roles referenced by RLS policies + grants below.
-- (No roles.sql in repo defines them, so bootstrap here, idempotently.)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'api_service') THEN
    CREATE ROLE api_service NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_client') THEN
    CREATE ROLE web_client NOLOGIN;
  END IF;
END $$;

-- Create custom types
CREATE TYPE sync_status AS ENUM ('success', 'partial', 'failed', 'pending');
CREATE TYPE inventory_source AS ENUM ('api', 'manual', 'webhook', 'csv');

-- Pharmacy chains (CVS, Walgreens, etc.)
CREATE TABLE pharmacy_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    api_type TEXT NOT NULL, -- 'ncpdpp', 'custom', 'surescripts', 'csv'
    base_endpoint TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pharmacies (national scale: ~50k rows)
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    zip_code TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    phone TEXT,
    hours JSONB, -- {mon: "9-21", tue: "9-21", ...}
    chain_id UUID REFERENCES pharmacy_chains(id),
    api_credentials_encrypted TEXT, -- Supabase Vault reference
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Drugs (national: ~200k NDC codes)
CREATE TABLE drugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- brand name
    generic_name TEXT NOT NULL,
    ndc_code TEXT UNIQUE NOT NULL, -- National Drug Code (11-digit)
    strength TEXT, -- "10mg"
    form TEXT, -- "tablet", "capsule", "liquid"
    manufacturer TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Inventory (high churn: millions of rows over time)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    price_cents INTEGER, -- nullable if unknown
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    source inventory_source NOT NULL DEFAULT 'manual',
    UNIQUE (pharmacy_id, drug_id)
);

-- User favorites & stock alerts
CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL, -- null = any pharmacy
    notify_on_stock BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Pharmacy API configurations (per-pharmacy override of chain defaults)
CREATE TABLE pharmacy_api_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    api_type TEXT NOT NULL,
    endpoint TEXT,
    credentials_ref TEXT, -- Supabase Vault key
    sync_schedule TEXT, -- cron expression
    last_sync_at TIMESTAMPTZ,
    last_sync_status sync_status,
    is_enabled BOOLEAN DEFAULT true
);

-- Sync retry queue for failed syncs
CREATE TABLE sync_retry_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    drug_id UUID REFERENCES drugs(id) ON DELETE SET NULL,
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Geocode cache for address -> lat/lng
CREATE TABLE geocode_cache (
    address_hash TEXT PRIMARY KEY, -- SHA256 of normalized address
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX idx_inventory_drug_pharmacy ON inventory (drug_id, pharmacy_id);
CREATE INDEX idx_inventory_quantity ON inventory (quantity) WHERE quantity > 0;
CREATE INDEX idx_inventory_updated ON inventory (last_updated DESC);
CREATE INDEX idx_pharmacies_location ON pharmacies USING GIST (ll_to_earth(latitude, longitude));
CREATE INDEX idx_pharmacies_chain ON pharmacies (chain_id);
CREATE INDEX idx_pharmacies_active ON pharmacies (is_active) WHERE is_active = true;
CREATE INDEX idx_drugs_name_trgm ON drugs USING GIN (name gin_trgm_ops);
CREATE INDEX idx_drugs_generic_trgm ON drugs USING GIN (generic_name gin_trgm_ops);
CREATE INDEX idx_drugs_ndc ON drugs (ndc_code);
CREATE INDEX idx_user_favorites_user ON user_favorites (user_id);
CREATE INDEX idx_user_favorites_drug ON user_favorites (drug_id);
CREATE INDEX idx_pharmacy_api_configs_pharmacy ON pharmacy_api_configs (pharmacy_id);
CREATE INDEX idx_sync_retry_queue_next_retry ON sync_retry_queue (next_retry_at);
CREATE INDEX idx_geocode_cache_created ON geocode_cache (created_at);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_pharmacies_updated_at
    BEFORE UPDATE ON pharmacies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE pharmacy_chains ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacy_api_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_retry_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE geocode_cache ENABLE ROW LEVEL SECURITY;

-- Create roles for different access levels
-- These will be granted to Supabase Auth authenticated users via JWT claims
-- api_service role: Go API service (full write access)
-- web_client role: React frontend (read access)
-- pharmacy_staff role: Pharmacy dashboard users (scoped to their pharmacy)

-- RLS Policies

-- Pharmacy chains: public read, api_service write
CREATE POLICY "pharmacy_chains_public_read" ON pharmacy_chains
    FOR SELECT USING (true);

CREATE POLICY "pharmacy_chains_api_write" ON pharmacy_chains
    FOR ALL TO api_service USING (true);

-- Pharmacies: public read (for search), api_service write
CREATE POLICY "pharmacies_public_read" ON pharmacies
    FOR SELECT USING (true);

CREATE POLICY "pharmacies_api_write" ON pharmacies
    FOR ALL TO api_service USING (true);

-- Drugs: public read (for autocomplete/search)
CREATE POLICY "drugs_public_read" ON drugs
    FOR SELECT USING (true);

CREATE POLICY "drugs_api_write" ON drugs
    FOR ALL TO api_service USING (true);

-- Inventory: public read (for search results), api_service write
CREATE POLICY "inventory_public_read" ON inventory
    FOR SELECT USING (true);

CREATE POLICY "inventory_api_write" ON inventory
    FOR ALL TO api_service USING (true);

-- User favorites: user owns their rows
CREATE POLICY "user_favorites_own_select" ON user_favorites
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_favorites_own_insert" ON user_favorites
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_favorites_own_update" ON user_favorites
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_favorites_own_delete" ON user_favorites
    FOR DELETE USING (auth.uid() = user_id);

-- Pharmacy API configs: pharmacy staff only (via custom JWT claim)
CREATE POLICY "pharmacy_api_configs_staff_select" ON pharmacy_api_configs
    FOR SELECT USING (
        (auth.jwt() ->> 'role') = 'pharmacy_staff'
        AND (auth.jwt() ->> 'pharmacy_id') = pharmacy_id::text
    );

CREATE POLICY "pharmacy_api_configs_staff_update" ON pharmacy_api_configs
    FOR UPDATE USING (
        (auth.jwt() ->> 'role') = 'pharmacy_staff'
        AND (auth.jwt() ->> 'pharmacy_id') = pharmacy_id::text
    );

CREATE POLICY "pharmacy_api_configs_api_write" ON pharmacy_api_configs
    FOR ALL TO api_service USING (true);

-- Sync retry queue: api_service only
CREATE POLICY "sync_retry_queue_api" ON sync_retry_queue
    FOR ALL TO api_service USING (true);

-- Geocode cache: public read, api_service write
CREATE POLICY "geocode_cache_public_read" ON geocode_cache
    FOR SELECT USING (true);

CREATE POLICY "geocode_cache_api_write" ON geocode_cache
    FOR ALL TO api_service USING (true);

-- Seed initial pharmacy chains
INSERT INTO pharmacy_chains (name, api_type) VALUES
    ('CVS', 'custom'),
    ('Walgreens', 'custom'),
    ('Walmart', 'custom'),
    ('Rite Aid', 'custom'),
    ('Independent', 'csv')
ON CONFLICT (name) DO NOTHING;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO api_service, web_client, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO api_service;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO web_client;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_favorites TO authenticated;