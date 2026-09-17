-- Mirrors supabase/migrations/20260909170000_drug_catalogue_meta.sql and
-- 20260909150000_stock_take.sql. sqlc builds models from ./sql/schema, so keep
-- this in sync with migrations.

ALTER TABLE drugs ADD COLUMN rx_otc TEXT CHECK (rx_otc IN ('Rx', 'OTC'));
ALTER TABLE drugs ADD COLUMN atc_code TEXT;
ALTER TABLE drugs ADD COLUMN therapeutic_category TEXT;
ALTER TABLE drugs ADD COLUMN shopper_category TEXT;
ALTER TABLE drugs ADD COLUMN nhis_covered BOOLEAN;
ALTER TABLE drugs ADD COLUMN ghana_eml BOOLEAN;

ALTER TABLE inventory ADD CONSTRAINT inventory_quantity_nonnegative CHECK (quantity >= 0);
ALTER TABLE inventory ADD CONSTRAINT inventory_price_nonnegative CHECK (price_cents IS NULL OR price_cents >= 0);

CREATE TABLE stock_take_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    notes TEXT,
    created_by UUID,
    decided_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    decided_at TIMESTAMPTZ
);

CREATE TABLE stock_take_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES stock_take_sessions(id) ON DELETE CASCADE,
    drug_id UUID NOT NULL REFERENCES drugs(id),
    system_qty INTEGER NOT NULL DEFAULT 0,
    counted_qty INTEGER,
    note TEXT,
    UNIQUE (session_id, drug_id)
);
