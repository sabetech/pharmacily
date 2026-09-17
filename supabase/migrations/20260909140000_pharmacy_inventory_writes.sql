-- Pharmacy staff direct inventory writes (powers the locator in realtime).
-- Idempotent: safe to re-apply.

-- Sanity constraints (seed data already satisfies these)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_quantity_nonnegative') THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_quantity_nonnegative CHECK (quantity >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_price_nonnegative') THEN
    ALTER TABLE inventory ADD CONSTRAINT inventory_price_nonnegative CHECK (price_cents IS NULL OR price_cents >= 0);
  END IF;
END
$$;

-- Staff can insert rows for their own pharmacy only
DROP POLICY IF EXISTS "inventory_staff_insert" ON inventory;
CREATE POLICY "inventory_staff_insert" ON inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
  );

-- Staff can update rows for their own pharmacy only (pharmacy_id immutable)
DROP POLICY IF EXISTS "inventory_staff_update" ON inventory;
CREATE POLICY "inventory_staff_update" ON inventory
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
  );

GRANT INSERT, UPDATE ON inventory TO authenticated;
