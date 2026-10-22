-- Mirrors supabase/migrations/20261022120000_sales.sql. sqlc builds models
-- from ./sql/schema, so keep this in sync with migrations. RLS/grants live
-- only in the Supabase migration.

-- Stub of Supabase-managed auth.users: sqlc only needs it to typecheck the
-- receipt join; the real table lives in the auth schema on Supabase and is
-- never created by an API migration.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email TEXT
);

CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
    served_by UUID NOT NULL,
    approved_by UUID,
    total_pesewas INTEGER NOT NULL CHECK (total_pesewas >= 0),
    amount_tendered_pesewas INTEGER CHECK (amount_tendered_pesewas IS NULL OR amount_tendered_pesewas >= total_pesewas),
    method TEXT NOT NULL CHECK (method IN ('cash', 'momo')),
    rx_confirmed BOOLEAN NOT NULL DEFAULT false,
    rx_prescriber TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sales_rx_prescriber_when_confirmed CHECK (
        NOT rx_confirmed OR rx_prescriber IS NOT NULL
    )
);

CREATE TABLE sale_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    inventory_id UUID NOT NULL REFERENCES inventory(id),
    drug_id UUID NOT NULL REFERENCES drugs(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_pesewas INTEGER NOT NULL CHECK (unit_price_pesewas > 0),
    line_total_pesewas INTEGER NOT NULL CHECK (line_total_pesewas >= 0),
    is_rx BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventory(id),
    delta INTEGER NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('sale', 'stock_take', 'adjust')),
    sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
    actor UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
