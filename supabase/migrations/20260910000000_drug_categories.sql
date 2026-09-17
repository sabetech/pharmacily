-- Drug catalogue categorization (Pharmacily drug seed JSON v1.0.0, 202 drugs)
-- Adds ATC + shopper-friendly category columns to drugs.
-- Does NOT rewrite init schema; additive migration only.

ALTER TABLE drugs
  ADD COLUMN IF NOT EXISTS atc_code TEXT,
  ADD COLUMN IF NOT EXISTS atc_level1 TEXT,
  ADD COLUMN IF NOT EXISTS atc_group TEXT,
  ADD COLUMN IF NOT EXISTS therapeutic_category TEXT,
  ADD COLUMN IF NOT EXISTS shopper_category TEXT,
  ADD COLUMN IF NOT EXISTS rx_otc TEXT,
  ADD COLUMN IF NOT EXISTS ghana_eml BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nhis_covered BOOLEAN DEFAULT false;

-- Constrain ATC L1 to WHO 14 groups + J07 vaccines stored as J
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drugs_atc_level1_check') THEN
    ALTER TABLE drugs ADD CONSTRAINT drugs_atc_level1_check
      CHECK (atc_level1 IS NULL OR atc_level1 IN ('A','B','C','D','G','H','J','L','M','N','P','R','S','V'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drugs_rx_otc_check') THEN
    ALTER TABLE drugs ADD CONSTRAINT drugs_rx_otc_check
      CHECK (rx_otc IS NULL OR rx_otc IN ('Rx','OTC'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_drugs_atc_code ON drugs (atc_code);
CREATE INDEX IF NOT EXISTS idx_drugs_atc_level1 ON drugs (atc_level1);
CREATE INDEX IF NOT EXISTS idx_drugs_therapeutic_category ON drugs (therapeutic_category);
CREATE INDEX IF NOT EXISTS idx_drugs_shopper_category ON drugs (shopper_category);
CREATE INDEX IF NOT EXISTS idx_drugs_rx_otc ON drugs (rx_otc) WHERE rx_otc = 'Rx';

-- Trigram index for category autocomplete (keeps parity with name/generic indexes)
CREATE INDEX IF NOT EXISTS idx_drugs_therapeutic_trgm ON drugs USING GIN (therapeutic_category gin_trgm_ops);
