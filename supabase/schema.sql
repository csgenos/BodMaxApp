-- ───────────────────────────────────────────────────────────
--  BodMax schema: RLS policies, server-side RPCs, and new tables
--  Run this in the Supabase SQL editor for your project.
-- ───────────────────────────────────────────────────────────

-- =====================================================================
-- NEW COLUMNS / TABLES FOR FEATURES
-- =====================================================================

-- Extended macro targets on profiles
alter table if exists profiles
  add column if not exists target_carbs integer,
  add column if not exists target_fat integer;

-- Extended macro fields on diet_entries
alter table if exists diet_entries
  add column if not exists carbs integer default 0,
  add column if not exists fat integer default 0;

-- Body measurements log
create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default (current_date),
  chest numeric,
  waist numeric,
  hips numeric,
  left_arm numeric,
  right_arm numeric,
  left_thigh numeric,
  right_thigh numeric,
  neck numeric,
  body_fat numeric,
  notes text,
  created_at timestamptz default now()
);
create index if not exists body_measurements_user_date_idx
  on body_measurements (user_id, date desc);

-- Workout templates (saved structure from a past session)
create table if not exists workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);
create index if not exists workout_templates_user_idx
  on workout_templates (user_id, created_at desc);

-- =====================================================================
-- RLS: enable and set ownership policies
-- =====================================================================

alter table profiles             enable row level security;
alter table sessions             enable row level security;
alter table exercises            enable row level security;
alter table sets                 enable row level security;
alter table cardio               enable row level security;
alter table diet_entries         enable row level security;
alter table weight_log           enable row level security;
alter table personal_records     enable row level security;
alter table friendships          enable row level security;
alter table body_measurements    enable row level security;
alter table workout_templates    enable row level security;

-- ─── PROFILES ─────────────────────────────────────────────
drop policy if exists profiles_select_all   on profiles;
drop policy if exists profiles_insert_self  on profiles;
drop policy if exists profiles_update_self  on profiles;
create policy profiles_select_all  on profiles for select using (true);
create policy profiles_insert_self on profiles for insert with check (auth.uid() = id);
create policy profiles_update_self on profiles for update using (auth.uid() = id);

-- ─── SESSIONS / EXERCISES / SETS / CARDIO ────────────────
drop policy if exists sessions_owner   on sessions;
drop policy if exists sessions_friends on sessions;
create policy sessions_owner on sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sessions_friends on sessions for select using (
  exists (select 1 from friendships f
           where f.status = 'accepted'
             and ((f.user_id = auth.uid() and f.friend_id = sessions.user_id)
               or (f.friend_id = auth.uid() and f.user_id = sessions.user_id)))
);

drop policy if exists exercises_through_session on exercises;
create policy exercises_through_session on exercises for all
  using (exists (select 1 from sessions s where s.id = exercises.session_id
                  and (s.user_id = auth.uid()
                    or exists (select 1 from friendships f
                                 where f.status = 'accepted'
                                   and ((f.user_id = auth.uid() and f.friend_id = s.user_id)
                                     or (f.friend_id = auth.uid() and f.user_id = s.user_id))))))
  with check (exists (select 1 from sessions s where s.id = exercises.session_id and s.user_id = auth.uid()));

drop policy if exists sets_through_exercise on sets;
create policy sets_through_exercise on sets for all
  using (exists (select 1 from exercises e join sessions s on s.id = e.session_id
                  where e.id = sets.exercise_id
                    and (s.user_id = auth.uid()
                      or exists (select 1 from friendships f
                                   where f.status = 'accepted'
                                     and ((f.user_id = auth.uid() and f.friend_id = s.user_id)
                                       or (f.friend_id = auth.uid() and f.user_id = s.user_id))))))
  with check (exists (select 1 from exercises e join sessions s on s.id = e.session_id
                       where e.id = sets.exercise_id and s.user_id = auth.uid()));

drop policy if exists cardio_through_session on cardio;
create policy cardio_through_session on cardio for all
  using (exists (select 1 from sessions s where s.id = cardio.session_id
                  and (s.user_id = auth.uid()
                    or exists (select 1 from friendships f
                                 where f.status = 'accepted'
                                   and ((f.user_id = auth.uid() and f.friend_id = s.user_id)
                                     or (f.friend_id = auth.uid() and f.user_id = s.user_id))))))
  with check (exists (select 1 from sessions s where s.id = cardio.session_id and s.user_id = auth.uid()));

-- ─── DIET ENTRIES ────────────────────────────────────────
drop policy if exists diet_owner on diet_entries;
create policy diet_owner on diet_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── WEIGHT LOG ──────────────────────────────────────────
drop policy if exists weight_owner on weight_log;
create policy weight_owner on weight_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── PERSONAL RECORDS ────────────────────────────────────
-- Owner has full access; friends may only SELECT via the RPC
drop policy if exists prs_owner on personal_records;
create policy prs_owner on personal_records for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── FRIENDSHIPS ─────────────────────────────────────────
-- Can read rows you are a party to; only the requester can insert;
-- only the recipient (friend_id) can accept/decline/delete.
drop policy if exists friendships_select       on friendships;
drop policy if exists friendships_insert       on friendships;
drop policy if exists friendships_update_self  on friendships;
drop policy if exists friendships_delete_self  on friendships;
create policy friendships_select on friendships for select
  using (auth.uid() = user_id or auth.uid() = friend_id);
create policy friendships_insert on friendships for insert
  with check (auth.uid() = user_id);
create policy friendships_update_self on friendships for update
  using (auth.uid() = friend_id) with check (auth.uid() = friend_id);
create policy friendships_delete_self on friendships for delete
  using (auth.uid() = friend_id or auth.uid() = user_id);

-- ─── BODY MEASUREMENTS ───────────────────────────────────
drop policy if exists body_owner on body_measurements;
create policy body_owner on body_measurements for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─── WORKOUT TEMPLATES ───────────────────────────────────
drop policy if exists tpl_owner on workout_templates;
create policy tpl_owner on workout_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- RPCs
-- =====================================================================

-- Atomic session save. Writes session + exercises + sets + cardio in one
-- transaction. If anything fails the whole thing rolls back — no orphans.
--
-- Expected payload shape:
-- {
--   "date": "2026-04-21T...",
--   "duration": 3600,
--   "completed_at": "2026-04-21T...",
--   "exercises": [
--     { "name": "Bench Press", "muscle_group": "Chest",
--       "sets": [{ "weight": 135, "reps": 8 }, ...] }, ...
--   ],
--   "cardio": [
--     { "type": "Running", "duration": 20, "distance": 2.1, "calories": 200 }, ...
--   ]
-- }
create or replace function save_session(payload jsonb)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_uid       uuid := auth.uid();
  v_session   uuid;
  v_ex        jsonb;
  v_set       jsonb;
  v_card      jsonb;
  v_ex_id     uuid;
  v_idx       int;
  v_set_idx   int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into sessions (user_id, date, duration, completed_at)
  values (
    v_uid,
    coalesce((payload->>'date')::timestamptz, now()),
    nullif(payload->>'duration','')::int,
    coalesce((payload->>'completed_at')::timestamptz, now())
  )
  returning id into v_session;

  v_idx := 0;
  for v_ex in select * from jsonb_array_elements(coalesce(payload->'exercises','[]'::jsonb))
  loop
    insert into exercises (session_id, name, muscle_group, order_index)
    values (v_session, v_ex->>'name', v_ex->>'muscle_group', v_idx)
    returning id into v_ex_id;

    v_set_idx := 0;
    for v_set in select * from jsonb_array_elements(coalesce(v_ex->'sets','[]'::jsonb))
    loop
      if nullif(v_set->>'weight','') is not null and nullif(v_set->>'reps','') is not null then
        v_set_idx := v_set_idx + 1;
        insert into sets (exercise_id, weight, reps, set_number)
        values (v_ex_id, (v_set->>'weight')::numeric, (v_set->>'reps')::int, v_set_idx);
      end if;
    end loop;

    v_idx := v_idx + 1;
  end loop;

  for v_card in select * from jsonb_array_elements(coalesce(payload->'cardio','[]'::jsonb))
  loop
    insert into cardio (session_id, type, duration, distance, calories)
    values (
      v_session,
      v_card->>'type',
      nullif(v_card->>'duration','')::int,
      nullif(v_card->>'distance','')::numeric,
      nullif(v_card->>'calories','')::int
    );
  end loop;

  return v_session;
end $$;

grant execute on function save_session(jsonb) to authenticated;

-- Fetch a friend's PRs, but only if an accepted friendship exists.
-- This is the authoritative server-side check — clients cannot bypass it.
create or replace function get_friend_prs(friend uuid)
returns setof personal_records
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from friendships f
    where f.status = 'accepted'
      and ((f.user_id = auth.uid() and f.friend_id = friend)
        or (f.friend_id = auth.uid() and f.user_id = friend))
  ) then
    raise exception 'Not friends';
  end if;

  return query
    select * from personal_records
    where user_id = friend
    order by muscle_group;
end $$;

grant execute on function get_friend_prs(uuid) to authenticated;
