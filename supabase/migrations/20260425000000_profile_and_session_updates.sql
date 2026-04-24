-- ─────────────────────────────────────────────────────────────────────────────
-- BodMax — new profile columns (unit, weight) and session photo support
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PROFILES: weight unit preference and bodyweight ───────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS unit    TEXT    DEFAULT 'lbs',
  ADD COLUMN IF NOT EXISTS weight  NUMERIC;

-- ── 2. SESSIONS: optional post-session photo ──────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
