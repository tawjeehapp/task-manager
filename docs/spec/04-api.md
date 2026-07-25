# API Specification

## Overview

The application uses Next.js API Routes as the API layer.

The API layer is responsible for:

- Authentication checks
- Request validation
- Permission verification
- Business rule execution
- Database operations
- Response formatting

The API layer provides a consistent boundary between the frontend and backend.

---

# Architecture

The API request flow:

```
Client Component

        |

TanStack Query

        |

API Route

        |

Validation

        |

Permission Check

        |

Service Layer

        |

Supabase

        |

PostgreSQL
```

---

# API Location

All API routes live under:

```
app/api/
```

Example:

```
app/api/projects/route.ts

app/api/projects/[id]/route.ts

app/api/tasks/route.ts
```

---

# HTTP Methods

Use standard HTTP methods.

## GET

Retrieve data.

Examples:

```
GET /api/projects

GET /api/tasks
```

---

## POST

Create resources.

Examples:

```
POST /api/projects

POST /api/tasks
```

---

## PATCH

Update resources.

Examples:

```
PATCH /api/tasks/:id
```

---

## DELETE

Delete resources.

Restricted to authorized users.

Requires:

- Permission validation
- Impact analysis where required
- Confirmation from frontend

---

# Response Format

All API responses follow a consistent structure.

---

## Success Response

Example:

```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Project"
  }
}
```

---

## Error Response

Example:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Project name is required"
  }
}
```

---

# HTTP Status Codes

Use standard status codes.

## 200

Successful request.

---

## 201

Resource created.

---

## 400

Invalid request.

Examples:

- Missing fields
- Invalid values

---

## 401

Not authenticated.

---

## 403

Authenticated but not authorized.

---

## 404

Resource not found.

---

## 409

Conflict.

Examples:

- Duplicate records
- Invalid state transitions

---

## 500

Unexpected server error.

---

# Authentication

Authentication uses Supabase Auth.

Every protected API route must:

1. Validate the user session.
2. Retrieve the application user.
3. Verify permissions.

Example:

```
Request

↓

Supabase Session

↓

Application User

↓

Permission Check

↓

Continue
```

---

# Authorization

Authorization has two levels.

---

# Level 1: Database Security

Handled through:

- Supabase RLS

Responsible for:

- Row visibility
- Data isolation

---

# Level 2: Application Permissions

Handled in services.

Responsible for:

- Business decisions
- Allowed actions

Examples:

Can user:

- Assign tasks?
- Approve attendance?
- Delete a project?
- Publish announcements?

---

# Permission Checking

Permission checks should use reusable functions.

Example:

```
hasPermission(
 user,
 "task.assign"
)
```

Avoid:

```
if role === manager
```

throughout the codebase.

---

# Validation

All API inputs must be validated.

Use:

- Zod schemas

Example:

```
CreateProjectSchema

UpdateTaskSchema

CreateLeaveRequestSchema
```

Validation happens before:

- Database operations
- Business logic

---

# Service Layer

Business logic belongs in services.

Structure:

```
features/

projects/

    services/

        create-project.ts
        update-project.ts
        delete-project.ts
```

Services handle:

- Business rules
- Database operations
- Permission-related checks

---

# Example Flow

Creating a task:

```
POST /api/tasks

        |

Validate request

        |

Check permission

        |

Verify project access

        |

Create task

        |

Create activity log

        |

Return response
```

---

# Database Access

Components should never directly access Supabase.

Bad:

```
Component

↓

Supabase
```

Good:

```
Component

↓

API / Data Function

↓

Service

↓

Supabase
```

---

# Server Component Data Access

Server Components may use server-side data functions.

Example:

```
Page

↓

getProjects()

↓

Project Service

↓

Supabase
```

This avoids unnecessary HTTP calls.

---

# TanStack Query Usage

TanStack Query is used for:

- Client-side fetching
- Mutations
- Caching
- Optimistic updates

---

# Query Naming

Query keys should be consistent.

Examples:

```
[
 "projects"
]

[
 "projects",
 projectId
]

[
 "tasks",
 {
   projectId
 }
]
```

---

# Mutations

All mutations should:

- Show loading state
- Handle errors
- Refresh affected queries

Example:

Create task:

```
Mutation

↓

Create task

↓

Invalidate tasks query

↓

Refresh UI
```

---

# Optimistic Updates

Use only when:

- Action is simple
- Failure handling is clear

Good candidates:

- Mark notification read
- Toggle completion

Avoid optimistic updates for:

- Approvals
- Payments
- Destructive actions

---

# Pagination

Large lists must support pagination.

Page size options:

```
25
50
100
```

Default page size: `25`.

Responses for list endpoints should include:

```
items
total
page
pageSize
totalPages
```

Examples:

- Tasks
- Employees
- Departments
- Notifications
- Reports

Do not load unlimited records.

List APIs should also support:

- Single-column sorting (`sortBy`, `sortDir`)
- Server-side filters relevant to the resource

---

# Filtering

Filtering should happen server-side.

Examples:

Tasks:

```
status
assignee
project
priority
date range
```

---

# Sorting

Sorting should happen server-side for large datasets.

---

# File Uploads

Files should:

1. Upload to Supabase Storage.
2. Save metadata in PostgreSQL.
3. Return attachment record.

Example:

```
Storage

task-files/project-id/file.pdf


Database

task_attachments
```

---

# Error Handling

Errors should be:

- Logged
- User-friendly
- Consistent

Never expose:

- Database errors
- Internal stack traces
- Sensitive information

---

# Audit Logging

Important mutations should create activity logs.

Examples:

- Task assignment
- Approval decision
- Delete action
- Permission changes

---

# Departments API (Milestone 2)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/departments` | `department.view` |
| POST | `/api/departments` | `department.manage` |
| GET | `/api/departments/[id]` | `department.view` (scoped) |
| PATCH | `/api/departments/[id]` | `department.manage` |
| DELETE | `/api/departments/[id]` | `department.manage` |
| GET | `/api/departments/[id]/members` | `department.view` (scoped) |
| POST | `/api/departments/[id]/members` | `department.manage` |
| DELETE | `/api/departments/[id]/members/[userId]` | `department.manage` |
| POST | `/api/departments/members/move` | `department.manage` |

Manager assignment on PATCH uses `managerId` and optional `replaceExistingManager`.

Notable error codes:

- `MANAGER_ALREADY_ASSIGNED` (409) — department already has a manager; replace not confirmed
- `INVALID_MANAGER_ROLE` (409) — candidate is not `department_manager`
- `MANAGER_ALREADY_HAS_DEPARTMENT` (409) — candidate already manages another department
- `HAS_CURRENT_MEMBERSHIP` (409) — user already belongs to a department
- `DEPARTMENT_ARCHIVED` (409) — mutation not allowed on archived department
- `DEPARTMENT_HAS_MEMBERS` (409) — cannot delete a department with current members

Password reset (`POST /api/users/[id]/reset-password`) requires `user.reset_password` and is scoped: admin any (except self); department manager only current members of their managed department.

---

# Projects and Tasks API (Milestone 3)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/projects` | `project.view` (scoped) |
| POST | `/api/projects` | `project.manage` |
| GET | `/api/projects/[id]` | `project.view` (scoped) |
| PATCH | `/api/projects/[id]` | `project.manage` (admin only; archive via `status`) |
| GET | `/api/projects/[id]/members` | `project.view` (scoped) |
| POST | `/api/projects/[id]/members` | `project.view` + service scope (admin or department manager) |
| DELETE | `/api/projects/[id]/members/[userId]` | `project.view` + service scope (admin or department manager) |
| GET | `/api/tasks` | `project.view` (scoped) |
| POST | `/api/tasks` | `task.create` |

Create body may include optional `dependsOnTaskIds: string[]` (same-project finish-to-start links created with the task).

| GET | `/api/tasks/[id]` | authenticated + access assert |
| PATCH | `/api/tasks/[id]` | assign/manage, or assignee status-only |

List filters:

- Projects: `status`, `departmentId`, `includeArchived`, pagination, sort
- Tasks: `projectId`, `status`, `assignee`, `priority`, `parentTaskId` (`null` = roots), `dueFrom`/`dueTo`, pagination, sort

Notable error codes:

- `PROJECT_NOT_FOUND` (404)
- `PROJECT_ARCHIVED` (409) — cannot create tasks on archived project
- `INVALID_PROJECT_MEMBER` (409) — member not in department
- `ALREADY_PROJECT_MEMBER` (409)
- `SUBTASK_DEPTH_EXCEEDED` (409) — only one subtask level
- `INVALID_ASSIGNEE` (409)
- `PARENT_TASK_NOT_FOUND` (404)
- `PARENT_PROJECT_MISMATCH` (409)

Permissions seeded in M3:

- `project.view` — admin, department_manager, employee
- `project.manage` — **admin only** (create/edit/archive project entity)
- `task.create` / `task.assign` — granted to department_manager (admin already had them)

Department managers manage members and tasks inside department projects via service-layer scope, not `project.manage`.

---

# Task Intelligence API (Milestone 4)

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/tasks/[id]/dependencies` | authenticated + task access |
| POST | `/api/tasks/[id]/dependencies` | `task.assign` or project manage scope |
| DELETE | `/api/tasks/[id]/dependencies/[dependencyId]` | `task.assign` or project manage scope |
| GET | `/api/tasks/[id]/activity` | authenticated + task access (paginated) |
| GET | `/api/users/[id]/workload` | `task.assign` |

Dependency rules (finish-to-start):

- Same project only; no self-edges; no cycles
- Root tasks may only depend on other **root** tasks (not subtasks)
- Subtasks may only depend on **sibling** subtasks under the same parent
- Status is forced to `blocked` while any dependency is incomplete; status changes are rejected (`STATUS_LOCKED_BY_DEPENDENCIES` 409)
- When prerequisites are satisfied, blocked dependents return to `todo`
- Adding an incomplete dependency forces the dependent task to `blocked`

Workload response:

```
{
  userId,
  activeTaskCount,
  estimatedHours
}
```

Active tasks = assigned tasks with status not `completed`.

Activity is written on task create, assign, status change, field updates, and dependency add/remove.

Notable error codes:

- `DEPENDENCIES_INCOMPLETE` (409)
- `STATUS_LOCKED_BY_DEPENDENCIES` (409)
- `DEPENDENCY_SELF` (409)
- `DEPENDENCY_CYCLE` (409)
- `DEPENDENCY_ROOT_ON_SUBTASK` (409)
- `DEPENDENCY_SUBTASK_SCOPE` (409)
- `DEPENDENCY_PROJECT_MISMATCH` (409)
- `DEPENDENCY_ALREADY_EXISTS` (409)
- `DEPENDENCY_INVALID_FOR_STATUS` (409)
- `DEPENDENCY_NOT_FOUND` (404)
- `DEPENDENCY_TASK_NOT_FOUND` (404)

---

# API Design Principles

The API should be:

- Predictable
- Secure
- Simple
- Consistent

Avoid:

- Random endpoints
- Business logic in controllers
- Direct database access from UI
- Duplicate validation