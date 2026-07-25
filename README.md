# Work Management Platform

Arabic-first, RTL work management platform for organizations. Built with Next.js and Supabase as a Progressive Web App.

## Current status

**Milestones 0–9** are implemented for core product scope (Gantt, advanced filters, task comments/attachments).

| Milestone | Status |
|---|---|
| 0 — Foundation | Partial (core done; full PWA offline + Web Push still deferred) |
| 1 — Auth & users | Completed |
| 2 — Departments | Completed |
| 3 — Projects & tasks | Completed |
| 4 — Dependencies, workload, activity | Completed |
| 5 — Attendance & work logs | Completed |
| 6 — Leave & employee requests | Completed |
| 7 — Communication | Completed (attachments + Web Push deferred) |
| 8 — Dashboards & reports | Completed |
| 9 — Advanced views | Completed |

---

## How the product works (client overview)

This section explains the live business rules as implemented — useful when walking stakeholders through the system.

### Organization model

- **One organization** per deployment (no multi-tenant org switcher).
- Hierarchy: **Company → Department → Project → Task → (optional) one-level Subtask**.
- Roles:
  - **Admin** — org-wide configuration and overrides
  - **Department manager** — scoped to the department they manage
  - **Employee** — own work, attendance, leave, and requests

### Authentication (M1)

- Login with a **4-digit employee number** (never an email in the UI). Internally mapped to `NNNN@task-manager.com`.
- New users get password = employee number and must change it on first login.
- Admins (and managers for their department members) can reset passwords; reset forces another password change.
- Deactivated users cannot sign in.

### Departments & memberships (M2)

- Departments have at most **one manager**.
- A manager manages **at most one** department; their role must already be `department_manager` (no auto-promotion).
- Membership history is preserved (`is_current` / end dates). Employees have at most one current department.

### Projects & tasks (M3–M4)

- **Admins** create/edit/archive projects and assign project members (members must belong to the project’s department).
- **Managers** manage members and tasks on department projects; they do **not** create/archive the project entity.
- Tasks: status `todo | in_progress | blocked | completed`, priority `low | medium | high`, optional dates and estimated hours.
- **One level of subtasks** only. Parent estimated hours = sum of subtasks.
- **Finish-to-start dependencies**: a task/subtask cannot progress while incomplete dependencies block it (status can lock to `blocked`).
- Assignee **workload hint** (active task count + estimated hours) appears when assigning — not a separate workload page.
- Task **activity history** records create/assign/status/update/dependency events.

### Attendance & work logs (M5)

- One attendance record per employee per calendar day (`Asia/Riyadh`).
- Clock in / clock out; total hours = elapsed time minus break minutes.
- After clock-out, status is **pending** until manager/admin approves or rejects (with reason).
- **No self-approval.** Managers approve only current members of their department; admins can approve anyone except themselves.
- Rejected records can be corrected by the employee and return to pending; admins can correct timestamps.
- **Work logs** record hours against tasks independently of attendance totals. There is **no** work-log approve/reject workflow in M5 (list/review only). Attendance approvals stay on `/attendance` (not moved to the central approvals page).

### Leave (M6)

- **Leave types** (e.g. Annual, Sick, Emergency) are managed by **admins only**. Deleting a type **deactivates** it (`is_active = false`); history is kept; inactive types cannot be used for new requests.
- **Yearly balances** per employee / type / year: `allocated_days` and `used_days`. Admins allocate balances.
- Employees and managers can **request** leave; they cannot manage types or allocations.
- Leave days = **inclusive working days** in `Asia/Riyadh`. **Friday and Saturday** are weekend (excluded). No public-holiday calendar in M6.
- Requests must stay within **one calendar year** (start and end same year).
- On **submit**, available balance = `allocated − used − pending_requested_days`. Requests that exceed remaining balance are blocked.
- On **approve**, balance is re-checked atomically: requires `allocated − used ≥ request.days`. If insufficient, approval **fails** and the request **stays pending**.
- `used_days` increases only when a request is approved. No cancellation of approved leave in M6 (`pending → approved | rejected` only).
- Overlapping pending/approved leave for the same person is blocked.
- Submit and approve mutations run in **database transactions (RPCs)** so concurrent requests cannot overdraw balances. Authorization stays in the application layer.

### Task extension & excusal (M6)

- Only the **current assignee** can request:
  - **Extension** — propose a new due date (≥ today in Riyadh; must be **strictly after** current due date if one exists).
  - **Excusal** — request removal from the task.
- One **pending** request per person / task / type.
- Approvers: **requester’s department manager** or **admin**; no self-approval; approver does **not** need extra project access.
- On **extension approve**: task `due_date` is updated to the requested date (even if the original due date already passed while waiting).
- On **excusal approve**: `assigned_to` is cleared **only if** the requester is still the assignee; otherwise the request is still approved without changing the assignee.
- Request status, task change, and activity log are updated in **one atomic transaction**.

### Approvals UX (M6)

| Page | Purpose |
|---|---|
| `/leave` | My leave requests, balances; admins also manage types/allocations |
| `/approvals` | Central queue: Leave · Task extensions · Task excusals (extensible for future types) |
| Task detail | Create extension/excusal when you are the assignee |
| `/attendance` | Attendance clocking + attendance-specific approvals (unchanged) |

### Communication (M7)

- **Announcements** at `/announcements`:
  - Audience: **company** (all active users) or **department** (current members of that department).
  - Priority: `low | medium | high` (high is visually distinct).
  - **Admins** publish company-wide or for any department; **department managers** publish only for the department they manage.
  - Employees can view announcements in their audience and **mark as read** (`announcement_reads`).
  - **Unpublish** sets `expires_at` to now (soft expire); history remains listable under expired/all filters.
  - **No file attachments** in M7 (deferred).
- **In-app notifications** at `/notifications` and the header **bell** (unread badge):
  - Types: `task_assigned`, `task_completed`, `approval_request`, `approval_result`, `announcement`.
  - Fired (best-effort) when: a task is assigned or completed; leave / task extension-excusal / attendance is submitted for approval or decided; an announcement is published.
  - Recipients: assignee (assign); task creator (complete); department manager + admins (approval requests); requester (approval results); announcement audience (publish). Actor is excluded where applicable.
  - Deep links via `entity_type` / `entity_id` → task, leave, approvals, attendance, or announcements pages.
  - Users can mark one or all as read. Notification insert failures **never** roll back the primary business action.
- **Web Push** is **not** delivered in M7 (VAPID env keys remain unused stubs).

### Dashboards & reports (M8)

- **Home `/`** is role-specific and action-oriented (summary metrics + short lists with deep links):
  - **Admin** — department / active project / employee counts, pending approvals (leave, extensions, excusals, attendance), company workload.
  - **Manager** — department projects, overdue tasks, team workload, pending approvals (scoped).
  - **Employee** — assigned tasks, upcoming deadlines (14 days), month attendance summary, own requests.
- **Reports `/reports`** (admin + department manager; `report.view`):
  - Tabs: task completion, employee workload, attendance summary, work log summary.
  - Filterable paginated tables (default date range = current month `Asia/Riyadh`).
  - No charts, export, or scheduled jobs in M8.

### Advanced views (M9)

- **Gantt** at `/projects/[id]/gantt` — timeline bars, dependency lines, overdue highlighting; linked from project detail.
- **Advanced filters** on `/tasks` — department, assignee, priority, due date range (plus status/project/mine).
- **Task comments** and **attachments** on task detail tabs; files in private Storage bucket `task-files` (signed download URLs).
- Task **progress %** is editable and shown on Gantt bars.

### What is intentionally not built yet

- Announcement **file attachments** and **Web Push** → deferred past M7
- Offline PWA service worker → deferred
- Global company-wide Gantt / drag-to-reschedule on Gantt

---

## Quick start

1. Install [Node.js 22+](https://nodejs.org/)
2. Install dependencies: `npm install`
3. Copy env: `cp .env.example .env.local` and fill Supabase values for **your** project
4. Log in to Supabase CLI: `npm run supabase:login`
5. Link the project: `npm run supabase:link` (same project as `.env.local`)
6. Push migrations: `npm run supabase:db:push`
7. Seed admin: `npm run seed:admin` (employee `0000` / password `0000`)
8. Optional QA dataset: `npm run seed:dev` (deterministic M1–M9 users and scenarios)
9. Run: `npm run dev`

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
npm run seed:dev         # Deterministic M1–M7 QA dataset (idempotent)
```
