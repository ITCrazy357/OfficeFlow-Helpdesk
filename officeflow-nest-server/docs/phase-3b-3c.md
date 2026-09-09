# Phase 3B / 3C — User lifecycle

## Rules

- A usable administrator has role ADMIN, isActive=true, isLocked=false.
- Role updates and activation changes re-read the actor and target inside a Serializable transaction. The actor must still be an active, unlocked ADMIN.
- Removing a usable ADMIN requires another usable ADMIN. Self-demotion and self-deactivation remain forbidden.
- Deactivation is blocked by assigned OPEN/IN_PROGRESS tickets, currently held assets, PENDING leave approvals, or active direct reports.
- Losing ticket/approval permissions through a role change requires the corresponding handoff, even if the user stays active. Owning assets does not block a role change.
- Security locking remains separate: existing AccountService rules and immediate token revocation are unchanged; no handoff requirement is added to locking.
- Ticket assignment, asset assignment and ticket status transitions now use Serializable transactions. Eligibility of an assignee is checked inside the write transaction, including reopening a resolved ticket.
- Reactivation is blocked if the user's existing manager is unavailable or no longer MANAGER/ADMIN. A missing manager remains allowed under the existing account model.
- Only Prisma P2034 retries the entire transaction, up to three attempts. Audit and outbox writes stay inside it; no direct mail sending occurs inside retry callbacks.

## Files and call flow

`users.controller.ts` calls `UsersService.update`, `changeActivationStatus`, or `handoff`.
The service calls `runSerializableTransaction` in `common/database/serializable-transaction.util.ts`.
Inside its callback, `user-lifecycle.policy.ts` checks the actor/remaining ADMINs and `user-handoff.policy.ts` checks outstanding responsibilities before the write and audit.
`TicketsService` also calls `assertTicketAssignee` for assignment/reopening; `AssetsService` checks its recipient within its assignment transaction and retains its conditional asset claim.

## How to hand off a user

1. Reassign outstanding tickets using the existing ticket assignment API.
2. Return currently held assets using the existing return API, then assign to the new holder if appropriate. Preserve assignment history.
3. As ADMIN, call:

```http
PATCH /api/users/2/handoff
Content-Type: application/json
Authorization: Bearer <admin-access-token>

{"replacementId": 3}
```

This explicitly transfers **all direct reports (including inactive reports)** and **only PENDING leave approvals** from user 2 to user 3 atomically. It does not change the source user's role/activation, tickets, assets, or any leave decisions. It returns `userId`, `replacementId`, `reportsTransferred`, and `approvalsTransferred` within the usual response envelope.

The replacement must be active, unlocked, MANAGER/ADMIN, and different from the source. Reporting cycles and assignment of a request to its own requester are rejected. Choose a different eligible replacement if either rule blocks the operation. Completed leave requests and reviewedById remain untouched. No email notification is introduced by this endpoint; the new approver sees pending requests through the existing pending-approval API. The frontend now exposes an ADMIN-only handoff panel under `/users`; see `officeflow-client/PHASE_3_FRONTEND.md`.

4. Call `PATCH /api/users/2/status` with `{"isActive": false}` (or update the role). The backend rechecks all conditions; handoff alone does not reserve the account or prevent subsequent assignments before deactivation.

## Verification

```powershell
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run lint
npm run build:ci
npx tsc -p tsconfig.build.json --noEmit --pretty false
```

Unit tests exercise policies, service write boundaries, retry behavior, and absence of side effects on rejection. HTTP tests use the real RolesGuard and ValidationPipe, but mock authentication and persistence.

### Still requires an isolated real database

Mocks cannot prove MySQL transaction isolation. Before production rollout, run integration cases on a disposable, migrated test database only:

- Two ADMINs simultaneously demote/deactivate each other: at least one usable ADMIN must remain; the losing request returns a business error or a bounded-retry conflict.
- Assign a ticket/asset while deactivating the recipient: either assignment succeeds and deactivation is blocked, or deactivation succeeds and assignment is rejected.
- Reopen a resolved ticket while deactivating/demoting its assignee: no active ticket may be restored under an ineligible assignee.
- Create leave while handing off/deactivating its manager: approver/reporting lines must remain valid after committed transactions.
- Review a pending leave while handing it off: the old approver cannot process it after reassignment; retain the existing conditional review update.
- Fail audit persistence after a handoff update: both report and approval transfers must roll back.

Do not run these mutation tests against production. No schema migration, live-data modification, or automatic handoff is needed merely to deploy this code.
