-- Migration 004: Performance indexes for Today leaderboard and IST daily activity
-- Allows bounded, index-backed range scans on rank_ledger by created_at for IST day window
CREATE INDEX IF NOT EXISTS idx_rank_ledger_created_at ON rank_ledger (created_at);
CREATE INDEX IF NOT EXISTS idx_rank_ledger_settled_credits ON rank_ledger (created_at) WHERE type = 'CREDIT' AND status = 'SETTLED';

-- Record migration in schema_migrations
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('004_today_leaderboard', 'Performance indexes for Today leaderboard and IST daily activity', NOW())
ON CONFLICT (version) DO NOTHING;
