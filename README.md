# Work Management Platform

Arabic-first, RTL work management platform for organizations. Built with Next.js and Supabase as a Progressive Web App.

## Current status

**Milestone 0 — Project Foundation** is in progress: app shell, RTL localization, Supabase/TanStack Query wiring, PWA manifest, and notification infrastructure stubs. No business features or database migrations yet.

## Quick start

1. Install [Node.js 22+](https://nodejs.org/)
2. Install dependencies: `npm install`
3. Copy env: `cp .env.example .env.local` and fill Supabase values as needed
4. Run: `npm run dev`

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
npm run dev        # Development server
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npm run typecheck  # TypeScript check
```
