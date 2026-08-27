-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Custom types
CREATE TYPE sync_status AS ENUM ('success', 'partial', 'failed', 'pending');
CREATE TYPE inventory_source AS ENUM ('api', 'manual', 'webhook', 'csv');

-- Tables
CREATE TABLE pharmacy_chains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    api_type TEXT NOT NULL,
    base_endpoint TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

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
    hours JSONB,
    chain_id UUID REFERENCES pharmacy_chains(id),
    api_credentials_encrypted TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    generic_name TEXT NOT NULL,
    ndc_code TEXT UNIQUE NOT NULL,
    strength TEXT,
    form TEXT,
    manufacturer TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    price_cents INTEGER,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    source inventory_source NOT NULL DEFAULT 'manual',
    UNIQUE (pharmacy_id, drug_id)
);

CREATE TABLE user_favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    drug_id UUID NOT NULL REFERENCES drugs(id) ON DELETE CASCADE,
    pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
    notify_on_stock BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE pharmacy_api_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    api_type TEXT NOT NULL,
    endpoint TEXT,
    credentials_ref TEXT,
    sync_schedule TEXT,
    last_sync_at TIMESTAMPTZ,
    last_sync_status sync_status,
    is_enabled BOOLEAN DEFAULT true
);

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

CREATE TABLE geocode_cache (
    address_hash TEXT PRIMARY KEY,
    address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
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
CREATE INDEX idx_sync_retry_queue_next_retry ON sync_retry_queue (next_retry_at) WHERE next_retry_at <= now();
CREATE INDEX idx_geocode_cache_created ON geocode_cache (created_at);

-- Updated_at trigger
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

-- Seed data
INSERT INTO pharmacy_chains (name, api_type) VALUES
    ('CVS', 'custom'),
    ('Walgreens', 'custom'),
    ('Walmart', 'custom'),
    ('Rite Aid', 'custom'),
    ('Independent', 'csv')
ON CONFLICT (name) DO NOTHING;