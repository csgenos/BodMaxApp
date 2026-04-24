create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  message text not null,
  rating int check (rating between 1 and 5),
  created_at timestamptz default now()
);

alter table feedback enable row level security;

create policy "Users can insert their own feedback"
  on feedback for insert
  with check (auth.uid() = user_id);

create policy "Users can view their own feedback"
  on feedback for select
  using (auth.uid() = user_id);
