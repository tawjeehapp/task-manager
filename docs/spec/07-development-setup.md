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

| Variable | Required for Milestone 0 | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Recommended | Public Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Recommended | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-only; never expose to the browser |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No | Push foundation (unused until later) |
| `VAPID_PRIVATE_KEY` | No | Server-only push foundation |

Never commit `.env.local` or real secrets.

Milestone 0 does **not** create database migrations. You only need a Supabase project if you want client setup to resolve; the Arabic app shell runs without a live database.

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
npm run build
npm run start
```

---

# Project Structure

Feature-based layout under `src/`:

```
src/
  app/           # App Router pages and API routes
  components/    # UI and shared components
  features/      # Feature modules (e.g. notifications stubs)
  lib/           # Supabase, auth stubs, API helpers, push stubs
  providers/     # React providers (TanStack Query, etc.)
  i18n/          # next-intl configuration
  config/        # Env validation
messages/        # Translation files (Arabic-first)
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

**Milestone 0 — Project Foundation**

Includes:

- RTL / Arabic localization foundation
- Application shell
- Tailwind / shadcn foundation
- Supabase client setup
- TanStack Query setup
- PWA manifest foundation
- Notification infrastructure stubs

Does **not** include:

- Database migrations or tables
- Authentication UI
- Users, departments, projects, tasks
- Notification persistence

See [06-roadmap.md](./06-roadmap.md) for the full roadmap.

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
