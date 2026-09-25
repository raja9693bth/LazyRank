-- 003_final_polish.sql
-- Idempotent final polish migration:
-- 1. Standardize reports status check to ('pending', 'reviewed', 'dismissed', 'actioned')
-- 2. Normalize legacy 'resolved' status to 'actioned'
-- 3. Ensure merchant_refund_id exists on refund_reversals and has unique partial index
-- 4. Record 003_final_polish in schema_migrations

BEGIN;

-- Preflight check on reports statuses: if any unexpected statuses exist, abort
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reports
    WHERE status NOT IN ('pending', 'reviewed', 'dismissed', 'actioned', 'resolved')
  ) THEN
    RAISE EXCEPTION 'Unexpected reports status found before migration 003';
  END IF;
END $$;

-- Normalize any documented legacy 'resolved' status to canonical 'actioned'
UPDATE reports SET status = 'actioned' WHERE status = 'resolved';

-- Ensure reports check constraint is enforced
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE reports ADD CONSTRAINT reports_status_check CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned'));

-- Ensure merchant_refund_id column and unique partial index exist on refund_reversals
ALTER TABLE refund_reversals ADD COLUMN IF NOT EXISTS merchant_refund_id varchar(128);
CREATE UNIQUE INDEX IF NOT EXISTS refund_reversals_merchant_refund_id_unique
  ON refund_reversals(merchant_refund_id)
  WHERE merchant_refund_id IS NOT NULL;

-- Ensure roast column exists on profiles table for durable storage
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS roast TEXT;

-- Record migration in schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version varchar(64) PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  description text
);

INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('003_final_polish', NOW(), 'Final polish: standardized reports.status to actioned, guaranteed merchant_refund_id on refund_reversals')
ON CONFLICT (version) DO NOTHING;

COMMIT;
