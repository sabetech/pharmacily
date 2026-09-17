-- Stock take (count-and-reconcile) sessions. Idempotent: safe to re-apply.
--
-- Lifecycle: draft (counting) -> submitted (pending approval) -> approved (posted) | rejected.
-- Staff: create sessions, enter counts, submit. Pharmacist: review, approve/reject.
-- Approval posts counted quantities to inventory (client writes via inventory_staff_update).

CREATE TABLE IF NOT EXISTS stock_take_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pharmacy_id UUID NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  decided_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stock_take_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES stock_take_sessions(id) ON DELETE CASCADE,
  drug_id UUID NOT NULL REFERENCES drugs(id),
  system_qty INTEGER NOT NULL DEFAULT 0,
  counted_qty INTEGER,
  note TEXT,
  UNIQUE (session_id, drug_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_take_sessions_pharmacy ON stock_take_sessions (pharmacy_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_take_lines_session ON stock_take_lines (session_id);

ALTER TABLE stock_take_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_lines ENABLE ROW LEVEL SECURITY;

-- Sessions: staff read own pharmacy's sessions
DROP POLICY IF EXISTS "stock_take_sessions_staff_select" ON stock_take_sessions;
CREATE POLICY "stock_take_sessions_staff_select" ON stock_take_sessions
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
  );

-- Sessions: staff create drafts for own pharmacy
DROP POLICY IF EXISTS "stock_take_sessions_staff_insert" ON stock_take_sessions;
CREATE POLICY "stock_take_sessions_staff_insert" ON stock_take_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    AND status = 'draft'
  );

-- Sessions: staff count + submit own drafts (draft <-> submitted only)
DROP POLICY IF EXISTS "stock_take_sessions_staff_update" ON stock_take_sessions;
CREATE POLICY "stock_take_sessions_staff_update" ON stock_take_sessions
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    AND status = 'draft'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    AND status IN ('draft', 'submitted')
  );

-- Sessions: pharmacist approves / rejects submitted sessions
DROP POLICY IF EXISTS "stock_take_sessions_pharmacist_decide" ON stock_take_sessions;
CREATE POLICY "stock_take_sessions_pharmacist_decide" ON stock_take_sessions
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_role') = 'pharmacist'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    AND status = 'submitted'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_role') = 'pharmacist'
    AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    AND status IN ('approved', 'rejected')
  );

-- Lines: staff read lines of own pharmacy's sessions
DROP POLICY IF EXISTS "stock_take_lines_staff_select" ON stock_take_lines;
CREATE POLICY "stock_take_lines_staff_select" ON stock_take_lines
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND session_id IN (
      SELECT id FROM stock_take_sessions
      WHERE (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    )
  );

-- Lines: staff write lines while the session is a draft of own pharmacy
DROP POLICY IF EXISTS "stock_take_lines_staff_insert" ON stock_take_lines;
CREATE POLICY "stock_take_lines_staff_insert" ON stock_take_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND session_id IN (
      SELECT id FROM stock_take_sessions
      WHERE status = 'draft'
        AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    )
  );

DROP POLICY IF EXISTS "stock_take_lines_staff_update" ON stock_take_lines;
CREATE POLICY "stock_take_lines_staff_update" ON stock_take_lines
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'pharmacy_staff'
    AND session_id IN (
      SELECT id FROM stock_take_sessions
      WHERE status = 'draft'
        AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM stock_take_sessions
      WHERE status = 'draft'
        AND (auth.jwt() -> 'app_metadata' ->> 'pharmacy_id') = pharmacy_id::text
    )
  );

GRANT SELECT, INSERT, UPDATE ON stock_take_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON stock_take_lines TO authenticated;
