# Admin dashboard analytics

The ADMIN view at `/dashboard` uses Recharts 3.10.1, composed to match OfficeFlow's
existing shadcn/Radix controls and semantic light/dark tokens. No external dashboard
template or demo dataset is included in the application.

The dashboard now starts with the date-filtered [processing performance report](../processing-performance.md),
available within each user's dashboard scope. That report uses its own `/dashboard/performance`
endpoint and saved per-ticket SLA calendars. The panels described below remain all-time
distributions and are labelled separately from the date-filtered report.

References: [Recharts](https://github.com/recharts/recharts),
[shadcn chart composition](https://ui.shadcn.com/docs/components/radix/chart).
License attribution is in
[THIRD_PARTY_NOTICES.md](../../officeflow-client/THIRD_PARTY_NOTICES.md).

Six charts show ticket status, priority, categories, requesting departments, recorded
SLA breaches, and assigned support workload. Additional statistics show active
tickets, the resolved-or-closed share, and the largest issue category. The completion
share uses all tickets, including cancelled tickets, as the denominator.

All distributions use the existing scoped dashboard reports. Workload uses
`GET /tickets/workload`, matching its current ADMIN/IT_STAFF backend permission;
this new panel is mounted only for ADMIN. EMPLOYEE, MANAGER, and IT_STAFF retain
the existing dashboard and do not make the additional workload request here.

SLA's remaining segment means no recorded breach, not proven on-time completion.
Values in these all-time panels are accumulated counts. Their APIs do not supply
daily history, so these panels do not invent a time trend or change-from-last-period
percentage. The separate performance chart groups current outcomes by creation date;
it does not represent daily resolution throughput.

Tooltips support inspection, ranking lists expand beyond six rows, and each chart
has a native disclosure with a data table. Empty datasets show an empty state.
Workload has its own loading/error/retry path. Charts have reserved heights,
responsive widths, and no entrance animation, including in reduced-motion mode.
The chart bundle is loaded separately for the admin view.

Preview: [light desktop](dashboard-light-1440.png),
[dark desktop](dashboard-dark-1440.png),
[light mobile](dashboard-light-390.png), [dark mobile](dashboard-dark-390.png).
Preview names, counts, and accounts are browser-only fixtures, not production data.

Local validation and limits are recorded in [verification.json](verification.json).
On 2026-10-17, the production webpack build (including TypeScript), ESLint with
zero warnings, and all 24 frontend regression tests passed. Edge checks covered
17 cases: both themes at five widths (320, 390, 768, 1024, 1440), chart inspection
and expansion, empty data, workload failure/retry, the other three user roles,
and reduced motion. Both theme accessibility scans reported no violations; the
browser recorded no uncaught errors or warnings.

The browser checks intercept API responses and cannot prove backend authentication,
production data accuracy, deployment, or remote CI acceptance.
