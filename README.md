# Work Management Platform

Arabic-first, RTL work management platform for organizations. Built with Next.js and Supabase as a Progressive Web App.

## Current status

**Milestones 0–6** are implemented for core product scope. **Next: Milestone 7 — Communication (announcements + notifications).**

| Milestone | Status |
|---|---|
| 0 — Foundation | Partial (core done; full PWA offline + notifications deferred to M7) |
| 1 — Auth & users | Completed |
| 2 — Departments | Completed |
| 3 — Projects & tasks | Completed |
| 4 — Dependencies, workload, activity | Completed |
| 5 — Attendance & work logs | Completed |
| 6 — Leave & employee requests | Completed |
| 7 — Communication | Remaining |
| 8 — Dashboards & reports | Remaining |

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

### What is intentionally not built yet

- In-app / push **notifications** and announcements → Milestone 7
- Rich **dashboards & reports** → Milestone 8
- Gantt / advanced filters → Milestone 9
- Task comments & attachments → future
- Offline PWA service worker → deferred

---

## Quick start

1. Install [Node.js 22+](https://nodejs.org/)
2. Install dependencies: `npm install`
3. Copy env: `cp .env.example .env.local` and fill Supabase values for **your** project
4. Log in to Supabase CLI: `npm run supabase:login`
5. Link the project: `npm run supabase:link` (same project as `.env.local`)
6. Push migrations: `npm run supabase:db:push`
7. Seed admin: `npm run seed:admin` (employee `0000` / password `0000`)
8. Optional QA dataset: `npm run seed:dev` (deterministic M1–M6 users and scenarios)
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
npm run seed:dev         # Deterministic M1–M6 QA dataset (idempotent)
```
