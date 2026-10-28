# CLIENT-RUNTIME-002: presentation metadata and effective UI

Published immutable erbas-contract **v0.13.0** defines the static form hierarchy
and effective operation/action capabilities. The client formally consumes this
release through `contract.revision`; .NET formally adopts the same release.
See the [exact identity and alignment](full-stack-development.md#published-contract-adoption).
Java compatibility with the new operations is not claimed before adoption.

> Presentation metadata controls generic rendering, not authorization.

> Generic CRUD is the primary presentation path for standard resource patterns.
> `RESOURCE_SCREENS` is an explicit override/extension for specialized UX that
> metadata, renderers or registered extensions cannot reasonably express.

Improvements to shared MANY_TO_ONE controls, layouts or themes must benefit all
resources using those patterns. This consolidation adds no renderers, themes,
registry, field-level permissions or separate CREATE/EDIT layouts.

In v0.13.0, field presentation is static; CRUD capabilities, actions and navigation
are effective per user/context. Field-level authorization is outside this version.
There is no per-user hidden/read-only/editable/create-only/update-only field policy.
Static readOnly, immutable and UI.Hidden/UI.FormExcluded retain their established
meaning. Immutable permits initial input and prevents subsequent modification;
it is not a user-dependent field permission. Future field authorization would need
both effective Resource Runtime metadata and authoritative read/write enforcement,
not merely a presentation flag or an Angular permission rule.

## Published adoption verification

Both existing live component proofs and the bounded Chromium procedure were rerun
against .NET's formally adopted v0.13.0. See [published-adoption evidence](full-stack-development.md#published-adoption-verification)
for coverage and results, separate from the historical preparation records below.

## Renderer and ordering

ResourceForm delegates structure to precompiled ResourceLayout. The same compiled
field template and existing theme renderer/lookup serve flat forms, hierarchical
editing and read-only detail views. No runtime source generation, remote components,
new UI library or test framework is introduced. RESOURCE/specific-screen resolution
is unchanged.

The renderer consumes the contracted form → tabs → sections → groups → field
references. It preserves each array's declared order and uses supplied labels.
Absent optional container labels fall back to a tab/summary ID where a usable
control name is required; unlabeled ordinary groups need no invented title.
Field labels still come from Common.Label, then the field name. Scalar metadata
continues to decide type, required/nullability, defaults, constraints, relations,
read-only and immutability. Placement cannot redefine these semantics.

The first surviving tab is active by default. Clicking or ArrowLeft/ArrowRight/
Home/End selects tabs with roving focus and matching ARIA tab/panel relationships.
Switching tabs preserves unsaved values. A valid active tab survives metadata
refresh; if it disappears, the first surviving tab is used. Inactive panels are
hidden without discarding their fields. Native details/summary sections honor
collapsible/initiallyCollapsed; ordinary sections and fieldsets preserve labels.

Projection resolves only known, visible form fields. First placement wins for a
duplicate reference; unknown references are ignored. Unassigned visible fields are
appended exactly once in an Other fields area, in remaining metadata field order.
Without presentation, the existing flat Details form remains. Empty groups are
removed, then sections and tabs without fields or eligible actions are removed.
An action-only container is not empty while it has an eligible action.
UI.Hidden/FormExcluded fields are neither rendered in generic forms nor collected
into a form mutation; those hints do not create backend field authorization.

The current .NET definition validator requires every visible field to be placed
when a layout exists. Therefore the real Asset declaration places all fields;
incomplete-layout fallback is deliberately proven with client contract fixtures.
No validator was weakened to manufacture a backend fallback example.

## Actions and effective capability projection

The screen passes existing action DTOs; layout projection accepts authorized ENTITY
actions only. Contracted form, tab and section action references determine placement.
Unplaced eligible actions appear in a fallback action area; duplicate references do
not create duplicate controls. Unknown, unauthorized and unsupported-scope action
references are ignored. Contextual availability is fetched for the selected entity;
authorized but unavailable actions remain disabled in their declared location.
Execution still rechecks everything on the backend. The existing parameter form
and generic action execution/refresh path remain intact. Action parameter controls
have a separate ID prefix to avoid collisions with resource fields.

Create/edit/delete controls consume declared/authorized operation capabilities and
module state. An administrator may edit writable fields; a read-only user opens the
same hierarchy as a read-only view with no Save affordance. This is whole-operation
view mode, not different per-field metadata. Identifiers, lifecycle/read-only fields
and immutable fields retain their static rules even for an administrator. Action
rights remain independent of GET rights; a list-provided target can still be used
for an independently authorized action.

Navigation is the already filtered server tree, not an Angular-generated menu or
role table. Stale affordances and manipulated HTTP requests remain subject to
backend 403/409/validation. No Assets policy names or resource IDs enter the generic
renderer.

## Cache, context and metadata refresh

RuntimeClient retains its active-context cache and ETag handling. Login replacement,
logout and explicit AuthSession.contextChanged invalidate navigation/metadata and
cancel protected requests; two identities never share cache entries. Detailed
metadata revalidation sends If-None-Match, preserves the same object on 304 and
replaces it on a changed 200/ETag, updating capabilities/layout.

Refresh metadata is explicit on ResourceScreen; nothing polls per route or render.
It refreshes list/availability after resolution. The button is disabled during edit
or parameter entry to avoid silently discarding an unsaved form on revalidation.
This does not add route-level unsaved-change guards or a workflow framework.

## Real proving resource and profiles

Backend commit `560bfc5` introduced existing presentation metadata on
`assets.asset`, with no fields, security rules, lifecycle, constraints, CRUD routes
or persistence changes:

- General: identity/identifiers, equipment, lifecycle/state/condition.
- Purchase and notes: acquisition and a collapsible notes section.
- Location and custody: physical/base location plus existing assignment actions;
  location is not duplicated as current custody/history.
- Audit: identifier/timestamps, initially collapsed.

Complete is placed at form level, retirement in the lifecycle section, and existing
assignment operations at the location tab. No actions or product features were
created to fill the layout.

The proof uses a genuine administrator and a synthetic restricted profile with
only the existing Assets read permission in disposable validation databases. Both
receive identical fields and presentation; write/action capabilities and navigation
differ. No field permission is simulated. Provisioning test profiles does not alter
permission definitions or production data.

### Real HTTP/component proof

`presentation-live.proof.ts` is explicit opt-in, like the preceding runtime proof.
It uses existing Angular/Vitest/JSDOM, real HttpClient fetch through production
Nginx and real .NET/PostgreSQL. It checks shared static fields/layout, admin edit,
restricted viewing, navigation differences, cache separation and direct forbidden
CREATE/PATCH/DELETE/action requests (all four return 403).

```bash
docker build --target source -t erbas-client-presentation-proof .
docker run --rm --network <backend-network> \
  -e ERBAS_TEST_EMAIL -e ERBAS_TEST_PASSWORD \
  -e ERBAS_RESTRICTED_EMAIL -e ERBAS_RESTRICTED_PASSWORD \
  -e ERBAS_RUNTIME_LIVE_URL=http://<client>/backends/dotnet \
  -e ERBAS_PRESENTATION_RESOURCE=assets.asset \
  -e ERBAS_PRESENTATION_ID=<disposable-asset-id> \
  erbas-client-presentation-proof npm test -- \
  --include=src/app/resource-runtime/presentation-live.proof.ts
```

The backend owner provisions disposable profiles/tenant membership and an Asset;
the test consumes supplied identities and URL, never configures a production backend.
This real HTTP/component proof passed and its databases/host/proxy were removed.
It is not a browser or visual verification claim.

### Bounded real-browser procedure

Use the same disposable profiles/Asset and the production client through its normal
same-origin proxy. Keep credentials out of URLs and screenshots.

1. Select .NET, log in as admin and open Asset register from backend navigation.
2. Select the proof Asset and Edit. Verify the four ordered tabs and their labels;
   check identity/model/state grouping, purchase fields, location and audit.
3. Change tabs without saving; verify values remain. Open/collapse notes and Audit.
   Observe Complete at form level, Retire in Lifecycle and custody actions at the
   location tab. Contextually unavailable actions are disabled; do not infer state.
4. Verify writable name versus immutable type/read-only lifecycle and identifier.
   Cancel, then log out.
5. Log in as restricted user. The type administration navigation entry disappears;
   Asset register remains. Open the same Asset through View / actions.
6. Verify the same four tabs/fields, no Create/Edit/Delete or entity action controls,
   and a read-only form without Save. This is operation-level restriction.
7. Use Refresh metadata and verify unchanged layout/capabilities; backend requests
   continue to authorize independently. The companion real HTTP proof attempts the
   four forbidden mutations directly, rather than relying on hidden controls.
8. Log out and remove only the disposable proof infrastructure through owner cleanup.

### Historical pre-publication browser evidence

The following browser run and original verification summary predate publication
and formal adoption. Their candidate and old-pin references retain that historical
meaning; they are not the current release status.

Real Chromium browser verification passed against the already-running local
client, .NET and PostgreSQL services. The client was rebuilt from this tree and the
.NET service restarted to load commit `560bfc5` into its startup-frozen resource
registry. No backend rules or contract definitions were changed.

The external, disposable runtime used the official Microsoft image
`mcr.microsoft.com/playwright:v1.56.1-noble` (digest
`sha256:f1e7e01021efd65dd1a2c56064be399f3e4de00fd021ac561325f2bfbb2b837a`),
matching Playwright 1.56.1 installed only inside that temporary image. Chromium
141.0.7390.37 ran headless. No project dependency, package/lockfile or permanent
browser-test configuration was added. Navigation, metadata, CRUD and authorization
were real HTTP operations through the production client proxy, without interception
or mocked responses.

Browser evidence:

- Admin login and server-curated navigation opened the compiled generic fallback
  for the real Asset resource. Four tabs, seven sections and nine groups matched
  the declaration's order, labels and field placement.
- Form/tab/section action placement and contextual enabled/disabled state matched
  the backend. Notes and Audit collapse behavior worked; changing tabs preserved
  unsaved input. Cancel left the persisted Asset name unchanged.
- The complete backend declaration had no unassigned fields; the browser confirmed
  there was no fallback area. Incomplete/missing-layout fallback remains covered
  by the client fixtures rather than weakening backend definition validation.
- Logout removed navigation/resource DOM. Restricted login in the same browser
  fetched fresh metadata without the previous context's If-None-Match. Fields and
  layout were identical; type administration navigation, CRUD write buttons and
  entity action controls differed according to effective metadata.
- Read-only view mode offered no Save; the administrator's writable name and static
  immutable/read-only controls behaved as declared. This is operation-level
  behavior, not effective authorization by field.
- Metadata revalidation produced 304 for each identity and preserved presentation;
  effective metadata/navigation ETags differed between identities.
- Four direct restricted HTTP attempts (CREATE, PATCH, DELETE and entity action)
  returned common 403 errors. There were zero page runtime errors.
- Only the owned proof Asset, restricted identity/claims and tenant membership were
  removed afterwards; deletion was verified. Existing development services/data
  remained available.

### Original verification and remaining limits

Verification completed:

- Client `./bin/check`: 627 Angular tests and 15 Python tests, formatting,
  production build, both isolated proxy/runtime smoke suites and cleanup passed.
- Explicit two-profile real HTTP/component proof passed: identical static
  fields/layout, different effective capabilities/navigation and four direct
  forbidden writes returning 403. Disposable host/proxy/databases were removed.
- Backend commit `560bfc5`: 1,094 native tests and full checks/conformance against
  published v0.12.0 and unchanged candidate v0.13.0 passed independently.
- Diff/scope, credentials/NUL, documentation links, hidden-field mutation guards,
  authorization boundary, context cache, decimal/date and resource-coupling review
  passed. No package/lockfile or shared contract changes occurred.
- Real headless Chromium browser proof passed as described above.

There are no shared contract changes, candidate publication, release/pin changes or client
resource-specific screens. Dynamic Assets composition, field-level authorization,
collection/selection action UI, unsaved route guards, relation joins, bulk operations,
workflow UI, stale-write protocol and server-push remain outside this task.
