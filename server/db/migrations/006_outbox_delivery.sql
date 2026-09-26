-- ============================================================================
-- Migration 006: Per-Channel Outbox Delivery State and Unconfigured Channel Safety
-- Product: LazyProof / LAZY (https://lazyproof.online)
-- Operating Entity: ADABHRA GROUP (Proprietor: Raja Babu)
-- ============================================================================

-- 1. Expand operational_outbox delivery_status constraint to support unconfigured states
ALTER TABLE operational_outbox DROP CONSTRAINT IF EXISTS operational_outbox_delivery_status_check;
ALTER TABLE operational_outbox ADD CONSTRAINT operational_outbox_delivery_status_check
  CHECK (delivery_status IN ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'EXHAUSTED', 'SKIPPED_NO_CHANNELS', 'WAITING_CONFIG'));

-- 2. Create outbox_channel_deliveries table for durable per-channel delivery tracking
CREATE TABLE IF NOT EXISTS outbox_channel_deliveries (
  id VARCHAR(64) PRIMARY KEY,
  outbox_id VARCHAR(64) NOT NULL REFERENCES operational_outbox(id) ON DELETE CASCADE,
  channel VARCHAR(30) NOT NULL CHECK (channel IN ('telegram', 'discord')),
  delivery_status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (delivery_status IN ('PENDING', 'DELIVERED', 'FAILED', 'EXHAUSTED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_outbox_channel UNIQUE (outbox_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_outbox_channel_status ON outbox_channel_deliveries (channel, delivery_status);

-- 3. Record migration in schema_migrations
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('006_outbox_delivery', 'Per-channel outbox delivery state tracking and skipped-channel handling', NOW())
ON CONFLICT (version) DO NOTHING;
