-- ============================================================
-- Migration 002: Normalize plan names for cross-tier compatibility
-- The app layer uses: starter, business, enterprise
-- The original cloud schema used: standard, pro, enterprise
-- This migration adds a CHECK constraint that accepts both sets and
-- updates any existing 'standard' → 'starter', 'pro' → 'business'.
-- ============================================================

-- Normalize existing plan values to the canonical set
UPDATE license_keys
SET plan = CASE plan
    WHEN 'standard' THEN 'starter'
    WHEN 'pro'      THEN 'business'
    ELSE plan
END
WHERE plan IN ('standard', 'pro');

-- Add CHECK constraint (Postgres)
-- Using ALTER TABLE ... ADD CONSTRAINT (safe to re-run — IF NOT EXISTS not supported
-- on CHECK, so wrap in a DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'chk_license_keys_plan'
          AND table_name = 'license_keys'
    ) THEN
        ALTER TABLE license_keys
            ADD CONSTRAINT chk_license_keys_plan
            CHECK (plan IN ('starter', 'business', 'enterprise'));
    END IF;
END
$$;
