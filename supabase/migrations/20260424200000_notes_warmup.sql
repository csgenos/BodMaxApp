-- Add session notes and per-set warmup tracking

alter table sessions add column if not exists notes text;
alter table sets     add column if not exists is_warmup boolean not null default false;

-- Update save_session RPC to handle notes and is_warmup
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

  insert into sessions (user_id, date, duration, completed_at, notes)
  values (
    v_uid,
    coalesce((payload->>'date')::timestamptz, now()),
    nullif(payload->>'duration','')::int,
    coalesce((payload->>'completed_at')::timestamptz, now()),
    nullif(payload->>'notes','')
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
        insert into sets (exercise_id, weight, reps, set_number, is_warmup)
        values (
          v_ex_id,
          (v_set->>'weight')::numeric,
          (v_set->>'reps')::int,
          v_set_idx,
          coalesce((v_set->>'is_warmup')::boolean, false)
        );
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
