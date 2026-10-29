# CLIENT-DEMO-001: application presentation

## Objective and boundaries

Present existing ERBAS capabilities as an application suitable for an interview or
live demonstration. The client continues consuming published erbas-contract
v0.14.0. This is a visual composition change, with no new business operation,
contract, permission, dataset, AI tool or backend implementation.

## Composition

The existing `core-fe/shell` and theme resolver still own the shell, navigation,
panel and extension slots. App projects stable heading/content wrappers containing
the pre-authentication or authenticated composition; it does not introduce a
parallel shell or registry. Existing sparse themes and their behavior tests remain.

Before authentication, the main surface contains ERBAS identity, product text,
email/password, Sign in and announced authentication feedback. Closed **Connection
& demo options** retain backend selection, Health, repository/endpoint information
and optional public demo values. No protected screen or Assistant form is mounted.

After real login and profile loading, the application header presents ERBAS,
Assistant, current email and **Sign out**. The default theme provides a sidebar and
wide content area. Navigation labels, groups and targets come only from effective
`/api/meta/navigation`; active links expose `aria-current="page"`. The resource
heading uses the corresponding navigation label when present, falling back to the
metadata label. No resource name chooses styling, routing or a compiled screen.

Closed **Workspace settings** retain detailed backend configuration, diagnostics,
Reload profile and Revalidate navigation. Closed **Administration** retains the
existing user collection, detail, creation and update controls with their existing
administrator checks. They do not occupy the normal application content.

Sign out uses the existing local session-clear operation, including cancellation,
protected state and contextual cache disposal. It returns to login without claiming
to revoke a server token. Backend switching retains the same session boundaries.

## Assistant

The header opens a nonmodal side panel from any authenticated route. Opening moves
focus to the composer; Close or Escape returns it to the trigger. `aria-expanded`,
`aria-controls`, labels, live feedback and busy states describe the interaction.
Closing keeps the mounted draft/result and does not change routing or cancel the
existing request. Success still clears the composer; errors preserve it as before.
Sign out/backend replacement discard Assistant state and cancel pending work.

The existing AI-001 client and validators send real requests and render only valid
backend answers or safe errors. No response is hardcoded in the UI. Assets-specific
questions, datasets and read tools remain future work; a successful generic answer
does not demonstrate Assets data access.

## Generic resource presentation

Generic CRUD remains the primary path. `RESOURCE_SCREENS` remains an explicit
escape hatch for specialized UX; Assets does not register an override.

- LIST has a title, permission-gated primary Create, organized search/sorts/filters,
  semantic headers, an accessible horizontally scrolling table, row operations,
  understandable pagination and loading/empty/error feedback. Query controls and
  the retained list are hidden during CREATE/EDIT/VIEW without changing their state.
- CREATE, EDIT and VIEW use the existing contextual resolver, ResourceForm,
  ResourceLayout and compiled field renderers. Context membership/order, tabs,
  sections, groups, collapse behavior and action availability remain authoritative.
- Forms share theme tokens and surfaces. VIEW uses a restrained read-only appearance
  and Close, with no Save. Scalar controls and their validation remain intact.
- MANY_TO_ONE uses the existing paged lookup/displayField. A loaded current reference
  selects and displays its label rather than an empty placeholder; transport still
  uses its original identifier. No new list/read-only relationship resolver or
  lookup API was added. LIST and read-only values can still display identifiers
  when no display value is available; column labels retain metadata fallbacks.
- Only the existing Delete operation receives destructive styling. Arbitrary
  resource actions keep a uniform style; names never imply business semantics.

The default workspace adapts its sidebar to a wrapping top navigation at narrow
widths. Content remains within the viewport, tables scroll locally and the panel
fits the viewport and can always be closed. Focus remains visible; native details,
buttons, labels, table semantics, tab keyboard behavior and announcements are kept.
No new UI library or permanent browser dependency was introduced.

## Demonstration flow

1. Open ERBAS. If needed, expand Connection & demo options and choose .NET.
2. Sign in with a real account; show neutral credential feedback if sign-in fails.
3. Follow the backend's Asset register navigation entry into the generic RESOURCE.
4. Show contextual LIST columns, in order: `name`, `assetTypeId`, `assetTag`,
   `lifecycle`, `condition`, `locationId`.
5. Choose Create. Only `assetTypeId`, then `name`, are rendered; reference choices
   use their existing display labels. Save only disposable proof data.
6. Edit a saved record to show the richer contextual tabs/sections/groups, then
   View to show its read-only context. Permissions remain backend-authoritative.
7. Open Assistant, ask a supported question, show waiting and the real answer/error,
   close/reopen it, then sign out. Do not promise Assets-specific answers yet.

## Verification — 2026-10-29

The implementation started at client `b4630ef611b9021351a9e8013ce04b417c1a91c8`.
`./bin/check` passed before real proof: **698 Angular tests and 16 Python tests**
(**714 total**), formatting, production build, isolated proxy/runtime smokes,
contextual presentation, ETag/304 and legacy 404. Existing Rolldown installation,
package files, lockfile and contract pin are unchanged.

Five new composition tests cover login versus workspace landmarks, effective
navigation/current identity, secondary tools and restricted controls, Assistant
open/close/Escape/error/busy state, logout cancellation and backend replacement.
Existing functional tests remain, with expectations adjusted for sign-out wording
and the removal of authenticated login controls. The MANY_TO_ONE regression now
checks selected label/value after asynchronous lookup loading. Existing contextual
column, CREATE/EDIT/VIEW and unauthorized capability tests remain in place.

Real proof used .NET `6c8cf72b5ceefd15411f24befa140bcf28b9e201`, its owner-managed
validation Host and four disposable PostgreSQL databases. Production Nginx and
Chromium communicated on the backend Docker network without published host ports,
response interception or client mocks. Temporary identities, membership/READ claim,
Asset type and records existed only in those disposable databases.

The documented pinned Playwright 1.56.1 image ran Chromium 141.0.7390.37, with the
matching package installed only in a temporary Docker image. Proof verified real
credential error/login, effective navigation and active item, current user,
contextual LIST's exact six columns, CREATE's exact two fields and POST payload,
persisted DRAFT, EDIT's four tabs/seven sections/nine groups with immutable type,
contextual VIEW, logout and restricted read-only access without write/admin/actions.
Assistant made a real request, announced waiting and received HTTP 200 with the
backend's answer that used no ERBAS capability; closing/reopening preserved the
result. This is backend integration evidence, not a claim of external-model or
Assets-specific AI capability. There were zero page runtime errors.

Desktop 1920px, laptop 1366px and narrow 390px viewports had no global horizontal
overflow. Local screenshots and the proof result are under `/tmp/client-demo-001/`,
including login/error, empty/populated LIST, CREATE, EDIT, VIEW, Assistant and
restricted VIEW. Screenshots and temporary browser tooling are not committed.

The final `./bin/check` and complete browser run both passed after the responsive
adjustment. The client proxy and validation Host were removed; owner cleanup
removed and verified all four dedicated databases. PostgreSQL was returned to its
initial stopped state with its development volume preserved. Private-credential
scans passed, the temporary credential file was removed, and the diff contains no
browser tooling, screenshots, dependencies, contract changes or Assets-specific
production branches.

## Follow-up tickets (not implemented here)

- `ASSETS-DEMO-DATA-001`: intentional demonstration dataset.
- `AI-ASSETS-AUDIT-001`: audit supported AI/Assets behavior and gaps.
- `AI-ASSETS-READ-001`: approved read capabilities for Assets questions.
- `DEMO-E2E-001`: maintained end-to-end demonstration workflow.
