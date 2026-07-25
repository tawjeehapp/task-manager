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

| Variable | Required for Milestone 1 | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never expose to the browser |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Push foundation (unused until later) |
| `VAPID_PRIVATE_KEY` | No | Server-only push foundation |

Never commit `.env.local` or real secrets.

The URL/keys in `.env.local` must belong to the **same** Supabase project you link with the CLI below.

---

# Database (Milestone 1)

Apply schema **before** seeding. Order matters.

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

This creates `public.users`, `permissions`, `role_permissions`, and RLS helpers.

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
```

---

# Project Structure

Feature-based layout under `src/`:

```
src/
  app/           # App Router pages and API routes
  components/    # UI and shared components
  features/      # Feature modules (auth, users, notifications)
  lib/           # Supabase, auth, permissions, API helpers
  providers/     # React providers (TanStack Query, etc.)
  i18n/          # next-intl configuration
  config/        # Env validation
messages/        # Translation files (Arabic-first)
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

Service workers, offline caching, and `next-pwa` runtime integration are deferred until the Next.js 16 approach is validated.

---

# Current Milestone

**Milestone 3 — Projects and Tasks**

Includes:

- Projects (create, dates, priority, archive) scoped to departments
- Project members (add / remove; must be department members)
- Tasks (create, assign, dates, priority, estimated hours, status)
- One-level subtasks
- Task list, task detail, project Kanban board
- Permissions: `project.view` (all roles scoped); `project.manage` (admin only); managers get `task.create` / `task.assign` for in-project work
- Department managers manage members/tasks inside department projects, not the project entity itself
- RLS helpers: `can_access_project`, `can_access_task`, `is_project_member`

Does **not** include:

- Task dependencies / workload views (Milestone 4)
- Activity history UI / logging product (Milestone 4)
- Comments, attachments
- Attendance, leave, announcements

Apply migration: `supabase/migrations/20260725140000_milestone3_projects_tasks.sql`

See [06-roadmap.md](./06-roadmap.md) for the full roadmap.

---

## Milestone 4 — Task Management Intelligence

Includes:

- Finish-to-start task dependencies with start/complete guards
- Employee workload view before assignment (active task count + estimated hours)
- Task activity history (assignment, status, updates)

Apply migration: `supabase/migrations/20260725150000_milestone4_dependencies_activity.sql`

Does **not** include:

- Comments, attachments
- Notifications product
- Attendance, leave, dashboards, Gantt

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
