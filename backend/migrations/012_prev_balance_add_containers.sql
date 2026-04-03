-- Migration 012: Add 용기 and 마개 entries to prev_balance
-- These were missing from the initial seed, required for inventory summary/history APIs

INSERT INTO prev_balance (category, amount)
VALUES
  ('용기', 0),
  ('마개', 0)
ON CONFLICT (category) DO NOTHING;
