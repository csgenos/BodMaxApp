CREATE TABLE IF NOT EXISTS session_likes (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (session_id, user_id)
);

CREATE INDEX IF NOT EXISTS session_likes_session_id_idx ON session_likes (session_id);

ALTER TABLE session_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read likes"
  ON session_likes FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "users can insert own likes"
  ON session_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own likes"
  ON session_likes FOR DELETE
  USING (auth.uid() = user_id);
