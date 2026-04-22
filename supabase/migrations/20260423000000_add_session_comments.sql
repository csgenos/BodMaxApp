-- Session comments table
CREATE TABLE IF NOT EXISTS session_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text        TEXT NOT NULL CHECK (char_length(text) > 0 AND char_length(text) <= 500),
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS session_comments_session_id_idx ON session_comments (session_id);

ALTER TABLE session_comments ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read comments on any session
CREATE POLICY "authenticated users can read comments"
  ON session_comments FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only insert comments as themselves
CREATE POLICY "users can insert own comments"
  ON session_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own comments
CREATE POLICY "users can delete own comments"
  ON session_comments FOR DELETE
  USING (auth.uid() = user_id);
