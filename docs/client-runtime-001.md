# CLIENT-RUNTIME-001: effective navigation and primary generic CRUD

This client formally consumes published immutable erbas-contract **v0.14.0**, as
recorded by `contract.revision`. The [release identity and backend alignment](full-stack-development.md#published-contract-adoption)
include the exact annotated tag object, target commit and adopting .NET revision.
No contract/backend implementation change is required for this client adoption.
Existing authentication, users and assistant screens remain compiled features.
Java is not declared compatible with the new operations until it adopts them.
A backend lacking generic CRUD/navigation can still serve its supported legacy
features; navigation failure is reported without inventing a replacement menu.

> Generic CRUD is the primary presentation path for standard resource patterns.
> Specific Angular components are reserved for UX that cannot reasonably be
> expressed through metadata, renderers or registered extensions.

## Contextual presentation extension

[RESOURCE-PRESENTATION-001](resource-presentation-001.md) adds strict, separately
cached LIST/CREATE/EDIT/VIEW recommendations from this published release.
It preserves generic routing and backend query/authorization
semantics. Explicit forms select exact subsets; legacy form/field-order fallback
continues only for absent contexts or the permitted legacy endpoint 404.

## Published adoption verification

This section records historical v0.13.0 verification.

Both existing live component proofs and the bounded Chromium procedure were rerun
against .NET's formally adopted v0.13.0. See [published-adoption evidence](full-stack-development.md#published-adoption-verification)
for coverage and results, separate from the historical preparation records below.

## Bootstrap, context and navigation

App retains its backend-bound, in-memory bearer session. After login and successful
`/api/auth/me`, AuthSession marks context ready. RuntimeClient then requests
`/api/meta/navigation`, once per active context. Nothing fetches per route change
or Angular change detection. The server returns the effective tree; the client
preserves array ordering and final labels and performs no permission-policy
filtering. Empty navigation is valid. Unknown future target kinds are not executed
and newly empty containers are removed. Icons remain opaque metadata, with no
library-specific icon interpretation or HTML execution.

The compiled default theme navigation renders nested groups and Angular links;
all current themes reuse it. The former hardcoded application section menu is
removed. Local backend/authentication/user/assistant controls remain available.
Navigation does not enumerate resource discovery or invent module menu entries.

RuntimeClient caches the tree and ETag in memory. Explicit revalidation sends
If-None-Match; Angular's non-success-path 304 is handled explicitly and preserves
the cached body. Logout clears context, hides cached data immediately and cancels
protected requests. Backend switching establishes a new context. Context epochs
scope navigation, metadata and contextual presentation, including equal-looking menus for different
sessions. Stale responses cannot populate a replacement context.

There is no tenant selector in the current client or new context-selection
protocol in this task. A future context selector must call
`AuthSession.contextChanged()` after establishing its server context; this clears
and reloads navigation, metadata and contextual presentation. Tests exercise this explicit boundary. Server
changes outside the client remain authoritative on every request; there is no
server-push subscription or per-route polling.

## Compiled route and screen resolution

Angular Router 22.2.2 is the only new dependency, matching the installed Angular
version. Existing hand-maintained API models and HttpClient conventions remain;
no generator, form framework, component library or test framework is added.

- ROUTE targets use ordinary local Angular routes. An application page must already
  be compiled/registered. Unknown routes show the normal missing-page component.
- RESOURCE targets become `/resources/:resource`. ResourceHost looks in the small
  `RESOURCE_SCREENS` injection-token registry for an explicitly registered override;
  standard resources use ResourceScreen. Specialized overrides accept a `resource`
  input and provide an escape hatch for UX outside the generic patterns.
- Override registrations select screens, not menu items, claims or permissions.
  No Assets screen or resource identifier is compiled into generic code.

For example, application composition can provide
`{provide: RESOURCE_SCREENS, useValue: {'example.resource': SpecificScreen}}`.
Shared MANY_TO_ONE controls, layouts and themes are reused across resources;
an improvement to a shared pattern must benefit all resources using it without
adding individual screens. This does not introduce a new extension registry.
Use normal APP_ROUTES additions for custom pages. No arbitrary templates,
JavaScript or TypeScript are generated/downloaded from metadata.

## Generic resource consumption

Models in `resource-runtime/models.ts` mirror the published v0.14.0 shapes.
RuntimeClient reads metadata, list pages, individual records, create/PATCH/delete,
entity action availability and execution. Metadata is cached during the context;
explicit `metadata(resource, true)` uses its ETag and conditional 304. Data pages
are normal requests, never long-lived metadata cache entries.

ResourceScreen derives title/labels, columns and effective operation affordances
from metadata. It supports offset/limit pagination, two requested sort priorities,
multiple typed AND filters, explicit null filters, and advertised literal search.
It preserves server item order; it neither sorts pages locally nor invents totals.
Optional absent totals are displayed as unavailable and next-page behavior uses
returned page size. Invalid queries retain the common 400 semantics.

ResourceForm reuses existing FieldRendererOutlet/theme controls and manual form
submission conventions. Form presentation is resolved by CREATE/EDIT/VIEW before
rendering; LIST columns use their own order/labels. Common.Label supplies field
labels, with contextual list labels taking precedence;
remaining fields fall back to metadata order. UI.Hidden/FormExcluded hints affect
forms; UI.Hidden affects table display. Required, nullable, defaults, readOnly,
immutable and enum metadata are interpreted. Text length and scalar representation
checks are local assistance; all constraints are shown as metadata help, and exact
numeric bounds, server regex syntax and business rules remain server-authoritative.
No JavaScript regex is substituted for a server regex dialect.

STRING/TEXT, integer types (including INT32), DECIMAL, BOOLEAN and DATE use compiled
controls. Existing UUID, ENUM, TIME and DATETIME theme controls also remain usable
as exact text. BINARY remains the existing display-only renderer; file editing is
not introduced. No runtime resource-specific field renderer is generated.

Defaults are displayed; omitted input still lets the server apply its CREATE
semantics. Dirty-field tracking distinguishes absence from explicit null; Set null
is offered only for nullable writable fields. PATCH sends only changed editable
fields. Read-only values and immutable fields on edit are excluded even if a caller
attempts to alter form state. Create may supply writable immutable fields. Deletion
requires effective capability and explicit confirmation; the server may still 409.

MANY_TO_ONE uses targetResource/localField/targetField/displayField. Target metadata
is cached; choices come from ordinary paged resource lists (100 per page), with
previous/more controls and the current identifier preserved even outside that page.
The selected reference identifier is sent using its declared scalar type. No join,
expansion, inverse collection, automatic editor policy or lookup-specific API exists.

Authorized ENTITY actions are shown with contextual availability, a parameter form
using the same scalar controls, typed targets and generic execution. Authorization
is independent of GET: a list-provided ID can be used for an action even without
GET permission. Success refreshes data/availability; execution remains authoritative.
COLLECTION/SELECTION action UI and workflows are intentionally deferred.

## Exact decimal, date and error boundaries

JSON responses are requested as text. A small JSON parser captures numeric lexemes
before they reach JavaScript Number, representing them as ExactNumber. Serialization
emits only grammar-validated numeric tokens, not quoted numeric strings. This is
necessary because the contract uses JSON numbers and stringifying a DECIMAL as a
JSON string would change its type. There is no added numeric library, floating-point
arithmetic or numeric source-code evaluation. Structural page integers are converted
only after safe-integer checks. Duplicate JSON keys and excessive nesting (64 levels)
are rejected. Theme numeric inputs retain exact text; integer ranges use BigInt.
DATE remains canonical yyyy-MM-dd text, never JavaScript Date or a timezone conversion.

One translation path handles the common error envelope and HTTP 400/401/403/404/409.
401 clears the session and existing profile/user/assistant data through the shared
session boundary; existing feature-specific 401 feedback is preserved. 403 preserves
authentication; a denied list refresh drops stale rows. Matching structured paths attach technical
codes to field controls; unrecognized paths/reasons use the generic message. Conflict
handling knows no Assets lifecycle/reason strings. Visibility/capability hints are
advisory: backend authorization and validation always decide.

Nginx exposes narrowly whitelisted generic paths/methods for both selected backends.
It preserves encoded identifiers, repeated query parameters, Authorization and
conditional/cache headers; it neither caches protected responses nor follows redirects.
No backend-stack branch exists in protocol handling.

## Validation and integration proof

Use existing `./bin/test` and authoritative `./bin/check` (Docker only). The new
unit/component coverage proves context bootstrap/cache invalidation, conditional
304, compiled routing and overrides, generic forms/queries/lookups/actions, common
errors and exact decimal/date transport. Existing feature tests remain passing.

The explicit live test uses the same Angular/Vitest + JSDOM infrastructure, actual
HttpClient fetch, compiled ResourceScreen/ResourceForm and production Nginx proxy:

```bash
docker build --target source -t erbas-client-runtime-proof .
docker run --rm --network <backend-network> \
  -e ERBAS_TEST_EMAIL -e ERBAS_TEST_PASSWORD \
  -e ERBAS_RUNTIME_LIVE_URL=http://<client-proxy>/backends/dotnet \
  erbas-client-runtime-proof npm test -- \
  --include=src/app/resource-runtime/runtime-live.proof.ts
```

Supply disposable infrastructure and credentials through the backend's own supported
validation setup, not production data. The test deliberately is not part of default
unit-test discovery or production compilation. It discovers a suitable curated static
catalogue from public metadata and uses no resource-specific component. It removes
its probe record; infrastructure owner cleanup remains mandatory on failure too.

### Historical pre-publication evidence

The following records predate publication and formal adoption. Candidate status,
backend pins and source revisions describe those runs, not current adoption.

The bounded proof passed against backend `b396663`, selecting `assets.asset-type`:
auth/profile → effective navigation → metadata → generic list → create → partial
PATCH → filtered read → delete. Fresh validation databases, host and client proxy
were removed afterwards. This is a compiled-component/live HTTP proof, not a browser
visual/accessibility certification or a claim of Java adoption of v0.13.0.

Final verification (2026-10-26):

- Focused generic-runtime checks passed; authoritative `./bin/check` passed
  **605 Angular tests and 15 Python tests**, zero failures/skips, formatting,
  production build, isolated two-backend proxy/runtime smokes and cleanup.
- The explicit real-backend proof passed with its compiled generic components,
  actual .NET/PostgreSQL, production client proxy and disposable credentials/data.
  It is separate evidence from mocked unit/proxy tests.
- Legacy fixtures now explicitly model optional navigation as unsupported rather
  than counting its bootstrap request as a user-operation request. Existing login,
  cancellation, session, users, assistant and theme behavior remains covered.
- Final diff, scope, documentation links, credential-marker/NUL, hardcoded-resource,
  authorization duplication, numeric/date coercion and cache-boundary reviews passed.
  The only dependency addition is Angular Router 22.2.2; the existing lockfile records
  it without unrelated dependency updates. Contract and backend working trees remain
  unchanged. v0.13.0 is still unpublished; no production/release pin was changed.

## Presentation follow-up

[CLIENT-RUNTIME-002](client-runtime-002.md) adds the contracted static hierarchy and
effective-capability rendering. The limits below record the original CLIENT-RUNTIME-001
scope; the linked follow-up documents the presentation extension and its verification.

## Limits

The contract proved sufficient without changes. Dynamic Assets field composition,
server-push invalidation, sophisticated relation editor selection, full tab/section/
group layout or unsaved-change navigation guards, workflow/state-machine UI,
collection/selection actions, joins, bulk CRUD, binary editing and stale-write
version UI remained outside this initial renderer. Specialized overrides use normal
compiled Angular components. No candidate publication, backend/CI pin change,
frontend release, push, merge or tag is implied.
