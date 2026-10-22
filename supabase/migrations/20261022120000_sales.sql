-- Sales posting: the Go API writes sales/sale_lines/stock_ledger in one
-- transaction (decrement inventory + ledger + sale header/lines). Tables are
-- API-written only — RLS denies anon/authenticated entirely; the web reads
-- sales back through authenticated GET endpoints.
--
-- Decisions locked in:
-- - Totals recomputed server-side from inventory.price_cents; client math is
--   display-only. unit_price_pesewas is snapshotted at sale time.
-- - Rx gating: any sale containing a line whose drug.rx_otc='Rx' must arrive
--   with rx_confirmed=true, rx_prescriber set, and a pharmacist caller —
--   approved_by records who approved (receipt prints it).
-- - stock_ledger reasons: 'sale' now; 'stock_take'/'adjust' reserved for the
--   stock-take approve path and future adjust endpoint.

CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  served_by UUID NOT NULL REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
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

CREATE INDEX idx_sales_pharmacy_created ON sales (pharmacy_id, created_at DESC);

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

CREATE INDEX idx_sale_lines_sale ON sale_lines (sale_id);

CREATE TABLE stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id UUID NOT NULL REFERENCES inventory(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'stock_take', 'adjust')),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  actor UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_ledger_inventory_created ON stock_ledger (inventory_id, created_at DESC);

-- API-written only: the Go service connects as the pooler superuser and does
-- its own pharmacy-scoping; browsers never touch these tables directly.
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON sales FROM anon, authenticated;
REVOKE ALL ON sale_lines FROM anon, authenticated;
REVOKE ALL ON stock_ledger FROM anon, authenticated;
