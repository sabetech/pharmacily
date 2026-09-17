-- Fix pre-existing staff policies: app metadata claims live nested under
-- `app_metadata` in the JWT, so `auth.jwt() ->> 'role'` (top level, always
-- 'authenticated') never matched. Idempotent: safe to re-apply.

DROP POLICY IF EXISTS "pharmacy_api_configs_staff_select" ON pharmacy_api_configs;
CREATE POLICY "pharmacy_api_configs_staff_select" ON pharmacy_api_configs
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
  );

DROP POLICY IF EXISTS "pharmacy_api_configs_staff_update" ON pharmacy_api_configs;
CREATE POLICY "pharmacy_api_configs_staff_update" ON pharmacy_api_configs
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
  );

GRANT SELECT, UPDATE ON pharmacy_api_configs TO authenticated;
