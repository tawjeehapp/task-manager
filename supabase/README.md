# Database migrations

Migrations live in `supabase/migrations/`.

## Link the remote project (required once)

Your CLI must be logged into the **same** Supabase org/account that owns the project in `.env` / `.env.local`.

```bash
# 1. Log in (opens browser)
npm run supabase:login

# 2. Confirm you can see projects
npm run supabase:status

# 3. Link this repo to the remote project (pick the correct project ref)
npm run supabase:link
```

`supabase link` writes project linkage under `supabase/.temp/` (gitignored). Re-run link if you switch projects.

## Apply migrations

Only after login + link:

```bash
npm run supabase:db:push
```

Then seed the initial admin:

```bash
npm run seed:admin
```

Admin credentials after seed:

- Employee number: `0000`
- Temporary password: `0000`
- Forced password change on first login

**Do not seed before `db push`.** Seeding needs `public.users`.

### Alternative: SQL Editor

If you prefer not to use the CLI, paste and run the migration file in the Supabase Dashboard SQL Editor for the correct project, then run `npm run seed:admin`.

## RLS note

`public.users` policies use `SECURITY DEFINER` helpers (`is_admin`, `current_user_id`, `current_user_role`) so role checks do not recurse through RLS.
