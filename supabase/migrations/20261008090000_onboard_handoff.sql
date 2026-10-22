-- Onboarding handoff: desktop creates a one-time code, the phone scans the QR,
-- fills the full form (with real GPS), and submits through a SECURITY DEFINER
-- RPC. The phone never signs in — the code is a short-lived bearer capability.
--
-- Decisions locked in:
-- - 16 hex chars (sha256 of a fresh uuid+timestamp, truncated) ≈ 64 bits,
--   core-only functions (gen_random_bytes lives in the `extensions` schema and
--   is invisible under the pinned search_path), 10 minute TTL,
--   single-use via atomic consume, one live code per user.-- - submit_onboard_handoff mints the same claims as bind_my_pharmacy
--   (role=pharmacy_staff, pharmacy_role=pharmacist, pharmacy_id) because the
--   phone has no auth.uid() to call bind_my_pharmacy with.
-- - Table is service/RPC-written only: RLS allows SELECT to the owning user
--   (desktop polls status); anon gets no table access at all.

CREATE TABLE IF NOT EXISTS onboard_handoff (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES pharmacies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_onboard_handoff_user ON onboard_handoff (user_id);

ALTER TABLE onboard_handoff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "onboard_handoff_owner_select" ON onboard_handoff;
CREATE POLICY "onboard_handoff_owner_select" ON onboard_handoff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON onboard_handoff FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON onboard_handoff FROM authenticated;
GRANT SELECT ON onboard_handoff TO authenticated;

-- Desktop: mint a fresh code for the signed-in owner. Invalidates any previous
-- unconsumed code so only one QR is ever live per account.
CREATE OR REPLACE FUNCTION create_onboard_handoff()
RETURNS TEXT AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM onboard_handoff
  WHERE user_id = v_user AND consumed_at IS NULL;

  v_code := substr(
    encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'UTF8')), 'hex'),
    1, 16);
  INSERT INTO onboard_handoff (code, user_id, expires_at)
  VALUES (v_code, v_user, now() + interval '10 minutes');

  RETURN v_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION create_onboard_handoff() FROM PUBLIC;
REVOKE ALL ON FUNCTION create_onboard_handoff() FROM anon;
GRANT EXECUTE ON FUNCTION create_onboard_handoff() TO authenticated;

-- Phone: submit the whole onboarding form against a code. Validates the same
-- rules as the client + DB checks, consumes the code atomically, inserts the
-- owner draft (born invisible), and mints role claims. Rolls back as one unit,
-- so a failed insert leaves the code usable.
CREATE OR REPLACE FUNCTION submit_onboard_handoff(
  p_code TEXT,
  p_name TEXT,
  p_phone TEXT,
  p_address TEXT,
  p_city TEXT,
  p_region TEXT,
  p_digital_address TEXT,
  p_licence_no TEXT,
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION
)
RETURNS UUID AS $$
DECLARE
  v_user UUID;
  v_pharmacy UUID;
  v_name TEXT := trim(coalesce(p_name, ''));
  v_address TEXT := trim(coalesce(p_address, ''));
  v_city TEXT := nullif(trim(coalesce(p_city, '')), '');
  v_digital TEXT := nullif(trim(coalesce(p_digital_address, '')), '');
  v_licence TEXT := nullif(trim(coalesce(p_licence_no, '')), '');
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'enter the name of the pharmacy';
  END IF;
  IF p_phone IS NULL OR p_phone !~ '^\+233\d{9}$' THEN
    RAISE EXCEPTION 'enter a valid Ghana phone number';
  END IF;
  IF v_address = '' THEN
    RAISE EXCEPTION 'enter the location address';
  END IF;
  IF p_region IS NOT NULL AND p_region NOT IN (
    'Ahafo','Ashanti','Bono','Bono East','Central','Eastern',
    'Greater Accra','North East','Northern','Oti','Savannah',
    'Upper East','Upper West','Volta','Western','Western North') THEN
    RAISE EXCEPTION 'select a valid region';
  END IF;
  IF p_lat IS NULL OR p_lat NOT BETWEEN -90 AND 90
     OR p_lng IS NULL OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'add valid GPS coordinates';
  END IF;
  IF p_code IS NULL OR length(p_code) <> 16 THEN
    RAISE EXCEPTION 'handoff code is invalid or expired';
  END IF;

  UPDATE onboard_handoff
  SET consumed_at = now()
  WHERE code = p_code
    AND consumed_at IS NULL
    AND expires_at > now()
  RETURNING user_id INTO v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'handoff code is invalid or expired';
  END IF;

  INSERT INTO pharmacies (
    owner_user_id, name, address, city, state, region,
    digital_address, licence_no, latitude, longitude, phone,
    verified, visible_to_public
  ) VALUES (
    v_user, v_name, v_address, v_city, p_region, p_region,
    v_digital, v_licence, p_lat, p_lng, p_phone,
    false, false
  )
  RETURNING id INTO v_pharmacy;

  UPDATE onboard_handoff SET pharmacy_id = v_pharmacy WHERE code = p_code;

  -- Mirror bind_my_pharmacy: the phone session carries no auth.uid() claims.
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'role', 'pharmacy_staff',
      'pharmacy_role', 'pharmacist',
      'pharmacy_id', v_pharmacy::text)
  WHERE id = v_user;

  RETURN v_pharmacy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION submit_onboard_handoff(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_onboard_handoff(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
