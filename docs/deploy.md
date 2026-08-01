# Production deploy (Vercel + Supabase)

Frontend runs on **one Vercel project** (production only). Local Next.js is enough for development. Database changes to **prod** Supabase run via GitHub Actions on push to `main`. Vercel deploys the app from the same `main` push (Git integration).

Migrations and the Vercel deploy run **in parallel**. If the Actions migrate job fails, fix it before relying on the new release — the app may already be live.

## One-time setup

### 1. Two remote Supabase projects

| Env | Project | Notes |
|---|---|---|
| Prod | Existing (`fvbmsviiijlmxyahezng`) | Used by Vercel Production |
| Dev | Create a second project in the same org | Used locally via Makefile |

Put both refs in [`supabase/projects.env`](../supabase/projects.env).

### 2. Local env files

```bash
cp .env.dev.example .env.dev    # fill from Supabase **dev** (API + DB password)
cp .env.prod.example .env.prod  # fill from Supabase **prod** (or copy current .env)
make use-dev
make db-push
make seed-admin   # optional first-time admin (must_change_password=true)
make seed         # QA dataset — dev only
```

Never run `make seed` after `make use-prod`.

### 3. Vercel (prod frontend)

1. From the repo root: `vercel link` (or create the project in the Vercel dashboard and connect GitHub `tawjeehapp/task-manager`).
2. Set **Production Branch** to `main`.
3. In Vercel → Project → Settings → Environment Variables, add **Production** values from `.env.prod`:

| Variable | Required |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional |
| `VAPID_PRIVATE_KEY` | Optional |
| `NEXT_PUBLIC_FEATURE_GANTT` | Optional |
| `NEXT_PUBLIC_FEATURE_KANBAN` | Optional |

Do **not** set Preview/Development to the prod Supabase project unless you intend to.

4. Redeploy after saving env vars (`vercel --prod` or push to `main`).

### 4. Supabase Auth redirect URLs (prod)

In the **prod** Supabase dashboard → Authentication → URL configuration:

- **Site URL:** `https://<your-vercel-project>.vercel.app` (or custom domain)
- **Redirect URLs:** include the same origin (and custom domain if any)

Local auth can keep `http://127.0.0.1:3000` / `http://localhost:3000` on the **dev** project.

### 5. GitHub Actions secrets (prod migrations)

Repository → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | [Personal access token](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_DB_PASSWORD` | Prod database password (Settings → Database) |
| `SUPABASE_PROJECT_ID` | `fvbmsviiijlmxyahezng` |

Workflow: [`.github/workflows/deploy-prod.yml`](../.github/workflows/deploy-prod.yml) runs `supabase db push` on every push to `main` (and `workflow_dispatch`).

**No seeds run in CI.** Bootstrap prod admin once with `make use-prod && make seed-admin` if needed.

### 6. Verify

1. Push a commit to `main` (or run the workflow manually).
2. Confirm the Actions job succeeds.
3. Confirm Vercel Production deployment succeeds and the app loads against prod Supabase.
