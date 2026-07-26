# Project Rules

## Project Identity

This project is a Work Management Platform.

It is:

- Arabic-first
- RTL by default
- Built for organizations
- Designed as a Progressive Web App
- Built with Next.js and Supabase


## Documentation First

Before making any architectural or implementation decision:

Read:

- docs/spec/00-product.md
- docs/spec/01-architecture.md
- docs/spec/02-database.md
- docs/spec/03-ui.md
- docs/spec/04-api.md
- docs/spec/05-coding-standards.md
- docs/spec/06-roadmap.md
- docs/spec/07-development-setup.md


Do not introduce patterns that conflict with these documents.


# Technology Rules

## Frontend

Use:

- Next.js App Router
- TypeScript
- Tailwind CSS
- shadcn/ui


## Backend

Use:

- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Supabase Realtime


Do not introduce another backend framework.


# Rendering Rules

Default:

Use Server Components.

Only use Client Components when browser interaction is required.

Examples requiring Client Components:

- Drag and drop
- Interactive charts
- Complex forms
- Browser APIs
- Real-time UI elements


Do not convert components to client components without a clear reason.


# Server Actions

Do not use Server Actions.

Use:

- API Routes
- Service layer


# Supabase Rules

Never access Supabase directly from React components.

Bad:

Component
→ Supabase


Good:

Component
→ Hook / Server Function
→ Service
→ Supabase


# Business Logic Rules

Business logic must not exist inside:

- Components
- Pages
- API route handlers


Business logic belongs in:

- Feature services
- Validation schemas
- Permission helpers


# Security Rules

Security uses two layers:

## Database

Use RLS for:

- Data visibility
- Ownership boundaries


## Application

Use services/API for:

- Business rules
- Workflow decisions
- Permission checks


Avoid putting complex business workflows inside RLS.


# Folder Structure

Use feature-based organization.


Example:

src/

features/

    tasks/

        components/
        services/
        queries/
        mutations/
        schemas/
        types/


Shared code:

components/

lib/

types/


# UI Rules

Always:

- Support RTL
- Use Tailwind CSS
- Use shadcn/ui
- Support mobile layouts


Avoid:

- Custom CSS unless necessary
- Duplicate components
- Large components


# Arabic RTL Rules

Arabic is the primary language.

All UI must support:

- RTL layouts
- Arabic text flow
- Correct icon direction
- Arabic dates and numbers


Do not build LTR first and translate later.


# Table Rules

List/table pages must support:

- Server-side pagination with page sizes **25 / 50 / 100** (default 25)
- Single-column sorting (`sortBy` + `sortDir`)
- Visible result counts (total and “showing X–Y of Z”)
- Server-side filters relevant to the resource

Reuse shared helpers:

- `TablePagination`
- `SortableTableHead`
- `lib/table/constants`

Do not load unlimited rows into table pages.


# Detail Page Navigation Rules

Detail and nested screens must show **breadcrumbs** above the page header.

Use shared `Breadcrumbs` (`components/shared/breadcrumbs.tsx`).

Rules:

- Show the hierarchy path (e.g. Projects → Department → Project → Task)
- Intermediate crumbs are links; the last crumb is the current page (not a link)
- Prefer breadcrumbs over a single “back” text link
- Support RTL (separator chevron flips automatically)

When a detail page has multiple peer content areas (e.g. members vs tasks), use **tabs** — do not stack those sections vertically on one long page.

Use shared `Tabs` / `TabPanel` (`components/shared/tabs.tsx`).

**Do not place additional content below a data table** on the same tab/panel (history, secondary lists, forms). Long tables push that content off-screen. Put peer content in its own tab instead.

# Inline List Editing

List views for projects, tasks, and subtasks must allow changing important fields **without opening the detail page**.

Typical inline fields:

- Title
- Status / state
- Assignee
- Priority
- Estimated hours (**subtasks only**; parent hours = sum, or 0 with no subtasks)
- Due / end dates

Rules:

- Prefer compact controls in the table cell (select / date / number)
- Stop row navigation when interacting with inline controls
- Respect the same permission rules as the detail page
- Persist on change (or on blur for free-text/number/date)
- Task lists with subtasks must show a **subtask count** and be **expandable** so users can open nested tasks directly
- Parent task **estimated hours** are always the **sum of subtask hours** (0 when there are none) — never edited on the parent itself
- List views must support quick **add (+)** (including subtasks), **copy**, and **delete** without leaving the list
- Creating a task/subtask from a list must **keep the user on the list** (do not auto-navigate to the detail page)
- List rows must still offer a clear way to **open the detail page** (title link and/or open-details action) for full context, attachments, activity, etc.

Use shared `TasksListTable` where possible for task/subtask lists.


# API Rules

API mutations follow:

API Route
↓
Validation
↓
Permission Check
↓
Service
↓
Supabase


All inputs must use:

- Zod validation


# TypeScript Rules

Avoid:

- any

Prefer:

- Explicit types
- unknown with validation


# State Management

Do not introduce global state libraries.

Use:

Server state:
- TanStack Query


Forms:
- React Hook Form


Local UI state:
- React state


# List Page Data Loading

Primary navigable list pages must paint from server-fetched data on first view.

Do not ship a list page that only auth-gates on the server and then waits for TanStack Query → `/api` for the default table.

Required pattern:

1. Page Server Component: `getCurrentUser` → permission check → feature service (`listXForViewer` / equivalent) with **default** query params matching the client’s initial filters.
2. Pass result as `initial*` prop to the page client.
3. Client `useQuery`: spread `withInitialData(initial*)` from `src/lib/query/initial-data.ts` **only when** current page/filters/sort match those defaults.
4. Keep API routes for pagination, filter changes, and mutations.

Reference implementations:

- `src/app/(app)/projects/page.tsx` + `projects-page-client.tsx`
- Same for tasks, departments, employees; dashboard already passes server data as props

Also required for app shell navigations:

- `src/app/(app)/loading.tsx` for instant route skeletons
- Request-scoped `cache()` on `getCurrentUser` / `getPermissionsForRole` (already in `lib/auth` and `lib/permissions`)
- Request-scoped `cache()` on membership scope helpers (`getManagedDepartmentId`, `getProjectIdsForUser`)
- Prefer `Promise.all` for independent aggregates; Prefer PostgREST embeds for list counts/relations over N+1 follow-up queries

When adding a new primary sidebar list route, follow this pattern in the same PR.


# Database Rules

Database changes require:

- Migration files
- Documentation updates


Never manually modify production databases.


# Code Quality Rules

Before adding new code:

Check if an existing pattern/component/service already exists.


Prefer:

- Reuse
- Simplicity
- Consistency


Avoid:

- Over-engineering
- Premature abstractions
- Unnecessary dependencies


# Feature Development Rules

When implementing a feature:

1. Read the relevant specification.
2. Confirm database requirements.
3. Implement permissions.
4. Implement service layer.
5. Implement API.
6. Implement UI.
7. For primary list routes: server-fetch default list data and seed TanStack Query (`withInitialData`).
8. Add loading, error, and success feedback.
9. Verify RTL.


# User Feedback Rules

Every user-submitted action that succeeds must show clear success feedback.

This includes create, update, delete, activate/deactivate, password reset, approvals, and similar mutations.

Use whatever pattern fits the context:

- Inline alert / banner on the page
- Snackbar / toast
- Dialog confirmation result
- Inline form success message

Do not rely only on a dialog closing or a list refreshing with no message.

Failures must also show a clear error message.

All feedback text must come from translation files.


# AI Development Rules

When generating code:

- Do not create files randomly.
- Follow existing architecture.
- Explain major decisions.
- Do not add libraries without justification.
- Do not skip documentation updates.

## Specification Authority

Before implementing any feature or milestone, read the relevant files under `docs/spec/`.

The specification files are the source of truth for product requirements, architecture, UI, API conventions, database design, and development standards.

In particular:

- `03-ui.md` is the source of truth for visual design, colors, typography, RTL behavior, and UI patterns.
- `02-database.md` is the source of truth for database conventions and schema design.
- `04-api.md` is the source of truth for API conventions.
- `05-coding-standards.md` is the source of truth for implementation conventions.
- `06-roadmap.md` defines milestone scope and boundaries.

Do not rely on previous chat instructions when they conflict with the current specification files.

If a specification appears inconsistent with another specification, stop and ask for clarification before implementing the conflicting part.