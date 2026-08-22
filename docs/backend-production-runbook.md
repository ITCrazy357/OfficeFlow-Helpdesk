# Backend production deployment runbook

This runbook defines how OfficeFlow verifies, migrates, and rolls back the active
`officeflow-nest-server` service on Render.

## One-time Render configuration

1. Turn **Auto-Deploy** off for the backend service. GitHub Actions is the only
   deployment gate, so Render must not deploy a push before CI passes.
2. Set **Health Check Path** to `/api/db-health`. This endpoint checks both the
   NestJS process and the production database connection.
3. Keep the service connected to the `main` branch and the repository that owns
   `.github/workflows/backend-ci.yml`.

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
- the API can query the production database.

## Migration strategy

Never use `prisma migrate reset`, `prisma db push`, or `prisma migrate dev` against
production. Production uses only:

```bash
npm run migrate:deploy
```

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

- **Verify Backend failed:** no deployment was triggered; fix the code or
  migration and push again.
- **Render hook failed:** confirm the hook secret has not expired or been
  regenerated.
- **Production verification timed out:** inspect Render build, pre-deploy, start,
  and health-check logs. The previous healthy release may still be serving.
- **Health returns a different commit:** Render is still building/queued, or a
  different deployment source is active. Confirm Auto-Deploy is off.
