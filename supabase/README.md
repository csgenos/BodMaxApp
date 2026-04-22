# Supabase

Migrations live in `supabase/migrations/`. They are applied automatically
to the linked project on every push to `main` by
`.github/workflows/deploy.yml`.

## One-time setup

1. Install the CLI: <https://supabase.com/docs/guides/local-development/cli/getting-started>
2. Log in and link this repo to your project:

   ```sh
   supabase login
   supabase link --project-ref <your-project-ref>
   ```
3. Pull the current remote schema into a new migration so the repo reflects
   what is actually in production (captures tables that predate this repo
   — `profiles`, `sessions`, `exercises`, `sets`, `cardio`, `diet_entries`,
   `weight_log`, `personal_records`, `friendships`):

   ```sh
   supabase db pull
   ```

   This writes a new file under `supabase/migrations/` named with the
   remote schema's timestamp. Commit it.

## GitHub Actions secrets

The deploy workflow needs these repository secrets:

| Secret | Where to find it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Personal access token from <https://supabase.com/dashboard/account/tokens> |
| `SUPABASE_PROJECT_ID` | Project ref (the `xxx` in `xxx.supabase.co`) |
| `SUPABASE_DB_PASSWORD` | Database password set when you created the project |

## Day-to-day

```sh
# create a new migration
supabase migration new descriptive_name

# lint before pushing
supabase db lint

# apply locally (docker required)
supabase db reset

# push to the linked project
supabase db push
```

Never edit a migration that has already been pushed to production — write
a new one on top instead.
