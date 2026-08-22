# OfficeFlow Helpdesk

OfficeFlow is an internal helpdesk system built as a feature-based modular monolith. The active application consists of a NestJS API, a Next.js client, Prisma, and MySQL/MariaDB.

## Active applications

- `officeflow-nest-server` — active NestJS API on port `5001`
- `officeflow-client` — active Next.js client on port `3000`
- `officeflow-server` — legacy Express API on port `5000`; kept for reference and not used by the active client

Main backend modules include authentication, users, departments, tickets and SLA, attachments, dashboard reports, knowledge base, notifications, assets, ticket categories, and audit logs.

## Architecture

```text
Next.js page
  -> feature hook / React Query
  -> shared Axios client
  -> Nest controller / guards / DTO validation
  -> service
  -> Prisma
  -> MySQL or MariaDB
```

Ticket and asset events create in-process notifications through `EventEmitter2`. Scheduled jobs mark overdue tickets and clean expired refresh sessions.

## Local setup

Requirements: Node.js 22, npm, and a MySQL-compatible database.

1. Copy `officeflow-nest-server/.env.example` to `officeflow-nest-server/.env` and replace every placeholder.
2. Copy `officeflow-client/.env.example` to `officeflow-client/.env.local`.
3. Install dependencies in both active application directories with `npm ci`.
4. From `officeflow-nest-server`, run `npm run migrate:deploy` and `npm run start:dev`.
5. From `officeflow-client`, run `npm run dev`.

The client template uses the same-origin `/backend-api` rewrite so the HttpOnly refresh cookie works without weakening `SameSite=Strict`.

### Docker Compose

Copy the root `.env.example` to `.env`, replace every placeholder, then run:

```bash
docker compose up --build
```

The API container deploys Prisma migrations before starting. `DOCKER_DATABASE_URL` must use the Compose service name `mysql`, not `localhost`.

## Validation

Backend:

```bash
npm run build
npm test -- --runInBand
npm run test:e2e -- --runInBand
npx prisma validate
```

Client:

```bash
npm run lint
npm run build
```

## Seed data

Seeding requires `SEED_DEFAULT_PASSWORD` with at least 12 characters. Existing users keep their current password. Production and non-local targets are blocked unless `ALLOW_PRODUCTION_SEED=1` and/or `ALLOW_REMOTE_SEED=1` are explicitly set after confirming the database.

```bash
npm run prisma:seed
```

## Authentication and authorization

- 15-minute access JWT stored only in client memory
- 7-day opaque refresh token in an HttpOnly cookie
- transactional rotation, reuse detection, token-family revocation, logout, and logout-all
- backend-enforced RBAC and ticket visibility; UI permission checks are only a UX layer
- exact production origin validation, CORS credentials, Helmet, validation whitelist, and request throttling

Never commit `.env` files or real credentials. Rotate any credential that has previously appeared in Git history before a public or production deployment.

Production deployment, migration, health verification, and rollback procedures
are documented in [the backend production runbook](docs/backend-production-runbook.md).
