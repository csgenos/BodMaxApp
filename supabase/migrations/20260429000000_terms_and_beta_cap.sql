-- Add terms acceptance tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz DEFAULT NULL;

-- Replace use_invite_code to enforce 50-person beta cap
CREATE OR REPLACE FUNCTION use_invite_code(p_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id       uuid;
  v_max      integer;
  v_count    integer;
  v_beta_total integer;
BEGIN
  -- Enforce hard beta cap of 50 users
  SELECT COUNT(*) INTO v_beta_total FROM profiles WHERE beta = true;
  IF v_beta_total >= 50 THEN RETURN false; END IF;

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

-- RPC to accept terms (call from client after user scrolls and checks the box)
CREATE OR REPLACE FUNCTION accept_terms()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
    SET terms_accepted_at = now()
  WHERE id = auth.uid()
    AND terms_accepted_at IS NULL;
END;
$$;

-- RPC to get current beta user count (for admin visibility)
CREATE OR REPLACE FUNCTION get_beta_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer FROM profiles WHERE beta = true;
$$;
