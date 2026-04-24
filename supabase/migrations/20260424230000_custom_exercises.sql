-- Persist user-defined custom exercises so they appear in the picker every session
create table if not exists custom_exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  muscle_group text not null,
  created_at   timestamptz default now(),
  unique(user_id, name)
);

alter table custom_exercises enable row level security;

create policy "users manage own custom exercises"
  on custom_exercises for all
  using (auth.uid() = user_id);

grant all on custom_exercises to authenticated;
