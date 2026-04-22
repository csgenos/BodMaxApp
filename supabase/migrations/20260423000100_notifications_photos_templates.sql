-- ─────────────────────────────────────────────────────────────────────────────
-- BodMax — notifications, progress photos, workout templates, RLS hardening
-- Apply in Supabase SQL Editor or via supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PROFILES: add last_active ─────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- ── 2. PUSH SUBSCRIPTIONS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint  TEXT        NOT NULL UNIQUE,
  p256dh    TEXT        NOT NULL,
  auth      TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. WORKOUT TEMPLATES ─────────────────────────────────────────────────────
-- exercises column stores [{name, muscleGroup}, ...]
CREATE TABLE IF NOT EXISTS templates (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name      TEXT        NOT NULL,
  exercises JSONB       NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. PROGRESS PHOTOS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress_photos (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date      DATE        NOT NULL,
  photo_url TEXT        NOT NULL,
  weight    NUMERIC,
  notes     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 5. ENABLE RLS ON ALL TABLES ──────────────────────────────────────────────
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sets             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cardio           ENABLE ROW LEVEL SECURITY;
ALTER TABLE diet_entries     ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates        ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_photos  ENABLE ROW LEVEL SECURITY;

-- ── 6. DROP OLD CATCH-ALL POLICIES (if any) ──────────────────────────────────
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ── 7. PROFILES ──────────────────────────────────────────────────────────────
-- Anyone can read (needed for username search, friend display)
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (auth.uid() = id);

-- ── 8. SESSIONS ──────────────────────────────────────────────────────────────
-- Owner can do everything; accepted friends can SELECT completed sessions only
CREATE POLICY "sessions_owner"   ON sessions FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "sessions_friends" ON sessions FOR SELECT USING (
  completed_at IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.status = 'accepted'
      AND ((f.user_id = auth.uid() AND f.friend_id = sessions.user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = sessions.user_id))
  )
);

-- ── 9. EXERCISES ─────────────────────────────────────────────────────────────
CREATE POLICY "exercises_owner" ON exercises FOR ALL USING (
  EXISTS (SELECT 1 FROM sessions s WHERE s.id = exercises.session_id AND s.user_id = auth.uid())
);
CREATE POLICY "exercises_friends" ON exercises FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sessions s WHERE s.id = exercises.session_id AND s.completed_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM friendships f WHERE f.status = 'accepted'
          AND ((f.user_id = auth.uid() AND f.friend_id = s.user_id)
            OR (f.friend_id = auth.uid() AND f.user_id = s.user_id))
      )
  )
);

-- ── 10. SETS ─────────────────────────────────────────────────────────────────
CREATE POLICY "sets_owner" ON sets FOR ALL USING (
  EXISTS (
    SELECT 1 FROM exercises e JOIN sessions s ON s.id = e.session_id
    WHERE e.id = sets.exercise_id AND s.user_id = auth.uid()
  )
);
CREATE POLICY "sets_friends" ON sets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM exercises e JOIN sessions s ON s.id = e.session_id
    WHERE e.id = sets.exercise_id AND s.completed_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM friendships f WHERE f.status = 'accepted'
          AND ((f.user_id = auth.uid() AND f.friend_id = s.user_id)
            OR (f.friend_id = auth.uid() AND f.user_id = s.user_id))
      )
  )
);

-- ── 11. CARDIO ───────────────────────────────────────────────────────────────
CREATE POLICY "cardio_owner" ON cardio FOR ALL USING (
  EXISTS (SELECT 1 FROM sessions s WHERE s.id = cardio.session_id AND s.user_id = auth.uid())
);
CREATE POLICY "cardio_friends" ON cardio FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sessions s WHERE s.id = cardio.session_id AND s.completed_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM friendships f WHERE f.status = 'accepted'
          AND ((f.user_id = auth.uid() AND f.friend_id = s.user_id)
            OR (f.friend_id = auth.uid() AND f.user_id = s.user_id))
      )
  )
);

-- ── 12. PERSONAL RECORDS ─────────────────────────────────────────────────────
-- Owner manages; friends can read (for the PR view on the Social page)
CREATE POLICY "prs_owner"   ON personal_records FOR ALL    USING (auth.uid() = user_id);
CREATE POLICY "prs_friends" ON personal_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM friendships f WHERE f.status = 'accepted'
      AND ((f.user_id = auth.uid() AND f.friend_id = personal_records.user_id)
        OR (f.friend_id = auth.uid() AND f.user_id = personal_records.user_id))
  )
);

-- ── 13. FRIENDSHIPS ──────────────────────────────────────────────────────────
CREATE POLICY "friendships_all" ON friendships FOR ALL
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ── 14. DIET / WEIGHT / PRIVATE TABLES ───────────────────────────────────────
CREATE POLICY "diet_owner"   ON diet_entries     FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "weight_owner" ON weight_log       FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "push_owner"   ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "tmpl_owner"   ON templates        FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "photo_owner"  ON progress_photos  FOR ALL USING (auth.uid() = user_id);

-- ── 15. STORAGE BUCKET: progress-photos ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('progress-photos', 'progress-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: files are stored under {user_id}/{filename}
DROP POLICY IF EXISTS "photos_upload"  ON storage.objects;
DROP POLICY IF EXISTS "photos_select"  ON storage.objects;
DROP POLICY IF EXISTS "photos_delete"  ON storage.objects;

CREATE POLICY "photos_upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'progress-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "photos_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'progress-photos'
);
CREATE POLICY "photos_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'progress-photos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
