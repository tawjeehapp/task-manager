
# Database Specification

## Overview

The application uses PostgreSQL through Supabase.

The database design prioritizes:

- Clear ownership of data
- Strong relationships
- Historical accuracy
- Simple queries
- Secure access
- Future extensibility

The database should support:

- Departments
- Employees
- Projects
- Tasks
- Attendance
- Work logs
- Leave management
- Approvals
- Notifications
- Announcements
- Reporting

---

# Database Principles

## Single Organization

The MVP supports one organization.

The database should avoid unnecessary multi-tenant complexity.

However, table design should allow adding organization-level separation in the future without major restructuring.

---

# Data Ownership

Every table must define:

- Owner entity
- Access rules
- Delete behavior
- Historical requirements

---

# Historical Data Preservation

Business records should remain available after organizational changes.

Historical records include:

- Attendance
- Work logs
- Approvals
- Completed tasks
- Reports

Deleting a department or employee should not destroy business history.

---

# Archive Strategy

Business entities support archiving.

Archived records:

- Are hidden from normal views.
- Remain available in reports.
- Remain searchable where appropriate.

Entities supporting archive:

- Departments
- Projects
- Tasks
- Users

---

# Delete Strategy

Permanent deletion is restricted to administrators.

Before deletion:

The system must show:

- Records affected
- Related data
- Cascade effects

Example:

Deleting a project:

```
Project: Website Redesign

Will delete:

- 34 tasks
- 120 subtasks
- 45 comments
- 20 attachments

Will preserve:

- Employee accounts
- Attendance records
- Other projects
```

---

# Primary Keys

All tables use UUID primary keys.

Example:

```
id uuid primary key
```

---

# Common Columns

Most tables include:

```
id
created_at
updated_at
```

Timestamp format:

UTC.

---

# Core Entities

## Users

Represents all system users.

Users may be:

- Administrator
- Department Manager
- Employee

Table:

```
users
```

Fields:

```
id
auth_user_id
employee_number
full_name
email
phone
avatar_url
role
is_active
must_change_password
created_at
updated_at
```

Notes:

- Authentication is handled by Supabase Auth.
- Application user profile data is stored separately.
- Login uses a 4-digit `employee_number`, mapped to a synthetic Auth email `{employee_number}@task-manager.com`.
- `must_change_password` forces a password change after first login or admin reset.
- Temporary initial password equals the employee number and must never be returned by APIs.
- Auth user + profile creation is a compensating transaction (create Auth → create profile → delete Auth if profile fails).

### RLS helpers (users)

Policies on `users` must not query `users` under RLS to resolve the caller's role (recursion risk).

Use `SECURITY DEFINER` helpers:

- `current_user_id()`
- `current_user_role()`
- `is_admin()`

---

# Roles

Initial roles:

```
admin
department_manager
employee
```

---

# Departments

Represents organizational departments.

Table:

```
departments
```

Fields:

```
id
name
description
manager_id
status
created_at
updated_at
```

Status:

```
active
archived
```

Constraints (Milestone 2):

- At most one manager per department (`manager_id` on the row).
- At most one managed department per manager (unique partial index on `manager_id WHERE manager_id IS NOT NULL`).
- Assigning `manager_id` does **not** change `users.role`. The user must already have role `department_manager`.
- Replacing an existing manager requires an explicit replace flag in the API (no silent overwrite).
- Clearing `manager_id` does not change the user’s role.

---

# Department Memberships

Employees can move between departments.

Department membership history must be preserved.

Table:

```
department_memberships
```

Fields:

```
id
department_id
user_id
start_date
end_date
is_current
created_at
```

Rules:

- A user can have multiple historical memberships.
- Only one active membership at a time (unique partial index on `user_id WHERE is_current = true`).
- A user may temporarily have no department.
- Removing a membership ends the row (`is_current = false`, `end_date` set) and never deletes the user account.
- Moving between departments closes the current membership and inserts a new current row.
- Membership mutations do not change `users.role`.

RLS helpers (SECURITY DEFINER):

- `is_department_manager()`
- `manages_department(dept_id)`
- `is_current_member_of(dept_id)`
- `current_department_id()`
- `shares_managed_department_with(target_user_id)`

---

# Projects

Projects belong to departments.

Table:

```
projects
```

Fields:

```
id
department_id
name
description
status
priority
start_date
end_date
created_by
created_at
updated_at
```

Status:

```
draft
active
completed
archived
```

Priority (Milestone 3):

```
low
medium
high
```

Constraints (Milestone 3):

- Projects belong to one department.
- Archive via `status = archived` (no permanent delete API in M3).
- RLS helper: `can_access_project(project_id)` — admin, department manager of owning department, or project member.

---

# Project Members

Defines project participation.

Table:

```
project_members
```

Fields:

```
id
project_id
user_id
created_at
```

Constraints:

- Unique `(project_id, user_id)`
- Members must be current members of the project's department (enforced in services).

---

# Tasks

Tasks belong to projects.

Table:

```
tasks
```

Fields:

```
id
project_id
parent_task_id
title
description
status
priority
assigned_to
created_by
start_date
due_date
estimated_hours
progress_percentage
completed_at
created_at
updated_at
```

Notes:

- parent_task_id supports one level of subtasks.
- Tasks can exist without subtasks.
- Tasks belong to one project.
- Priority: `low | medium | high`
- `progress_percentage` exists (default 0); not exposed in M3 UI.
- RLS helper: `can_access_task(task_id)` — project access or assignee.

---

# Task Status

Initial statuses:

```
todo
in_progress
blocked
review
completed
cancelled
```

---

# Task Dependencies

Supports Finish → Start dependencies.

Table:

```
task_dependencies
```

Fields:

```
id
task_id
depends_on_task_id
created_at
```

Rules:

A task cannot:

- Start before dependencies complete.
- Complete before dependencies complete.

**Milestone note:** `task_dependencies` is implemented in Milestone 4 (not created in M3 migration).

---

# Task Comments

Table:

```
task_comments
```

Fields:

```
id
task_id
user_id
content
created_at
updated_at
```

---

# Task Attachments

Table:

```
task_attachments
```

Fields:

```
id
task_id
uploaded_by
file_name
storage_path
created_at
```

Files stored in Supabase Storage.

---

# Attendance

Tracks employee clock-in and clock-out.

Table:

```
attendance_records
```

Fields:

```
id
user_id
date
clock_in
clock_out
break_minutes
total_hours
status
approved_by
approved_at
rejection_reason
created_at
updated_at
```

Status:

```
pending
approved
rejected
```

---

# Work Logs

Tracks time spent on tasks.

Different from attendance.

Table:

```
work_logs
```

Fields:

```
id
user_id
task_id
date
hours
description
approved_by
created_at
updated_at
```

---

# Leave Management

## Leave Types

Table:

```
leave_types
```

Fields:

```
id
name
description
created_at
```

Examples:

- Annual
- Sick
- Emergency

---

## Leave Balances

Table:

```
leave_balances
```

Fields:

```
id
user_id
leave_type_id
allocated_days
used_days
year
created_at
updated_at
```

---

## Leave Requests

Table:

```
leave_requests
```

Fields:

```
id
user_id
leave_type_id
start_date
end_date
days
reason
status
approved_by
approved_at
created_at
updated_at
```

Status:

```
pending
approved
rejected
cancelled
```

---

# Employee Requests

Supports:

- Task extension
- Task excusal

Table:

```
employee_requests
```

Fields:

```
id
user_id
task_id
type
reason
requested_date
status
reviewed_by
reviewed_at
created_at
updated_at
```

Types:

```
extension
excusal
```

---

# Announcements

Company or department announcements.

Table:

```
announcements
```

Fields:

```
id
title
content
audience_type
department_id
priority
publish_at
expires_at
created_by
created_at
updated_at
```

Audience:

```
company
department
```

---

# Announcement Reads

Tracks acknowledgement.

Table:

```
announcement_reads
```

Fields:

```
id
announcement_id
user_id
read_at
```

---

# Notifications

Table:

```
notifications
```

Fields:

```
id
user_id
type
title
message
read_at
created_at
```

Types include:

```
task_assigned
task_completed
approval_request
approval_result
announcement
```

---

# Activity Logs

Tracks important actions.

Table:

```
activity_logs
```

Fields:

```
id
user_id
action
entity_type
entity_id
metadata
created_at
```

---

# Permission Tables

Future-proof permission system.

Tables:

```
permissions

role_permissions
```

Example:

```
task.assign

leave.approve

attendance.approve
```

---

# Database Indexing

Indexes should exist for:

Frequently filtered fields:

- user_id
- department_id
- project_id
- task_id
- status
- created_at
- due_date

---

# Row Level Security

RLS is responsible for:

- Preventing unauthorized data access.
- Enforcing ownership boundaries.

Business workflows remain in the API/service layer.

---

# Database Triggers

Use triggers only for:

- Automatic timestamps
- Maintaining counters
- Data integrity

Avoid putting business workflows inside triggers.
