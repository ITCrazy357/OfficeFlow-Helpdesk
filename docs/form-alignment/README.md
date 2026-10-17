# Form alignment correction

The reported ticket row was reproduced in Edge at 1724×889. Before the fix, the
priority select started 12px below the category select. The priority label's grid
track was stretched to 26px while the category label stayed at 14px because the
category field also contained a help paragraph.

Field stacks now use `content-start` and `min-w-0` explicitly. This was applied to
53 label-containing grid stacks across ticket, asset, leave, knowledge, user,
password, SLA, category, and audit surfaces. Help text or validation in one field
can grow its field without distributing spare height into its neighbour's label
and control tracks. Both ticket controls now start at the same vertical position.

The audit also found that a long selected category could push the dropdown arrow
outside its trigger. The installed Radix implementation intentionally strips
`className` and `style` from Value and ItemText. Parent data-slot selectors now
constrain these nodes: selected text truncates inside the trigger, menu text wraps,
and the menu stays within the viewport. Select labels now have explicit control
associations and accessible names; React Hook Form refs and blur handlers reach
the corresponding trigger.

The earlier no-overflow and accessibility checks could not detect the 12px offset.
The new persistent browser suite measures label/control geometry and arrow bounds.
It exercises both themes at 320, 390, 768, and 1724px, including unequal hint/error
heights, validation, keyboard selection, long values (including unbroken tokens),
and loading/error/empty category states.

Run from `officeflow-client` with Node available:

```powershell
npm run test:ui
```

The config starts a dedicated frontend on port 3016, or reuses it outside CI. It
uses Edge on Windows; other platforms use Playwright Chromium (`npx playwright
install chromium` if needed). Tests intercept API responses and do not write to
the application's database.

Evidence:

- [Before, dark](ticket-before-dark.png) and [after, dark](ticket-after-dark.png).
- [After, light](ticket-after-light.png).
- Measured [before](before.json), [after light](after-light.json), and
  [after dark](after-dark.json) geometry. The full after screenshot also includes
  self-service content being developed elsewhere in the workspace; the measured
  alignment comparison concerns the priority/category row.
- [Accessibility report](accessibility.json): 9 routes in both themes, including
  opened knowledge/user forms; no reported violations or uncaught JS errors in
  these 18 scans.

Local validation: 18 browser regression tests passed, 24 existing frontend tests
passed, and the production webpack build (including TypeScript) and ESLint passed.
Browser evidence uses fixtures and establishes
rendered behavior in the exercised states, not production or remote CI acceptance.
