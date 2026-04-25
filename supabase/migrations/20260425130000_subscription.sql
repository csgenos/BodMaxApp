alter table profiles
  add column if not exists stripe_customer_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_end_at timestamptz;
