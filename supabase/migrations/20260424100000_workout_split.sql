-- Add workout_split JSONB column to profiles.
-- Stores the user's weekly workout schedule and notification preferences.
-- Shape: { days: { 0: null|string[], 1: null|string[], ... 6: null|string[] }, notifyEnabled: bool, notifyTime: "HH:MM" }
alter table profiles
  add column if not exists workout_split jsonb;
