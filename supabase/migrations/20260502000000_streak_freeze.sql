-- Streak freeze: array of ISO date strings the user has "frozen" (treated as workout days)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_freeze_dates JSONB NOT NULL DEFAULT '[]'::jsonb;
