# Implementation Roadmap

## Overview

This roadmap defines the development order for the Work Management Platform.

The application is built incrementally. Each milestone should produce a usable working system before moving to the next.

**Status legend (Milestones 0–4):** For completed work, the **implementation is the source of truth**. This document records what was planned, what shipped, and what remains deferred.

| Status | Meaning |
|---|---|
| **Completed** | Implemented and in use |
| **Partially completed** | Some planned items shipped; gaps remain |
| **Remaining** | Still to do within that milestone’s original intent |
| **Deferred** | Intentionally postponed to a later milestone |
| **Out of scope** | Not part of MVP / not planned for that milestone |

### Current project status

**Milestones 0–8 core product scope is implemented** (M0 PWA offline + Web Push still deferred). **Next up: Milestone 9 — Advanced Views.**

---

## Testing Strategy

Testing infrastructure was introduced in Milestone 1 (Vitest + React Testing Library).

| Milestone | Planned testing focus | Actual status |
|---|---|---|
| **1** | Auth, users, permissions, organization rules | **Completed** — unit/schema/service tests present |
| **2** | Departments, memberships, manager constraints, scoped password reset | **Completed** |
| **3** | Projects, tasks, access rules | **Completed** — schemas, access asserts, create-task (incl. subtask depth) |
| **4** | Dependencies, workload, activity | **Partially completed** — dependency service tests present; dedicated workload/activity tests thin |
| **5** | Attendance calculations, approval, work-log authz | **Completed** |
| **6+** | Leave, approvals, and later workflows | **Completed for M6–M8** — leave + communication + report schema/permission tests |

End-to-end testing with Playwright remains **deferred** until complete business workflows exist (attendance / leave / approvals).

---

# Milestone 0 — Project Foundation

**Status: Partially completed** (core foundation **Completed**; PWA offline + notifications product **Deferred**)

## Goal

Create the application foundation and development environment.

## Planned features

### Project Setup

- Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui
- RTL configuration, Arabic localization, environment configuration

### Architecture Setup

- Feature-based folders, Supabase clients, auth helpers
- API route structure, service layer, validation (Zod)

### UI Foundation

- Application layout, sidebar, header, mobile navigation
- Theme foundation, loading / error / empty states

### PWA Foundation

- Installable application, web manifest, service worker, app icons, basic offline support

### Notifications Foundation

- Notification database structure, service, notification center UI, push infrastructure

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Next.js / TS / Tailwind / shadcn | **Completed** | Next.js 16, React 19, Tailwind v4 |
| RTL + Arabic (`next-intl`) | **Completed** | Default locale `ar`; `en` messages file exists but UI always uses default locale |
| Feature folders + services + API pattern | **Completed** | Matches architecture spec |
| App shell (sidebar, header, mobile nav) | **Completed** | Future nav items present but disabled |
| Loading / error / empty states | **Completed** | Shared components |
| Web manifest + icons + install metadata | **Completed** | `public/manifest.webmanifest`, layout metadata |
| Service worker / offline PWA runtime | **Deferred** | Manifest + icons only; unused `next-pwa` dependency **removed** — revisit when PWA milestone arrives |
| Notifications DB + API + real center | **Completed (M7)** | In-app persistence + bell + `/notifications`; Web Push still deferred |
| Push (VAPID env + subscribe stub) | **Deferred** | Env keys documented; delivery deferred past M7 |
| Dashboard home (`/`) | **Completed (M8)** | Role-specific operational dashboards |

## Differences from original plan

- Full PWA runtime (service worker, offline caching) was deferred rather than completed in M0.
- Notification “foundation” is stubs only; persistence was deferred until auth (and remains deferred to Milestone 7).
- English locale files exist for future use; the app does not switch locales yet.

---

# Milestone 1 — Authentication and User Management

**Status: Completed**

## Goal

Enable users to access the system securely. Access is based on employee number (4 digits), mapped to a synthetic Supabase Auth email (`NNNN@task-manager.com`). Users never enter the domain.

Forgot / reset password is admin-managed in this milestone. Manager → subordinate reset arrives in Milestone 2.

Initial admin: employee `0000` with temporary password `0000`. New users get password = employee number and are forced to change it.

## Planned features

- Login, logout, session management, password reset (admin)
- Admin user CRUD, activate/deactivate, delete, assign roles (`admin`, `department_manager`, `employee`)
- Permission model, role permissions, API checks, basic RLS
- Employee profiles: name, phone, role, status

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Employee-number login / logout / session | **Completed** | Middleware + cookie sessions |
| Forced password change | **Completed** | `must_change_password` + allowlisted API routes |
| Admin user CRUD + activate/deactivate + delete | **Completed** | |
| Admin password reset | **Completed** | Resets to employee number; forces change |
| Roles + DB permissions + RLS helpers | **Completed** | `SECURITY DEFINER` helpers avoid RLS recursion |
| Employee directory / profile UI | **Completed** | `/employees`, `/employees/[id]` |
| Vitest coverage for auth/users/permissions | **Completed** | |

## Differences / additions vs original plan

- Compensating Auth ↔ profile transaction on create/reset (documented in DB spec).
- Password-change API allowlist while `must_change_password` is true.
- Employees UI is the user-management surface (not a separate “users admin” module name).

## Not implemented in M1 (by design)

- Manager password reset → **Completed in Milestone 2**
- Self-service forgot-password email flow → **Out of scope** (admin/manager reset only)

---

# Milestone 2 — Organization Structure

**Status: Completed**

## Goal

Create the company hierarchy.

## Planned features

- Departments: create, edit, assign managers, archive, delete (only when no current members)
- Memberships: add, remove, move, membership history
- Views: department list, employee directory, department details

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Department CRUD + archive + delete guard | **Completed** | `DEPARTMENT_HAS_MEMBERS` when current members exist |
| Manager assignment rules | **Completed** | One manager per dept; one managed dept per manager; role must already be `department_manager`; explicit replace flag |
| Memberships add / remove / move | **Completed** | History preserved via `is_current` / `end_date` |
| Membership history UI | **Completed** | History tab; API `includeHistory` is **admin-only** |
| Department list + detail views | **Completed** | |
| Manager scoped password reset | **Completed** | Current members of managed department |
| M2 permissions + RLS helpers | **Completed** | |

## Differences / additions vs original plan

- Manager assignment does **not** auto-promote role; candidate must already be `department_manager`.
- Membership history listing via API is restricted to admins (managers see current members).
- Employee directory is shared with M1 users UI and permission-gated.

---

# Milestone 3 — Projects and Tasks

**Status: Completed**

## Goal

Introduce core work management functionality.

## Planned features

- Projects: admin create/edit/dates/priority/archive; assign members
- Department managers: view department projects; manage members and tasks (not project entity create/edit/archive)
- Tasks: create, assign, dates, priority, estimated hours, status
- One level of subtasks
- Views: task list, task details, Kanban board

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Projects CRUD-ish (archive via status) | **Completed** | No permanent project delete API |
| Project members (dept members only) | **Completed** | |
| Tasks + one-level subtasks | **Completed** | Parent estimated hours = sum of subtasks |
| Task list / detail / project Kanban | **Completed** | Kanban at `/projects/[id]/board` |
| Permissions | **Completed** | `project.view` all roles (scoped); `project.manage` **admin only**; managers get `task.create` / `task.assign` |
| RLS helpers | **Completed** | `can_access_project`, `can_access_task`, `is_project_member` |
| Inline list editing, expandable subtasks, breadcrumbs, tabs | **Completed** | Product/UX additions beyond original M3 bullet list (see project rules) |

## Differences / additions vs original plan

- Priority enum: `low | medium | high`.
- Project statuses: `draft | active | completed | archived`.
- Task statuses originally included `review` and `cancelled` in the M3 migration; simplified in M4 follow-up to `todo | in_progress | blocked | completed`.
- `progress_percentage` exists on `tasks` but is **unused** in UI/business logic (retained for possible future progress/Gantt).
- Activity logs, dependencies, and workload were **Deferred to Milestone 4** (as noted during M3).
- Comments and attachments remain **Out of scope** for M3–M4 (future).

## Migrations

- `20260725140000_milestone3_projects_tasks.sql`
- `20260725141000_milestone3_project_manage_admin_only.sql`

---

# Milestone 4 — Task Management Intelligence

**Status: Completed**

## Goal

Improve planning and execution via dependencies, workload visibility, and activity history.

## Planned features

- Finish-to-start task dependencies (task/subtask cannot start before dependencies complete)
- Employee workload view before assigning (active task count + estimated hours)
- Task activity history (assignment, status, updates)

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Finish-to-start dependencies | **Completed** | Same project; hierarchy rules (root↔root, sibling subtasks); cycle/self guards |
| Incomplete deps → `blocked` + status lock | **Completed** | Stronger than original “cannot start” wording; dependents unlock to `todo` when satisfied |
| Workload at assignment time | **Completed** | `GET /api/users/[id]/workload` + assignee UI hint (not a standalone `/workload` page) |
| Activity history | **Completed** | `activity_logs` + task detail panel; create/assign/status/update/dependency events |
| Task status simplification | **Completed** | Dropped `review` / `cancelled` |

## Differences / additions vs original plan

- Workload is an **inline hint when choosing an assignee**, not a separate employee workload screen.
- Dependency rules include explicit hierarchy constraints and auto-`blocked` locking (documented in API spec).
- Status set simplified post-ship via follow-up migration.

## Migrations

- `20260725150000_milestone4_dependencies_activity.sql`
- `20260725151000_milestone4_simplify_task_statuses.sql`

## Testing gap

Dependency unit tests exist; dedicated workload and activity-log tests are thin (**Partially completed** relative to the testing strategy table).

---

# Milestone 5 — Attendance and Work Logging

**Status: Completed**

## Goal

Track employee time and effort.

## Planned features

- Clock in / clock out, daily records, total hour calculation
- Manager/admin approve / reject (with reason); no self-approval
- Work logs against tasks; managers review

## Implementation status

| Area | Status | Notes |
|---|---|---|
| One record per user/day + clock in/out | **Completed** | `UNIQUE (user_id, date)`; open = `clock_out IS NULL` |
| Total hours calculation | **Completed** | Minus break; org timezone `Asia/Riyadh` |
| Approve / reject | **Completed** | Scoped managers; cannot act on open or own records |
| Rejected employee correction | **Completed** | Same row → pending; clears approval fields |
| Admin time corrections | **Completed** | Managers cannot edit timestamps/break |
| Work logs CRUD + review lists | **Completed** | Independent of attendance hours; `approved_by` unused |
| `/attendance` RTL UI (tabs) | **Completed** | Today / Records / Approvals / Work logs |
| Vitest coverage | **Completed** | Hours math, approve assert, lifecycle locks |

## Migrations

- `20260725160000_milestone5_attendance_work_logs.sql`

## Differences / notes

- Work logs have **no** approve/reject workflow in M5 (review via list only).
- No coupling between work-log hours and attendance totals.
- UI states derived from `status` + `clock_out` (currently working / awaiting approval / approved / rejected).

---

# Milestone 6 — Leave and Employee Requests

**Status: Completed**

## Goal

Handle employee workflows.

## Leave Management

Support:

- Leave types
- Leave balances
- Leave requests
- Approval workflow

## Employee Requests

### Task Extension Request

Employee requests a new deadline; manager approves or rejects.

### Task Excusal Request

Employee requests removal from a task; manager approves or rejects.

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Leave types (soft deactivate) | **Completed** | Admin manage; DELETE → `is_active = false` |
| Yearly balances | **Completed** | Admin allocate; remaining shown with pending |
| Working-day leave math | **Completed** | Inclusive; Fri–Sat off; Asia/Riyadh; same calendar year |
| Submit / approve balance gates | **Completed** | Atomic RPCs; approve uses `allocated − used` only |
| Extension / excusal | **Completed** | Task detail create; atomic approve + activity |
| `/leave` + `/approvals` RTL UI | **Completed** | Central approvals tabs for leave / extensions / excusals |
| Seed-dev M6 scenarios | **Completed** | Types, balances, pending/approved/rejected, requests |
| Vitest | **Completed** | Working days, schemas, permissions, approve asserts |

## Migrations

- `20260725170000_milestone6_leave_employee_requests.sql`

## Differences / notes

- No cancel of leave (pending or approved) in M6.
- No public holidays; no half-days.
- Notifications for approvals deferred to Milestone 7.
- Attendance approvals remain on `/attendance`.

---

# Milestone 7 — Communication

**Status: Completed** (in-app; attachments + Web Push deferred)

## Goal

Improve internal communication.

## Announcements

Support:

- Company announcements
- Department announcements
- Priority levels
- Attachments — **Deferred** (no Storage upload in M7)
- Read tracking

## Notifications

Support:

Events:

- Task assigned
- Task completed
- Approval required
- Approval result
- Announcement published

Channels:

- In-app notifications — **Completed**
- Push notifications — **Deferred** (VAPID stubs retained)

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Announcements CRUD + soft unpublish | **Completed** | Admin company/any dept; manager own dept |
| Read tracking | **Completed** | `announcement_reads` |
| Priority `low \| medium \| high` | **Completed** | |
| In-app notifications table + APIs | **Completed** | + `entity_type` / `entity_id` deep links |
| Header bell + `/notifications` | **Completed** | Unread badge; mark read / read-all |
| Event hooks | **Completed** | Tasks, leave, employee requests, attendance, announcements |
| Seed-dev M7 scenarios | **Completed** | Company/dept/expired announcements + sample notifications |
| Vitest | **Completed** | Schemas, permission codes, href helper |
| Announcement attachments | **Deferred** | Roadmap asked for files; Storage table deferred |
| Web Push delivery | **Deferred** | Keep VAPID env; no SW / `web-push` |

## Migrations

- `20260725180000_milestone7_announcements_notifications.sql`

## Differences / notes

- File attachments for announcements deferred (document + roadmap).
- Web Push deferred; in-app channel fulfills M7 notification product for now.
- Notification failures never roll back the primary business action.

---

# Milestone 8 — Dashboards and Reporting

**Status: Completed**

## Goal

Provide operational visibility.

## Admin Dashboard

Show:

- Departments
- Active projects
- Employees
- Pending approvals
- Company workload

## Manager Dashboard

Show:

- Department projects
- Overdue tasks
- Team workload
- Pending approvals

## Employee Dashboard

Show:

- Assigned tasks
- Upcoming deadlines
- Attendance summary
- Requests

## Reports

Initial reports:

- Task completion
- Employee workload
- Attendance summary
- Work log summary

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Role dashboards on `/` | **Completed** | Action-oriented cards + lists; deep links |
| Pending approvals breakdown | **Completed** | Leave + extension + excusal + attendance; links to `/approvals` and `/attendance` |
| `/reports` tabbed tables | **Completed** | Four reports; admin/manager only (`report.view`) |
| Report APIs | **Completed** | Paginated aggregates; default date range = current month Asia/Riyadh |
| Charts / export / scheduling | **Out of scope** | Deferred (Advanced Analytics / future) |

## Migrations

- `20260725190000_milestone8_dashboards_reporting.sql` (permission seed only)

## Differences / notes

- No new business tables; reporting queries existing data.
- Reports include historical rows (including archived projects where relevant); dashboard “active” metrics exclude archived.
- Employees do not see Reports nav.

---

# Milestone 9 — Advanced Views

**Status: Remaining**

## Goal

Provide advanced planning tools.

## Gantt Chart

Support:

- Timeline visualization
- Task duration
- Dependencies
- Overdue indicators

## Advanced Filtering

Support:

- Date ranges
- Employees
- Departments
- Projects
- Status

---

# Milestone 10 — Future Enhancements

**Status: Out of scope** (not part of MVP)

Possible additions:

- Task comments and attachments

---

# Deferred from M0–M4 (carry-forward)

| Item | Originally in | Deferred to |
|---|---|---|
| Service worker / offline caching | M0 PWA | Later PWA milestone (`next-pwa` removed until then) |
| Notifications table, APIs, real center, push | M0 foundation | Milestone 7 (in-app **Completed**; Web Push still deferred) |
| Announcement file attachments | Milestone 7 roadmap | Later / Storage |
| Web Push delivery + service worker | Milestone 7 roadmap | Later PWA milestone |
| Dashboard content | Shell in M0 | **Completed in Milestone 8** |
| Task comments / attachments | DB design (not M3/M4 scope) | Future |
| `progress_percentage` UI | Schema present | Future / unused |
| Playwright E2E | After workflows exist | After M5+ workflows |
| Locale switcher (`en`) | Localization future | Future |

---

# Development Rules

## Each milestone must:

- Have database migrations
- Have updated documentation
- Include required permissions
- Include loading/error states
- Support RTL
- Work on mobile

---

# Recommended Build Order

1. Foundation — **Partially completed** (core done; PWA/notifications deferred)
2. Authentication — **Completed**
3. Organization — **Completed**
4. Projects — **Completed**
5. Tasks — **Completed**
6. Dependencies and workload — **Completed**
7. Attendance — **Completed (Milestone 5)**
8. Leave — **Completed (Milestone 6)**
9. Communication — **Completed (Milestone 7; push/attachments deferred)**
10. Reports — **Completed (Milestone 8)**
11. Gantt — **Remaining (Milestone 9)**
