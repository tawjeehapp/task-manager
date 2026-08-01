# Work Management Platform

## Overview

The Work Management Platform is an internal web application that enables organizations to manage departments, employees, projects, tasks, attendance, work logs, leave requests, approvals, announcements, notifications, and operational reporting from a single platform.

The application is designed for Arabic-speaking organizations and follows an Arabic-first, right-to-left (RTL) user experience. While English localization will be supported in the future, Arabic is the primary language and every interface should be designed with RTL as the default.

The platform focuses on operational simplicity, clarity, and productivity rather than replicating large enterprise project management systems.

---

# Product summary (client review)

One-page overview for stakeholder walkthroughs. Canonical detail: [Major product decisions](#major-product-decisions) and the project [README](../../README.md#product-summary-for-client-review).

The platform runs **one organization** with hierarchy:

**Company → Department → Project → Task** (flat tasks; no subtasks).

| Role | Responsibility |
|---|---|
| **Admin** | Users, departments, department heads, projects and project due dates, leave types, company announcements, reports, override approvals |
| **Department manager** | One department: create employees, manage project members and tasks, approve team requests, department announcements, request project due-date extensions |
| **Employee** | Assigned work (status + work logs), attendance, leave, task extension/excusal |

**Planning:** Admin creates departments (each must have a manager) and projects with a required due date. Managers/admins create tasks with required assignee and estimated hours. Employees update status and log work only. Project progress = hours-weighted share of completed task estimates.

**Flow:** Statuses New / In progress / Blocked / Completed; blocked is system-managed via dependencies. Tasks cannot be unassigned (excusal reassigns). Employee requests notify the department manager; manager requests notify admins. Admin may override. No self-approval.

---

# Major product decisions

Locked rules as implemented:

1. **Three roles** — `admin`, `department_manager`, `employee`.
2. **Admin owns structure** — users (any role), departments, department heads, project entities and due dates.
3. **Managers own department operations** — create employees in their department; manage project members and tasks; cannot create/edit/archive the project entity or change its due date directly (extension request → admin).
4. **Flat hierarchy under projects** — Department → Project → Task; **no subtasks**.
5. **Project due date required; start date optional** — admin-only due date edits; managers request extensions.
6. **Tasks require assignee + estimated hours** — set by admin/manager; employees change status and log work only.
7. **Four task statuses** — `todo` (New), `in_progress`, `blocked`, `completed`. `blocked` is forced by incomplete finish-to-start dependencies (same project); not set manually.
8. **Project progress** — completed estimated hours ÷ total estimated hours. No separate project budget/estimate field.
9. **Notification routing** — employee → department manager; department manager → admin. Admin may approve employee requests without being notified. Submitting employee requests requires an active department manager.
10. **Department always has a manager** — required on create; cannot clear (replace only); projects cannot be created without a manager.
11. **No unassigned tasks** — assignee required; excusal approves only with a new assignee.
12. **Project members stay in-department** — members must be current members of the project’s department.
13. **No self-approval** on leave, attendance, employee requests, or project requests.
14. **Authorization** is enforced in application services (mutations use the service role; RLS is primarily SELECT-scoped).

---

# Goals

The platform enables organizations to:

- Organize employees into departments.
- Manage department projects.
- Break projects into tasks.
- Track employee attendance.
- Record work performed on each task.
- Balance workloads across employees.
- Manage leave requests and employee requests.
- Publish company and department announcements.
- Notify users about important events.
- Provide managers with complete visibility into team progress.
- Generate operational reports and dashboards.

---

# Non Goals

The MVP intentionally does not include:

- CRM
- Payroll
- Accounting
- Budget management (no separate project budget/estimate field)
- Subtasks / nested tasks
- Sprint planning
- Agile story points
- Epics
- Client portals
- Multi-company (multi-tenant SaaS)

These may be considered in future versions.

---

# Product Principles

These principles guide every design and development decision.

## 1. Arabic First

Arabic is the primary language.

Every screen, component, table, form, dialog, and workflow must be designed for RTL before considering LTR support.

Localization should always be possible, but Arabic remains the default experience.

---

## 2. Simplicity Over Complexity

The platform should solve common operational problems using the simplest possible workflow.

Avoid unnecessary configuration screens, excessive options, and enterprise-level complexity unless there is a clear business need.

---

## 3. Fast and Responsive

The application should feel fast.

Users should receive immediate feedback after every action.

Loading indicators, optimistic updates where appropriate, and responsive interactions should be used throughout the application.

---

## 4. Mobile-Friendly by Default

Employees and managers may frequently use the application from mobile devices.

Every feature should work well on:

- Desktop
- Tablet
- Mobile

---

## 5. Progressive Web App

The application is delivered as a Progressive Web App.

It should:

- Be installable.
- Support offline functionality where practical.
- Synchronize data when connectivity returns.
- Support push notifications.

---

## 6. Consistency

Similar actions should behave the same throughout the application.

Examples:

- Tables should share common patterns.
- Forms should share common validation behavior.
- Dialogs should follow consistent interaction patterns.
- Similar workflows should use shared components.

---

## 7. Clear Hierarchy

The application's navigation and data structure should reflect:

Company

→ Department

→ Project

→ Task

---

## 8. Visibility

Managers should immediately understand:

- Team workload
- Project progress
- Pending approvals
- Attendance status
- Overdue work

The system should surface important information before users have to search for it.

---

## 9. Action-Oriented

Dashboards should help users decide what action to take next.

Examples:

- Approve attendance
- Respond to requests
- Reassign overloaded employees
- Resolve overdue tasks

---

## 10. Minimal Configuration

The application should provide sensible defaults.

Configuration should exist only where it provides clear business value.

---

## 11. Auditability

Important business actions should be traceable.

Examples:

- Task assignments
- Status changes
- Approvals
- Attendance decisions
- Leave decisions

---

## 12. Extensibility

The MVP should remain focused while allowing future expansion.

---

# Product Experience Direction

The product should feel like a modern, premium, lightweight business application.

The experience should combine the following qualities:

---

## Clean and Focused

The interface should avoid visual clutter.

Users should immediately understand:

- What needs attention.
- What action is available.
- What information matters.

Avoid unnecessary decorations, excessive colors, and complicated layouts.

---

## Information Dense but Organized

The application manages operational data, so users need to see meaningful information quickly.

Prefer:

- Clear tables
- Compact cards
- Useful summaries
- Smart filtering
- Good spacing

Avoid:

- Large empty dashboards
- Decorative charts without purpose
- Hidden important information

---

## Simple Workflows

Common actions should require minimal steps.

Examples:

Assigning a task:

Open task → Select employee → Save

Approving attendance:

Open request → Review → Approve

Creating a project:

Project details → Add members → Start

---

## Professional Business Feel

The interface should feel suitable for:

- Companies
- Schools
- Organizations
- Professional teams

It should not feel like a casual consumer application.

---

## Calm Visual Language

The design should prioritize:

- Neutral backgrounds
- Clear typography
- Consistent spacing
- Meaningful color usage

Colors should communicate meaning.

Examples:

Green:
- Success
- Completed
- Approved

Yellow:
- Warning
- Pending
- Attention required

Red:
- Error
- Overdue
- Rejected

---

## Strong Navigation

Users should always understand:

- Where they are.
- Where they came from.
- What they can do next.

Navigation should remain consistent across modules.

---

## Arabic RTL Excellence

RTL is not a visual flip.

The application should consider:

- Proper text alignment.
- Correct icon direction.
- Natural navigation flow.
- Tables that remain readable.
- Forms designed for Arabic users.
- Dates and numbers formatted appropriately.

---

# User Roles

The platform contains three roles.

## Administrator

Responsible for the entire organization.

Can:

- Manage departments (create requires a manager; replace manager only — cannot clear)
- Manage users of any role; assign department memberships
- Assign department managers (candidate must already be `department_manager`)
- Create, edit, archive, and view all projects; set project due dates (`end_date` required)
- Assign project members within the project’s department
- Create and assign tasks on any project (assignee + estimated hours required)
- Approve any leave / attendance / employee / project request (except self)
- View all employees and company-wide reports
- Publish company announcements
- Manage leave types and allocations

---

## Department Manager

Responsible only for their department (at most one).

Can:

- Create employees in their managed department (employee role only; auto-membership)
- Manage department project members and tasks (estimates, dates, assignee, dependencies)
- Request project due-date extensions (admin approves); cannot edit project due date directly
- Review attendance and work logs for department members
- Approve leave and employee requests for department members
- Publish department announcements
- View department reports
- Also has a personal employee-style workspace for their own assigned work

Cannot:

- Create/edit/archive departments or the project entity
- Create admins or other managers
- Move members across departments
- Manage leave types/allocations
- Approve project extension requests

---

## Employee

Can:

- View assigned tasks
- Update task status only (not estimates, dates, or assignee)
- Record attendance
- Log work hours
- Submit leave requests
- Submit task extension and excusal requests (excusal requires reassignment on approve)
- View announcements
- Receive notifications

---

# Organizational Hierarchy

Company

└── Department (must have a manager)

  └── Project (`end_date` required; optional `start_date`)

    └── Task (flat; no subtasks; assignee + estimated hours required)

---

# Core Modules

- Authentication
- User Management
- Departments
- Projects
- Tasks
- Task Dependencies
- Attendance
- Work Logs
- Leave Management
- Employee Requests
- Approval Center
- Notifications
- Announcements
- Dashboards
- Reports
- Search
- Settings
- Kanban
- Gantt
- Progressive Web App

---

# Technology Stack

## Frontend

- Next.js (App Router)
- TypeScript
- Tailwind CSS v4
- shadcn/ui

## Backend

- Supabase
- PostgreSQL

## Authentication

- Supabase Auth

## Storage

- Supabase Storage

## Forms

- React Hook Form
- Zod

## Data Fetching

- TanStack Query

## Icons

- Lucide

## Date Handling

- Day.js

## Localization

- next-intl

## Progressive Web App

- Installable
- Offline support where practical
- Push notifications
- Background synchronization

---

# Future Enhancements

- Calendar View
- Advanced Analytics
- Resource Planning
- Multi-company SaaS