-- Invite codes table for beta tester onboarding
CREATE TABLE IF NOT EXISTS invite_codes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code        text UNIQUE NOT NULL,
  max_uses    integer NOT NULL DEFAULT 1000,
  use_count   integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed the launch code
INSERT INTO invite_codes (code, max_uses) VALUES ('BETA2026', 1000)
  ON CONFLICT (code) DO NOTHING;

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can look up a code to validate it
CREATE POLICY "Authenticated users can read invite codes"
  ON invite_codes FOR SELECT
  USING (auth.role() = 'authenticated');

-- RPC: validate code and mark the caller's profile as beta
CREATE OR REPLACE FUNCTION use_invite_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id       uuid;
  v_max      integer;
  v_count    integer;
BEGIN
  SELECT id, max_uses, use_count
    INTO v_id, v_max, v_count
    FROM invite_codes
   WHERE code = upper(trim(p_code))
     FOR UPDATE;

  IF v_id IS NULL THEN RETURN false; END IF;
  IF v_count >= v_max THEN RETURN false; END IF;

  UPDATE invite_codes SET use_count = use_count + 1 WHERE id = v_id;
  UPDATE profiles SET beta = true WHERE id = auth.uid();
  RETURN true;
END;
$$;
