# Implementation Roadmap

## Overview

This roadmap defines the recommended development order for the Work Management Platform.

The application is built incrementally.

Each milestone should produce a usable working system before moving to the next milestone.

The roadmap prioritizes:

- Core architecture
- Security
- Data integrity
- User workflows
- Operational visibility

## Testing Strategy

Testing infrastructure will be introduced in Milestone 1.

Milestone 1:
- Add Vitest
- Add React Testing Library
- Test authentication, users, permissions, and organization rules

Milestone 2:
- Expand testing to projects, tasks, dependencies, and workload calculations

Milestone 3:
- Test attendance calculations and approval workflows

End-to-end testing with Playwright will be introduced when complete business workflows exist.

---

# Milestone 0 — Project Foundation

## Goal

Create the application foundation and development environment.

## Features

### Project Setup

- Next.js App Router setup
- TypeScript configuration
- Tailwind CSS setup
- shadcn/ui installation
- RTL configuration
- Arabic localization setup
- Environment configuration

---

### Architecture Setup

Implement:

- Feature-based folders
- Supabase client setup
- Authentication helpers
- API route structure
- Service layer structure
- Validation setup

---

### UI Foundation

Create:

- Application layout
- Sidebar
- Header
- Mobile navigation
- Theme foundation
- Loading states
- Error states
- Empty states

---

### PWA Foundation

Implement:

- Installable application
- Web manifest
- Service worker
- App icons
- Basic offline support

---

### Notifications Foundation

Implement:

- Notification database structure
- Notification service
- Notification center UI foundation
- Push notification infrastructure

---

# Milestone 1 — Authentication and User Management

## Goal

Enable users to access the system securely. Access should be based on employee number not email (4 digits). To simplify things you can use supabase email provider but use a hardcoded domain without email validation.
For example @task-manager.com

Users shouldn't need to enter this @domain.com 

Forgot password will be managed by admins and department managers to reset password of their below employees.

**Milestone 1 scope:** Admin-only password reset. Manager → subordinate reset is implemented in Milestone 2 once department membership exists.

You can create an initial admin account 0000 with a temporary password.

When employees are added, their password is the same as their employee number and they get prompted/forced to change it.

## Features

### Authentication

- Login
- Logout
- Session management
- Password reset

---

### User Management

Admin can:

- Create users
- Activate/deactivate users
- Delete users
- Assign roles

Roles:

- Admin
- Department Manager
- Employee

---

### Permissions

Implement:

- Permission model
- Role permissions
- API permission checks
- Basic RLS policies

---

### Employee Profiles

Support:

- Name
- Phone
- Role
- Status

---

# Milestone 2 — Organization Structure

## Goal

Create the company hierarchy.

## Features

### Departments

Admin can:

- Create departments
- Edit departments
- Assign managers
- Archive departments

---

### Department Membership

Support:

- Adding employees
- Removing employees
- Moving employees between departments
- Membership history

---

### Organization Views

Create:

- Department list
- Employee directory
- Department details

---

# Milestone 3 — Projects and Tasks

## Goal

Introduce the core work management functionality.

## Features

### Projects

Managers can:

- Create projects
- Assign members
- Set dates
- Set priority
- Archive projects

---

### Tasks

Support:

- Creating tasks
- Assigning employees
- Due dates
- Start dates
- Priority
- Estimated hours
- Status changes

---

### Subtasks

Support:

- One level of subtasks

---

### Task Views

Create:

- Task list
- Task details
- Kanban board

---

# Milestone 4 — Task Management Intelligence

## Goal

Improve planning and execution.

## Features

### Task Dependencies

Support:

- Finish-to-start dependencies

Rules:

A task cannot start before dependencies are completed.

---

### Employee Workload View

Before assigning tasks, managers can see:

Employee:

```
Active Tasks: 5

Estimated Hours:
18 hours
```

Purpose:

- Prevent overload
- Improve task distribution

---

### Task Activity History

Track:

- Assignment changes
- Status changes
- Updates

---

# Milestone 5 — Attendance and Work Logging

## Goal

Track employee time and effort.

---

## Attendance

Support:

- Clock in
- Clock out
- Daily records
- Total hour calculation

---

## Attendance Approval

Managers can:

- Approve attendance
- Reject attendance
- Add rejection reason

Users cannot approve their own records.

---

## Work Logs

Employees can:

- Log time against tasks
- Add descriptions

Managers can:

- Review logs

---

# Milestone 6 — Leave and Employee Requests

## Goal

Handle employee workflows.

---

## Leave Management

Support:

- Leave types
- Leave balances
- Leave requests
- Approval workflow

---

## Employee Requests

Support:

### Task Extension Request

Employee requests:

- New deadline

Manager:

- Approves
- Rejects

---

### Task Excusal Request

Employee requests:

- Removal from task

Manager:

- Approves
- Rejects

---

# Milestone 7 — Communication

## Goal

Improve internal communication.

---

## Announcements

Support:

- Company announcements
- Department announcements
- Priority levels
- Attachments
- Read tracking

---

## Notifications

Support:

Events:

- Task assigned
- Task completed
- Approval required
- Approval result
- Announcement published

Channels:

- In-app notifications
- Push notifications

---

# Milestone 8 — Dashboards and Reporting

## Goal

Provide operational visibility.

---

## Admin Dashboard

Show:

- Departments
- Active projects
- Employees
- Pending approvals
- Company workload

---

## Manager Dashboard

Show:

- Department projects
- Overdue tasks
- Team workload
- Pending approvals

---

## Employee Dashboard

Show:

- Assigned tasks
- Upcoming deadlines
- Attendance summary
- Requests

---

## Reports

Initial reports:

- Task completion
- Employee workload
- Attendance summary
- Work log summary

---

# Milestone 9 — Advanced Views

## Goal

Provide advanced planning tools.

---

## Gantt Chart

Support:

- Timeline visualization
- Task duration
- Dependencies
- Overdue indicators

---

## Advanced Filtering

Support:

- Date ranges
- Employees
- Departments
- Projects
- Status

---

# Milestone 10 — Future Enhancements

Not part of MVP.

Possible additions:

- Calendar integration
- AI assistant
- Native mobile apps
- Advanced analytics
- Resource planning
- Multi-company support

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

1. Foundation
2. Authentication
3. Organization
4. Projects
5. Tasks
6. Dependencies and workload
7. Attendance
8. Leave
9. Communication
10. Reports
11. Gantt