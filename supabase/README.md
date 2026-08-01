# Database migrations

Migrations live in `supabase/migrations/`.

Day-to-day work uses the root **Makefile** against the remote **dev** Supabase project. Production migrations run on push to `main` via GitHub Actions — see [docs/deploy.md](../docs/deploy.md).

## Project refs

Committed refs (no secrets) in [`projects.env`](projects.env):

- `SUPABASE_DEV_PROJECT_REF` — fill after creating the remote dev project
- `SUPABASE_PROD_PROJECT_REF` — production (`fvbmsviiijlmxyahezng`)

## Local (dev)

```bash
# Once: login, fill .env.dev, set SUPABASE_DEV_PROJECT_REF
npm run supabase:login
cp .env.dev.example .env.dev   # from repo root; fill keys + SUPABASE_DB_PASSWORD

make use-dev    # copies .env.dev → .env.local and links the CLI to dev
make db-push    # apply all migrations
make seed-admin # initial admin 0000 / 0000; must_change_password=true
make seed       # optional QA dataset — Makefile refuses if active env is not dev
```

`make use-dev` / `make use-prod` rewrite `supabase/.temp/` link state. Re-run `use-*` when switching projects.

**Do not seed before `db push`.** Seeding needs `public.users`.

Admin credentials after `seed-admin`:

- Employee number: `0000`
- Temporary password: `0000`
- Forced password change on first login

### Alternative: npm / SQL Editor

```bash
npm run supabase:link
npm run supabase:db:push
npm run seed:admin
```

Or paste migration SQL in the Supabase Dashboard SQL Editor for the correct project, then seed.

## Production

- Push to `main` → [`.github/workflows/deploy-prod.yml`](../.github/workflows/deploy-prod.yml) runs `supabase db push` against prod.
- **Never** run `make seed` / `npm run seed:dev` against prod.
- One-time prod admin bootstrap (if needed): `make use-prod && make seed-admin`.

## RLS note

`public.users` policies use `SECURITY DEFINER` helpers (`is_admin`, `current_user_id`, `current_user_role`) so role checks do not recurse through RLS.
