# OfficeFlow UI refresh

The subsequent admin chart update and its current previews are documented in
[Admin dashboard analytics](admin-dashboard/README.md). The screenshots below
record the earlier interface refresh.

## Design decision

OfficeFlow is an operational tool used for recurring tasks. The visual direction
uses an olive-tinted neutral canvas, forest-green actions, a quieter sidebar, and
consistent product typography. Color indicates actions, selections, and status.
Dark mode uses the same visual vocabulary, with separate surface and text tokens.

Hairline adds a recognisable interactive detail to login, overview, and empty
ticket, asset, knowledge, and leave-request lists. Figures load near the viewport,
reserve their dimensions, and never autoplay. Reduced motion also disables pointer
interaction. Illustration failure does not block the application.

Uiverse's theme switch and loader were adapted to OfficeFlow's tokens, semantics,
and motion preferences. Checkbox feedback uses native input events so ticket
selection, handoff confirmation, and working-day selection retain their behavior.
Source links and license notices are in
[THIRD_PARTY_NOTICES.md](../officeflow-client/THIRD_PARTY_NOTICES.md).

## Audit and implementation

- All app routes and shared controls were reviewed in source. Hard-coded primary
  actions and light-only status palettes were aligned across tickets, assets,
  knowledge, leave, notifications, users, departments, categories, audit, and auth.
- The dashboard prioritises current work, then reports and recent tickets;
  connectivity diagnostics appear last. A zero-value report bar is zero width.
- Removed repeated decorative section labels, repeated hover lifts, and technical
  endpoint/backend descriptions from dashboard copy.
- Search inputs have accessible names. Select triggers derive a fallback name
  from their prompt while preserving explicitly supplied ARIA attributes.
- The theme is applied before rendering, follows system preference until explicitly
  chosen, persists locally, and responds to changes in another tab.
- The mobile menu traps focus, supports Escape, restores focus, and locks scrolling.
- Two-column detail views wait for a wider viewport and allow content to shrink.
- A hidden attachment file input was changed to a native screen-reader-only input:
  the full-width shared input styles had caused horizontal document overflow.

## Verification boundary

Browser checks use intercepted API fixtures. Screenshots contain illustrative data,
including the account and ticket names. They establish rendered layout and local
interaction behavior, not backend integration, real authentication, email delivery,
production deployment, or remote CI acceptance.

Verified locally on 2026-10-17 with Node 22.23.2:

- Production build: `next build --webpack`, including TypeScript and route generation.
- ESLint: `eslint src --max-warnings 0`.
- Existing frontend regression tests: 24 passed.
- Edge: 96 layout cases across 22 routes, including both themes, mobile and desktop,
  empty states, and overview checks at 320, 768, 1024, and 1920 pixels. No document
  overflow and no uncaught JavaScript errors in the final report.
- Axe WCAG 2 A/AA: 38 operational/authenticated scans and 6 public auth scans,
  with no reported violations in the exercised states. This is automated coverage,
  not a claim of complete accessibility conformance.
- Interaction checks: system theme, saved preference, cross-tab updates, password
  visibility, EMPLOYEE/MANAGER/IT_STAFF navigation, staff ticket selection, Hairline
  pointer response, reduced motion, and mobile menu resizing. The layout pass also
  checked menu focus trapping, Escape, focus restoration, and login validation.

Evidence: [layout and accessibility report](ui-refresh/browser-results.json),
[interaction and auth accessibility report](ui-refresh/interaction-results.json).

Preview the [light dashboard](ui-refresh/dashboard-light-1440.png),
[dark dashboard](ui-refresh/dashboard-dark-1440.png),
[login](ui-refresh/login-light-1440.png), or
[mobile ticket list](ui-refresh/tickets-dark-390.png).
