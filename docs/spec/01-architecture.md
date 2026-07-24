# Architecture Specification

## Overview

The Work Management Platform is built as a modern full-stack web application using Next.js and Supabase.

The architecture prioritizes:

- Simplicity
- Maintainability
- Security
- Performance
- Future extensibility

The application uses Supabase as the primary backend platform and avoids introducing unnecessary backend infrastructure.

---

# High-Level Architecture

The system consists of:

- Next.js frontend application
- Supabase backend platform
- PostgreSQL database
- Supabase Authentication
- Supabase Storage
- Supabase Realtime

Architecture:

```
                    Users
                      |
                      |
                Next.js Application
                      |
        ┌─────────────┴─────────────┐
        |
 Server Components              Client Components
        |                              |
        |                              |
 Data Access Layer              API Routes
        |                              |
        └─────────────┬────────────────┘
                      |
              Service Layer
                      |
                  Supabase
                      |
     ┌────────────────┼────────────────┐
     |
 PostgreSQL       Auth              Storage
```

---

# Technology Decisions

## Backend

Supabase is the only backend platform.

Supabase provides:

- PostgreSQL database
- Authentication
- Storage
- Realtime capabilities
- Row Level Security

No separate backend framework is used.

---

# Frontend Architecture

## Framework

Next.js using the App Router.

The application uses:

- Server Components by default
- Client Components only when required
- API Routes for client-side operations and external access

---

# Server Components

Server Components are the default approach.

They should be used for:

- Dashboard pages
- Data tables
- Reports
- Project pages
- Task pages
- User pages
- Department pages

Benefits:

- Smaller client bundles
- Better performance
- Better initial loading
- Reduced browser complexity

---

# Client Components

Client Components should only be used when browser interaction is required.

Examples:

- Drag and drop Kanban boards
- Rich text editors
- File upload interfaces
- Date pickers
- Interactive charts
- Real-time notification widgets
- Complex forms

Client Components should not be used simply because a component displays data.

---

# Server Actions

Server Actions are not used.

All mutations should happen through:

- API Routes
- Service functions

Reasons:

- Clear API boundaries
- Easier future mobile application support
- Better separation of concerns
- Easier debugging

---

# Data Access Pattern

The application uses a layered approach.

## Server-side reads

Example:

```
Page
 |
Data Access Function
 |
Service
 |
Supabase
```

Used for:

- Initial page rendering
- Server-side data fetching

---

## Client-side operations

Example:

```
Client Component
 |
TanStack Query
 |
API Route
 |
Service
 |
Supabase
```

Used for:

- Interactive updates
- Mutations
- Dynamic refreshes
- Optimistic updates

---

# Folder Architecture

The application follows feature-based organization.

Example:

```
src/

app/
    dashboard/
    projects/
    tasks/

features/

    projects/
        components/
        services/
        queries/
        mutations/
        schemas/
        types/

    tasks/
        components/
        services/
        queries/
        mutations/
        schemas/
        types/

lib/

    supabase/
    auth/
    permissions/

components/

    ui/
    shared/
```

---

# Business Logic

Business rules should not live inside UI components.

Business logic belongs in:

- Service layer
- Validation layer
- Database constraints where appropriate

Example:

Bad:

```
Button component

if user is manager:
   allow approval
```

Good:

```
UI

↓

API

↓

Permission Check

↓

Business Rule

↓

Database
```

---

# Security Model

Security uses multiple layers.

## Layer 1: Authentication

Supabase Auth handles:

- Login
- Sessions
- Password management
- User identity

---

## Layer 2: Row Level Security

RLS protects database access.

RLS answers:

"Can this user access this record?"

Examples:

Employee:

Can access:

- Own tasks
- Own attendance
- Own requests

Department Manager:

Can access:

- Department employees
- Department projects
- Department tasks

Administrator:

Can access:

- Organization data

---

## Layer 3: Application Permissions

Business rules are enforced in the application layer.

Examples:

- Can this employee request task extension?
- Can this manager approve this leave?
- Can this user assign this task?
- Can this user create a department?

These rules should not become complex RLS policies.

---

# Permissions Model

The system uses role-based permissions.

Core roles:

- Administrator
- Department Manager
- Employee

Permissions are represented separately from roles.

Example:

```
Permission

task.create

task.assign

attendance.approve

leave.approve
```

Roles receive permissions.

This allows future expansion without rewriting authorization logic.

---

# Realtime Strategy

Supabase Realtime is used selectively.

## Realtime Features

Use realtime for:

- Notifications
- Announcements
- Approval updates

---

## Non-Realtime Features

Do not use realtime by default for:

- Dashboards
- Reports
- Task lists
- Large tables

These should use normal queries.

---

# Data Fetching

TanStack Query is used for client-side server state.

Used for:

- API requests
- Caching
- Mutations
- Optimistic updates
- Refreshing stale data

Server Components may fetch directly without TanStack Query.

---

# State Management

No global client state library is used initially.

Avoid:

- Redux
- Zustand
- Global stores

Use:

- Server state → TanStack Query
- Form state → React Hook Form
- Local UI state → React state

Introduce global state only when a clear need exists.

---

# File Storage

Supabase Storage is used for:

- Task attachments
- Announcement attachments
- User avatars

Files should not be stored directly in PostgreSQL.

---

# Background Processes

Background jobs may be introduced later for:

- Weekly reports
- Scheduled notifications
- Reminder messages

Initial implementation may use:

- Supabase scheduled functions
- External cron services

---

# Localization

The application is Arabic-first.

Requirements:

- RTL by default
- Arabic translations
- Localized dates
- Localized numbers
- Future English support

All user-facing text must come from translation files.

---

# Deployment

Expected deployment:

Frontend:

- Vercel

Backend:

- Supabase Cloud

Storage:

- Supabase Storage

---

# Architecture Principles

The architecture should:

- Keep complexity low
- Separate UI from business logic
- Protect data through multiple layers
- Avoid unnecessary abstractions
- Support future mobile applications
- Support future integrations