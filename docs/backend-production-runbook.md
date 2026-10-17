# Backend production deployment runbook

This runbook defines how OfficeFlow verifies, migrates, and rolls back the active
`officeflow-nest-server` service on Render.

## One-time Render configuration

1. Turn **Auto-Deploy** off for the backend service. GitHub Actions is the only
   deployment gate, so Render must not deploy a push before CI passes.
2. Set **Health Check Path** to `/api/db-health`. This endpoint checks both the
   NestJS process, the production database connection, and required outbox/SLA
   tables and columns. A missing schema must fail this check.
3. Keep the service connected to the `main` branch and the repository that owns
   `.github/workflows/backend-ci.yml`.
4. Provision a managed Redis instance in the same region as the API and set:
   - secret `REDIS_URL` to the provider URL, including TLS and credentials when
     the provider requires them;
   - `REDIS_KEY_PREFIX=officeflow:production`;
   - `REDIS_CONNECT_TIMEOUT_MS=3000`;
   - `REDIS_COMMAND_TIMEOUT_MS=1500`;
   - `DASHBOARD_CACHE_TTL_SECONDS=60`.

For Render's single trusted proxy hop, set `TRUST_PROXY=1` and verify that
request logs show the real client IP. Do not enable it for an untrusted direct
deployment, because login IP rate limiting relies on `request.ip`.

Do not expose a production Redis port publicly. Redis is intentionally a
degradable dependency: monitor `RedisService`, `DashboardService`, and
`ResilientThrottlerStorage` warnings because an outage falls back to database
dashboard reads and per-instance (not distributed) rate limiting. Prefer a
`noeviction` memory policy for the shared rate-limit store and alert before it
reaches its memory limit; application cache and limiter keys expire
automatically.

Render automatically provides `RENDER_GIT_COMMIT` at runtime. The health endpoint
returns this SHA so GitHub can prove that it is checking the new release instead
of the previous healthy release.

## One-time GitHub configuration

Under **Settings > Environments > production**, configure:

- Secret `RENDER_DEPLOY_HOOK_URL`: the secret deploy hook copied from the Render
  backend service.
- Variable `BACKEND_HEALTH_URL`: the full production URL ending in
  `/api/db-health`, for example
  `https://officeflow-api.onrender.com/api/db-health`.
- Variable `RENDER_DEPLOY_ENABLED`: set it to `true` only when production CD is
  enabled.
- Add a required reviewer if production deployment should require human approval.

Do not store the deploy hook in an `.env` file or commit it to the repository.

## Deployment contract

Every pull request to `main` runs lint, tests, a clean-database migration check,
and a production build. A push to `main` deploys only after all verification
passes. GitHub then waits up to 15 minutes for `/api/db-health` to return the same
commit SHA that triggered the workflow.

A green deploy job therefore means:

- CI passed;
- Render accepted the exact commit;
- that commit is serving production traffic;
- the API can query the production database and required outbox/SLA schema.

This does not replace an authenticated ticket-list smoke test or verification of
other business workflows.

## Migration strategy

Never use `prisma migrate reset`, `prisma db push`, or `prisma migrate dev` against
production. Production uses only:

```bash
npm run migrate:deploy
```

### Aiven MySQL TLS

The runtime MariaDB adapter requires `ssl`, whereas the Aiven service URI uses
`ssl-mode=REQUIRED`. Backend configuration enables TLS for Aiven hostnames and
loads the project's tracked `officeflow-nest-server/certs/ca.pem`. It verifies
both the CA chain and the database hostname. Prisma migration commands use the
same CA through their own `sslcert` and `sslaccept=strict` URL options.

If the Aiven project or CA changes, download its current CA certificate and set
`DATABASE_SSL_CA_PATH` to the deployed file, for example
`/etc/secrets/aiven-ca.pem`. Keep the user, password, host, port and database in
`DATABASE_URL`; no credentials belong in the certificate file.

Do not use `allowPublicKeyRetrieval=true` or disable certificate verification for
the production Internet connection. The trusted-local Docker workaround does
not apply to Render-to-Aiven traffic.

### Native Node service on Render

When the service uses Render's Node runtime, configure:

```text
Root Directory: officeflow-nest-server
Build Command:  npm ci --include=dev && npm run build
Start Command:  npm run start:deploy
```

The CLI and build tools are currently dev dependencies, so include them during
installation. `start:deploy` applies reviewed pending migrations before starting
Nest. `start:prod` starts Nest directly and does not apply migrations. For a paid
service that already runs `npm run migrate:deploy` in its pre-deploy phase, keep
`npm run start:prod` instead.

Native logs normally reference `/opt/render/project/src`; this repository's
Dockerfile uses `/app`. Check the actual service runtime and startup override
when the logs differ from the intended Docker configuration.

### Render Free or Hobby service

Keep the Docker default command:

```bash
npm run start:deploy
```

It applies pending migrations before starting the API. GitHub CI first applies
the entire migration history to a clean MySQL database, but this does not replace
a backup or a production-data rehearsal for destructive changes.

### Paid Render service

Prefer Render's pre-deploy phase so migration failure stops the rollout before
the new application starts:

```text
Pre-Deploy Command: npm run migrate:deploy
Docker Command:     npm run start:prod
```

Do not configure the pre-deploy command while leaving `start:deploy` as the Docker
command, because that runs the migration command twice unnecessarily.

### Tickets return P2021 after the SLA deployment

`The table Sla_alerts does not exist` means the running code cannot use the
required SLA schema. A successful deploy or `SELECT 1` does not establish that
migration `20261017120000_add_business_sla` was applied to this database.

1. Open the deployed service's Shell, in `officeflow-nest-server`. Use its
   existing production environment; do not substitute a local `.env` file.
2. Run the read-only command `npm exec -- prisma migrate status`. Confirm the
   database target and inspect every pending/failed migration.
3. If the only pending migration is `20261017120000_add_business_sla`, verify a
   database backup, then run `npm run migrate:deploy`. That migration adds SLA
   tables/columns/indexes, expands enum values and backfills warning timestamps;
   it does not drop tickets or reset the database.
4. If older migrations are pending, or any migration has failed, review the
   migration history and actual schema before proceeding. In particular,
   `20260729195212_updateinsert` contains destructive statements. Do not mark a
   migration applied merely to bypass the error, or rerun partially applied SQL.
5. Verify migration status, `/api/db-health`, the authenticated ticket list and
   the next SLA scheduler run. Configure either the native/Docker `start:deploy`
   command or the paid pre-deploy migration step described above for later
   releases.

Do not seed, reset, or create an empty replacement database to repair this error.

### Expand-contract rule

All production schema changes must be backward compatible:

1. **Expand:** add nullable columns/tables/indexes without deleting what the old
   application uses.
2. Deploy code that can work with both the old and new schema, then backfill and
   verify production data.
3. **Contract:** remove obsolete columns only in a later release after no running
   version depends on them.

Example: to replace `name` with `fullName`, first add `fullName`, deploy code that
reads either field, backfill it, and only remove `name` in a later deployment.

Before a migration that deletes or rewrites data, create a verified database
backup and test the migration on a recent production copy.

## Rollback procedure

Application rollback is intentionally manual because reverting code does not
revert database data or schema.

1. Set the GitHub production variable `RENDER_DEPLOY_ENABLED` to `false` to stop
   additional deployments.
2. In Render, open the backend service's **Events** page.
3. Select the most recent known-good deployment and choose **Rollback**.
4. Wait for Render to mark it live.
5. Verify `/api/health`, `/api/db-health`, login, and one important authenticated
   read operation.
6. Fix the cause in a pull request. Re-enable deployment only after CI passes.

Do not automatically run a reverse SQL migration during rollback. If a migration
caused destructive data loss, stop writes and follow the database provider's
tested backup-restore procedure instead of improvising SQL on production.

## Failure interpretation

- **MariaDB 45044 / RSA public key unavailable:** the connection has reached
  MySQL but its full authentication path requires TLS or a trusted pinned RSA
  key. Use the Aiven TLS configuration above. The surrounding `P2010` / `45028`
  pool error is not evidence that increasing the pool size will help.

- **`application_start_failed`:** startup errors are emitted as one JSON record
  before the process exits with code 1. Check `code`, `databaseFailure`, and
  `databaseNetworkCode`; the record omits raw SQL, credentials, and the minified
  Prisma source dump. When copying Render logs, clear text filters and copy this
  record instead of the library source line.
- **`databaseNetworkCode: ENOTFOUND`:** the deployment could not resolve the
  database hostname. Verify the service state and current hostname in Aiven,
  then compare the hostname in Render's `DATABASE_URL`. A successful lookup or
  TCP connection from a developer machine does not prove connectivity from
  Render. Increasing pool size or connection timeouts does not fix a missing
  DNS record. `EAI_AGAIN` indicates a temporary DNS lookup failure instead.
- **`databaseFailure: connection_pool_unavailable`:** the MariaDB pool could not
  acquire a connection, but no recognized network cause was available. Do not
  assume pool exhaustion or a missing migration from `P2010` / `45028` alone.

- **MariaDB 45012 / socket timeout after 1000ms:** the API now defaults to
  `connectTimeout=10000` and `acquireTimeout=20000` in the runtime adapter URL.
  No environment change is needed when those options are absent. Explicit
  `connectTimeout` / `acquireTimeout` URL parameters take precedence and use
  milliseconds; retain the existing database credentials and TLS options.
  Startup requires `SELECT 1` to succeed and closes the pool on failure, so a
  database outage prevents the new process from reporting ready. After deploying,
  verify `/api/db-health` and login. This timeout change requires no schema
  migration. If connection creation still times out, investigate connectivity
  from Render to the database; longer timeouts cannot repair a blocked route.

- **Verify Backend failed:** no deployment was triggered; fix the code or
  migration and push again.
- **Render hook failed:** confirm the hook secret has not expired or been
  regenerated.
- **Production verification timed out:** inspect Render build, pre-deploy, start,
  and health-check logs. The previous healthy release may still be serving.
- **Health returns a different commit:** Render is still building/queued, or a
  different deployment source is active. Confirm Auto-Deploy is off.
