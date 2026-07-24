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

Examples:

- Tasks
- Employees
- Notifications
- Reports

Do not load unlimited records.

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