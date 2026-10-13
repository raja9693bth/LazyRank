-- ============================================================================
-- Migration 008: Dodo Payments Provider Support & Checkout URL Persistence
-- Additive migration for Dodo Payments checkout session url persistence.
-- ============================================================================

-- 1. Add checkout_url column to payment_orders if not present
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS checkout_url TEXT;

-- 2. Record migration in schema_migrations
INSERT INTO schema_migrations (version, applied_at, description)
VALUES ('008_dodo_payments', NOW(), 'Dodo Payments provider support and checkout URL persistence')
ON CONFLICT (version) DO NOTHING;
