-- Catalogue metadata for the Ghana EML drug list. Idempotent: safe to re-apply.
-- Existing rows keep NULL (unknown) for the new columns.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drugs' AND column_name = 'rx_otc') THEN
    ALTER TABLE drugs ADD COLUMN rx_otc TEXT CHECK (rx_otc IN ('Rx', 'OTC'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drugs' AND column_name = 'atc_code') THEN
    ALTER TABLE drugs ADD COLUMN atc_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drugs' AND column_name = 'therapeutic_category') THEN
    ALTER TABLE drugs ADD COLUMN therapeutic_category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drugs' AND column_name = 'shopper_category') THEN
    ALTER TABLE drugs ADD COLUMN shopper_category TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drugs' AND column_name = 'nhis_covered') THEN
    ALTER TABLE drugs ADD COLUMN nhis_covered BOOLEAN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'drugs' AND column_name = 'ghana_eml') THEN
    ALTER TABLE drugs ADD COLUMN ghana_eml BOOLEAN;
  END IF;
END
$$;
