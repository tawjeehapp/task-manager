# Development Setup

## Overview

This document explains how to set up the local development environment for the Work Management Platform.

Stack:

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase
- next-intl
- TanStack Query
- Vitest + React Testing Library

---

# Requirements

## Node.js

Required:

Node.js 22 LTS or newer

Verify:

```bash
node -v
```

---

# Install Dependencies

From the repository root:

```bash
npm install
```

---

# Environment Variables

1. Copy the example file:

```bash
cp .env.example .env.local
```

2. Fill in values from your Supabase project:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never expose to the browser |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Push placeholder (unused until Milestone 7) |
| `VAPID_PRIVATE_KEY` | No | Server-only push placeholder |

Never commit `.env.local` or real secrets.

The URL/keys in `.env.local` must belong to the **same** Supabase project you link with the CLI below.

---

# Database

Apply all migrations **before** seeding. Order matters. Migrations cover auth/users (M1), departments (M2), projects/tasks (M3), and dependencies/activity (M4).

## 1. Log in to Supabase CLI

```bash
npm run supabase:login
```

This opens the browser. Use the account that owns your task-manager project.

Confirm access:

```bash
npm run supabase:status
```

You should see your projects listed (not `Forbidden`).

## 2. Link this repository to the remote project

```bash
npm run supabase:link
```

Select the project whose URL matches `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`.

## 3. Push migrations

```bash
npm run supabase:db:push
```

This applies every file under `supabase/migrations/` (users, departments, projects, tasks, dependencies, activity logs, permissions, and RLS helpers).

## 4. Seed the initial admin

```bash
npm run seed:admin
```

Initial admin:

- Employee number: `0000`
- Temporary password: `0000`
- Must change password on first login

Auth emails use the synthetic domain `@task-manager.com`. Users enter only the 4-digit employee number.

If seed fails with `Could not find the table 'public.users'`, migrations were not applied to that project yet — go back to step 3.

### Auth password settings (required for employee-number temps)

Temporary passwords are the 4-digit employee number. In the Supabase Dashboard → **Authentication → Providers → Email** (password settings):

- Set **minimum password length** to `4` (or leave defaults; admin reset recreates the Auth user when strength checks block short temps)
- Avoid requiring letters/symbols if you want users to keep using numeric temps at first login
- If **leaked password protection** blocks common numbers, disable it for this internal app or keep the recreate-based admin reset

Forced password change still encourages stronger passwords after first login.

---

# Development dataset seed (`seed:dev`)

For manual QA of M1–M6 features, use the deterministic development seed. It is **separate** from `seed:admin` and does not replace it.

Prerequisites: migrations applied, and `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

```bash
npm run seed:dev
```

Idempotent re-run (safe to repeat):

```bash
npm run seed:dev
```

Reset **only seed-owned rows** (fixed UUIDs in the catalog), then recreate them. Never deletes manually created users/projects/tasks/attendance/work logs, and never deletes Auth users:

```bash
npm run seed:dev -- --reset
```

### What it creates

- Users `0000`–`1008` (Arabic names; roles: admin, 2 managers, employees)
- Departments: تقنية المعلومات، المناهج والتخطيط (current memberships only)
- Projects, tasks/subtasks, dependencies, uneven workload
- Attendance scenarios (open, awaiting approval, approved, rejected, resubmitted pending, break minutes, empty today)
- Work logs on parent tasks and subtasks across multiple days

### Credential rules

| Case | Behavior |
|---|---|
| New Auth user | Password = employee number; profile `must_change_password = false` |
| Existing Auth user | **Password never overwritten** |
| Existing profile | Updates deterministic fields only (name, phone, role, active); **does not** reset `must_change_password` |

Login with employee number only (e.g. `1003` / `1003` when Auth was created by this seed).

### Minimal vs full seed

| Command | Use when |
|---|---|
| `npm run seed:admin` | Bootstrap only admin `0000` (production-safe minimal) |
| `npm run seed:dev` | Full local QA dataset (also ensures admin `0000` exists) |

Refuses to run when `NODE_ENV=production` unless `ALLOW_DEV_SEED=true`.

---

# Development Commands

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other commands:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run start
npm run supabase:login
npm run supabase:link
npm run supabase:db:push
npm run seed:admin
npm run seed:dev
```

---

# Project Structure

Feature-based layout under `src/`:

```
src/
  app/           # App Router pages and API routes
  components/    # UI and shared components
  features/      # Feature modules (auth, users, departments, projects, tasks, notifications stubs)
  lib/           # Supabase, auth, permissions, API helpers
  providers/     # React providers (TanStack Query, etc.)
  i18n/          # next-intl configuration
  config/        # Env validation
messages/        # Translation files (Arabic-first; en present for future)
supabase/migrations/
```

---

# Localization

- Default locale: Arabic (`ar`)
- Direction: RTL
- Translation files: `messages/ar.json`

All user-facing text should come from translation files.

---

# Progressive Web App

Milestone 0 includes PWA foundation only:

- Web manifest (`public/manifest.webmanifest`)
- App icons
- Install metadata in the root layout

Service workers and offline caching are deferred until a dedicated PWA milestone. The unused `next-pwa` dependency was removed; revisit packaging then.

---

# Current Milestone

**Milestone 7 — Communication** is next.

Milestones 0–6 core scope is implemented. See [06-roadmap.md](./06-roadmap.md) for accurate status (completed / partial / deferred).

### Already applied (M1–M6)

| Milestone | Migrations (under `supabase/migrations/`) |
|---|---|
| 1 Auth & users | `20260725120000_milestone1_auth_users.sql` |
| 2 Departments | `20260725130000_milestone2_departments.sql` |
| 3 Projects & tasks | `20260725140000_milestone3_projects_tasks.sql`, `20260725141000_milestone3_project_manage_admin_only.sql` |
| 4 Dependencies & activity | `20260725150000_milestone4_dependencies_activity.sql`, `20260725151000_milestone4_simplify_task_statuses.sql` |
| 5 Attendance & work logs | `20260725160000_milestone5_attendance_work_logs.sql` |
| 6 Leave & employee requests | `20260725170000_milestone6_leave_employee_requests.sql` |

### Shipped through M6 (summary)

- Auth, users, permissions, departments, memberships
- Projects, members, tasks, one-level subtasks, Kanban
- Finish-to-start dependencies, assignee workload hints, task activity history
- Attendance clock in/out, approval/rejection, daily hour totals, task work logs
- Leave types/balances/requests, task extension/excusal, centralized `/approvals`
- Task statuses: `todo | in_progress | blocked | completed`

### Explicitly not included yet

- Announcements / real notifications / push (Milestone 7; M0 stubs only)
- Dashboards / reports (Milestone 8)
- Gantt (Milestone 9)
- Task comments / attachments
- Service worker / offline PWA runtime

---

# Documentation Map

| Document | Purpose |
|---|---|
| [00-product.md](./00-product.md) | Product goals and principles |
| [01-architecture.md](./01-architecture.md) | System architecture |
| [02-database.md](./02-database.md) | Database design |
| [03-ui.md](./03-ui.md) | UI / RTL design |
| [04-api.md](./04-api.md) | API patterns |
| [05-coding-standards.md](./05-coding-standards.md) | Coding standards |
| [06-roadmap.md](./06-roadmap.md) | Implementation milestones |
| [07-development-setup.md](./07-development-setup.md) | This document |
