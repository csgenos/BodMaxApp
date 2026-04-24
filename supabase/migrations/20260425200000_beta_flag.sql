ALTER TABLE profiles ADD COLUMN IF NOT EXISTS beta boolean NOT NULL DEFAULT false;

-- All users who exist at migration time are beta testers
UPDATE profiles SET beta = true;
