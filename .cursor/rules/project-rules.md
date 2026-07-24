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
7. Add loading/error states.
8. Verify RTL.


# AI Development Rules

When generating code:

- Do not create files randomly.
- Follow existing architecture.
- Explain major decisions.
- Do not add libraries without justification.
- Do not skip documentation updates.