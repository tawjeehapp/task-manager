# Work Management Platform

Arabic-first, RTL work management platform for organizations. Built with Next.js and Supabase as a Progressive Web App.

## Current status

**Milestones 0–5** are implemented for core product scope. **Next: Milestone 6 — Leave and Employee Requests.**

| Milestone | Status |
|---|---|
| 0 — Foundation | Partial (core done; full PWA offline + notifications deferred) |
| 1 — Auth & users | Completed |
| 2 — Departments | Completed |
| 3 — Projects & tasks | Completed |
| 4 — Dependencies, workload, activity | Completed |
| 5 — Attendance & work logs | Completed |
| 6 — Leave & employee requests | Remaining |

Implemented highlights:

- Employee-number login (`NNNN` → `NNNN@task-manager.com`), sessions, forced password change
- Admin user CRUD; admin/manager password reset (scoped)
- Departments, memberships, membership history
- Projects, members, tasks, one-level subtasks, Kanban
- Finish-to-start dependencies, assignee workload hints, task activity history
- Attendance clock in/out, approval workflow, task work logs
- DB-backed permissions + RLS (`SECURITY DEFINER` helpers)
- Vitest coverage for auth, permissions, org, projects, tasks, and attendance rules

## Quick start

1. Install [Node.js 22+](https://nodejs.org/)
2. Install dependencies: `npm install`
3. Copy env: `cp .env.example .env.local` and fill Supabase values for **your** project
4. Log in to Supabase CLI: `npm run supabase:login`
5. Link the project: `npm run supabase:link` (same project as `.env.local`)
6. Push migrations: `npm run supabase:db:push`
7. Seed admin: `npm run seed:admin` (employee `0000` / password `0000`)
8. Run: `npm run dev`

See [docs/spec/07-development-setup.md](docs/spec/07-development-setup.md) for full setup details.

## Documentation

| Spec | Description |
|---|---|
| [Product](docs/spec/00-product.md) | Goals and principles |
| [Architecture](docs/spec/01-architecture.md) | System design |
| [Database](docs/spec/02-database.md) | Schema |
| [UI](docs/spec/03-ui.md) | RTL and interface |
| [API](docs/spec/04-api.md) | API conventions |
| [Coding standards](docs/spec/05-coding-standards.md) | Code patterns |
| [Roadmap](docs/spec/06-roadmap.md) | Milestones |
| [Development setup](docs/spec/07-development-setup.md) | Local environment |

## Scripts

```bash
npm run dev              # Development server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint
npm run typecheck        # TypeScript check
npm run test             # Vitest
npm run supabase:login   # Log in to Supabase CLI
npm run supabase:link    # Link repo to remote project
npm run supabase:db:push # Apply migrations to linked project
npm run seed:admin       # Seed initial admin 0000
npm run seed:dev         # Deterministic M1–M5 QA dataset (idempotent)
```
