-- Pharmacy ownership + owner onboarding foundations. Idempotent: safe to re-apply.
-- Does NOT rewrite init schema; additive migration only.
--
-- Decisions locked in:
-- - One owner can have MULTIPLE shops (no UNIQUE on owner_user_id).
-- - licence_no optional until the verification issue (nullable, never gates visibility here).
-- - city/state/zip relaxed to nullable + region (fixed 16) + digital_address added.
-- - Highest-privilege default (pharmacist, pharmacy_id null) mints ONLY from the
--   user_metadata.signup_flow = 'pharmacy_owner' client hint, via trigger below.
--   The trigger is created but left DETACHED until verification passes; attach last.
-- - Last-bound-wins: bind_my_pharmacy() overwrites app_metadata.pharmacy_id,
--   so multi-shop owners land in the newest shop until the shop-picker lands.

-- 1. Columns ---------------------------------------------------------------
ALTER TABLE pharmacies
  ADD COLUMN IF NOT EXISTS owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS licence_no TEXT,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visible_to_public BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS digital_address TEXT,
  ADD COLUMN IF NOT EXISTS geo GEOGRAPHY(Point, 4326);

ALTER TABLE pharmacies ALTER COLUMN city DROP NOT NULL;
ALTER TABLE pharmacies ALTER COLUMN state DROP NOT NULL;
ALTER TABLE pharmacies ALTER COLUMN zip_code DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacies_region_check') THEN
    ALTER TABLE pharmacies ADD CONSTRAINT pharmacies_region_check
      CHECK (region IS NULL OR region IN (
        'Ahafo','Ashanti','Bono','Bono East','Central','Eastern',
        'Greater Accra','North East','Northern','Oti','Savannah',
        'Upper East','Upper West','Volta','Western','Western North'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacies_phone_gh_check') THEN
    ALTER TABLE pharmacies ADD CONSTRAINT pharmacies_phone_gh_check
      CHECK (phone IS NULL OR phone ~ '^\+233\d{9}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacies_lat_check') THEN
    ALTER TABLE pharmacies ADD CONSTRAINT pharmacies_lat_check
      CHECK (latitude BETWEEN -90 AND 90);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pharmacies_lng_check') THEN
    ALTER TABLE pharmacies ADD CONSTRAINT pharmacies_lng_check
      CHECK (longitude BETWEEN -180 AND 180);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pharmacies_owner ON pharmacies (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_pharmacies_geo ON pharmacies USING GIST (geo);
CREATE INDEX IF NOT EXISTS idx_pharmacies_locator ON pharmacies (verified, visible_to_public)
  WHERE verified = true AND visible_to_public = true;

-- Backfill geo from lat/lng where present.
UPDATE pharmacies
SET geo = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
WHERE geo IS NULL;

-- Keep geo in sync on write.
CREATE OR REPLACE FUNCTION pharmacies_sync_geo()
RETURNS TRIGGER AS $$
BEGIN
  NEW.geo := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pharmacies_sync_geo_trigger ON pharmacies;
CREATE TRIGGER pharmacies_sync_geo_trigger
  BEFORE INSERT OR UPDATE OF latitude, longitude ON pharmacies
  FOR EACH ROW EXECUTE FUNCTION pharmacies_sync_geo();

-- 2. RLS: public reads see verified + visible only --------------------------
DROP POLICY IF EXISTS "pharmacies_public_read" ON pharmacies;
CREATE POLICY "pharmacies_public_read" ON pharmacies
  FOR SELECT TO anon, authenticated
  USING (verified = true AND visible_to_public = true);

-- Owner drafts: insert own row, born invisible.
DROP POLICY IF EXISTS "pharmacies_owner_insert" ON pharmacies;
CREATE POLICY "pharmacies_owner_insert" ON pharmacies
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    AND verified = false
    AND visible_to_public = false
  );

-- Owner reads own drafts (verified rows already readable via public policy).
DROP POLICY IF EXISTS "pharmacies_owner_select" ON pharmacies;
CREATE POLICY "pharmacies_owner_select" ON pharmacies
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- Owner edits own drafts; can never self-publish or reassign.
-- Role + owner test in BOTH clauses (RLS OR-composes policies across clauses).
DROP POLICY IF EXISTS "pharmacies_owner_update" ON pharmacies;
CREATE POLICY "pharmacies_owner_update" ON pharmacies
  FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (
    owner_user_id = auth.uid()
    AND verified = false
    AND visible_to_public = false
  );

GRANT SELECT, INSERT, UPDATE ON pharmacies TO authenticated;

-- 3. Routines ---------------------------------------------------------------
-- Mint highest-privilege default (pharmacist, no pharmacy) ONLY from the
-- user_metadata.signup_flow = 'pharmacy_owner' client hint. Locator signups
-- (no hint) are left claim-free. Merges metadata, never overwrites.
CREATE OR REPLACE FUNCTION handle_new_pharmacy_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(NEW.raw_user_meta_data ->> 'signup_flow', '') = 'pharmacy_owner' THEN
    NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb)
      || '{"role": "pharmacy_staff", "pharmacy_role": "pharmacist"}'::jsonb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION handle_new_pharmacy_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION handle_new_pharmacy_owner() FROM anon, authenticated;

-- NOTE: trigger intentionally NOT attached here. Attach only after this
-- migration verifies green (see verification plan), e.g.:
--   CREATE TRIGGER handle_new_pharmacy_owner_trigger
--     BEFORE INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION handle_new_pharmacy_owner();

-- Bind caller to one of their shops. Last-bound-wins (multi-shop owners land
-- in the newest shop until the shop-picker lands). Only bind path: there is
-- no direct client UPDATE of owner_user_id that can hijack another row.
CREATE OR REPLACE FUNCTION bind_my_pharmacy(p_pharmacy_id UUID)
RETURNS UUID AS $$
DECLARE
  v_owner UUID;
BEGIN
  SELECT owner_user_id INTO v_owner
  FROM pharmacies WHERE id = p_pharmacy_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pharmacy not found';
  END IF;
  IF v_owner IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not your pharmacy';
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'pharmacy_staff', 'pharmacy_role', 'pharmacist', 'pharmacy_id', p_pharmacy_id::text)
  WHERE id = auth.uid();

  RETURN p_pharmacy_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION bind_my_pharmacy(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION bind_my_pharmacy(UUID) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION bind_my_pharmacy(UUID) TO authenticated;
