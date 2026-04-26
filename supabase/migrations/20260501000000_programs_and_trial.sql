-- Add AI coach trial usage counter to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_coach_trial_uses INT NOT NULL DEFAULT 0;

-- ── WORKOUT PROGRAMS ─────────────────────────────────────────
-- Stores pre-built (is_public=true, created_by=null) and user-created programs
CREATE TABLE IF NOT EXISTS workout_programs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  days_per_week INT  NOT NULL DEFAULT 3,
  duration_weeks INT NOT NULL DEFAULT 4,
  is_premium    BOOLEAN NOT NULL DEFAULT false,
  created_by    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_public     BOOLEAN NOT NULL DEFAULT false,
  program_data  JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── USER PROGRAM PROGRESS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id  UUID NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_day INT NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_programs    ENABLE ROW LEVEL SECURITY;

-- Public/system programs are readable by everyone; owners read their own
CREATE POLICY "Read programs" ON workout_programs
  FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Create own programs" ON workout_programs
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "Update own programs" ON workout_programs
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Delete own programs" ON workout_programs
  FOR DELETE USING (created_by = auth.uid());

-- Full access to own program progress rows
CREATE POLICY "Own user_programs" ON user_programs
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── SEED PRE-BUILT PROGRAMS ──────────────────────────────────
INSERT INTO workout_programs (name, description, days_per_week, duration_weeks, is_premium, is_public, program_data) VALUES
(
  'Push / Pull / Legs',
  'Classic 6-day split hitting every muscle group twice a week. Best for intermediate lifters.',
  6, 6, false, true,
  '{"days":[
    {"day":1,"name":"Push A","muscles":["Chest","Shoulders","Triceps"],"exercises":["Bench Press","Overhead Press","Incline Dumbbell Press","Tricep Pushdown","Lateral Raise"]},
    {"day":2,"name":"Pull A","muscles":["Back","Biceps"],"exercises":["Pull-Up","Barbell Row","Cable Row","Bicep Curl","Face Pull"]},
    {"day":3,"name":"Legs A","muscles":["Quads","Hamstrings","Glutes"],"exercises":["Squat","Romanian Deadlift","Leg Press","Leg Curl","Calf Raise"]},
    {"day":4,"name":"Push B","muscles":["Chest","Shoulders","Triceps"],"exercises":["Incline Bench Press","Dumbbell Shoulder Press","Cable Fly","Skull Crusher","Lateral Raise"]},
    {"day":5,"name":"Pull B","muscles":["Back","Biceps"],"exercises":["Deadlift","Lat Pulldown","Seated Cable Row","Hammer Curl","Rear Delt Fly"]},
    {"day":6,"name":"Legs B","muscles":["Quads","Hamstrings","Glutes"],"exercises":["Front Squat","Leg Press","Lying Leg Curl","Bulgarian Split Squat","Calf Raise"]},
    {"day":7,"name":"Rest","muscles":[],"exercises":[],"isRest":true}
  ]}'
),
(
  'Full Body 3×',
  'Three full-body sessions per week. Great for beginners and those with limited gym time.',
  3, 4, false, true,
  '{"days":[
    {"day":1,"name":"Full Body A","muscles":["Chest","Back","Legs","Shoulders"],"exercises":["Bench Press","Barbell Row","Squat","Overhead Press","Bicep Curl","Tricep Pushdown"]},
    {"day":2,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":3,"name":"Full Body B","muscles":["Chest","Back","Legs","Shoulders"],"exercises":["Incline Dumbbell Press","Pull-Up","Romanian Deadlift","Dumbbell Shoulder Press","Hammer Curl","Dips"]},
    {"day":4,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":5,"name":"Full Body C","muscles":["Chest","Back","Legs","Shoulders"],"exercises":["Cable Fly","Lat Pulldown","Leg Press","Arnold Press","Barbell Curl","Close Grip Bench Press"]},
    {"day":6,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":7,"name":"Rest","muscles":[],"exercises":[],"isRest":true}
  ]}'
),
(
  'Upper / Lower Split',
  '4-day upper/lower split for balanced hypertrophy and strength gains over 8 weeks.',
  4, 8, true, true,
  '{"days":[
    {"day":1,"name":"Upper A","muscles":["Chest","Back","Shoulders","Arms"],"exercises":["Bench Press","Barbell Row","Overhead Press","Pull-Up","Bicep Curl","Tricep Pushdown"]},
    {"day":2,"name":"Lower A","muscles":["Quads","Hamstrings","Glutes","Calves"],"exercises":["Squat","Romanian Deadlift","Leg Press","Leg Curl","Calf Raise"]},
    {"day":3,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":4,"name":"Upper B","muscles":["Chest","Back","Shoulders","Arms"],"exercises":["Incline Bench Press","Lat Pulldown","Dumbbell Shoulder Press","Cable Row","Hammer Curl","Skull Crusher"]},
    {"day":5,"name":"Lower B","muscles":["Quads","Hamstrings","Glutes","Calves"],"exercises":["Deadlift","Front Squat","Bulgarian Split Squat","Leg Extension","Seated Calf Raise"]},
    {"day":6,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":7,"name":"Rest","muscles":[],"exercises":[],"isRest":true}
  ]}'
),
(
  '5×5 Strength',
  'Linear progression strength program. Add weight every session for 12 weeks of consistent gains.',
  3, 12, true, true,
  '{"days":[
    {"day":1,"name":"Workout A","muscles":["Legs","Chest","Back"],"exercises":["Squat","Bench Press","Barbell Row"],"note":"5 sets × 5 reps. Add 5 lbs each session."},
    {"day":2,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":3,"name":"Workout B","muscles":["Legs","Shoulders","Back"],"exercises":["Squat","Overhead Press","Deadlift"],"note":"5 sets × 5 reps. Deadlift: 1 set × 5."},
    {"day":4,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":5,"name":"Workout A","muscles":["Legs","Chest","Back"],"exercises":["Squat","Bench Press","Barbell Row"],"note":"5 sets × 5 reps. Add 5 lbs each session."},
    {"day":6,"name":"Rest","muscles":[],"exercises":[],"isRest":true},
    {"day":7,"name":"Rest","muscles":[],"exercises":[],"isRest":true}
  ]}'
);
