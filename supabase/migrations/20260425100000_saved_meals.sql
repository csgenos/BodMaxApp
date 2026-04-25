CREATE TABLE IF NOT EXISTS saved_meals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  calories integer NOT NULL DEFAULT 0,
  protein numeric(6,1) DEFAULT 0,
  carbs numeric(6,1) DEFAULT 0,
  fat numeric(6,1) DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE saved_meals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users manage own saved meals" ON saved_meals;
CREATE POLICY "users manage own saved meals" ON saved_meals
  FOR ALL USING (auth.uid() = user_id);
