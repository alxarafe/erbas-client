# Full-stack development with the real backends

`bin/demo-up` is a development convenience that calls each repository's own
scripts. Java and .NET retain ownership of their Docker infrastructure, Compose
files, builds, databases and lifecycle. The client defines no backend containers
or combined ecosystem Compose file.

## Published contract adoption

The client's [contract.revision](../contract.revision) formally declares consumption
of published immutable **erbas-contract v0.13.0**:

- Annotated tag object: `919684db4f607a575397576b87577cd9582e1f86`.
- Target commit: `29bd8de3e5c5772fea5096ab2c60abc6a10e55f7`.

The marker declares the client's contractual target; it is not a package dependency
or a guarantee that a selected backend implements every operation. Client CI does
not clone/download the contract to compare the marker string. Backend repositories
own immutable checkout verification and shared conformance.

.NET formally adopts v0.13.0 at `baf5f4f48ac924e2bed35629835be4d43bfc4ab8`.
Generic Resource Runtime and effective navigation now use published operations
directly. Java support for those operations is not claimed until Java adopts them;
legacy supported features remain usable and navigation failure is reported without
inventing a replacement menu. Historical dual-backend and candidate proofs below
retain their original scope, dates and source identities.

[Generic CRUD](client-runtime-001.md) is the primary presentation path for standard
resource patterns. `RESOURCE_SCREENS` provides explicit compiled overrides for UX
that cannot reasonably be expressed using metadata, renderers or registered
extensions. Shared MANY_TO_ONE, layout and theme improvements benefit every
resource using the pattern; resource-specific screens are not the default path.
See [presentation metadata](client-runtime-002.md) for static layouts and effective
operation-level UI. This policy introduces no new registry, renderer, API, field
permission model or separate CREATE/EDIT layouts.

## Published adoption verification

The published-adoption run used .NET `baf5f4f48ac924e2bed35629835be4d43bfc4ab8`
with its normal validation Host and four fresh disposable databases. The client
ran through its production Nginx proxy on the backend Docker network, without
host ports, response interception or mocks. Backend source and rules were unchanged.

- `./bin/check` passed 627 Angular tests and 15 Python tests, formatting,
  production build and both isolated runtime/proxy smokes.
- Existing `runtime-live.proof.ts` passed: login/profile, effective navigation,
  RESOURCE URL mapping, metadata, generic list/create/PATCH/filter/delete.
- Existing `presentation-live.proof.ts` passed: two real identities, identical
  static fields/layout, effective navigation/capability differences, separate
  caches, ETag revalidation and four forbidden mutations returning 403.
- The documented bounded browser procedure passed using Chromium 141.0.7390.37
  and temporary Playwright 1.56.1, with the same official image/digest recorded in
  [CLIENT-RUNTIME-002](client-runtime-002.md#bounded-real-browser-procedure).
  Real navigation opened the generic RESOURCE screen; four tabs, seven sections
  and nine groups matched metadata. Collapse behavior and unsaved tab state were
  preserved. An administrator executed an action (204); the restricted profile
  had read-only controls and no write/action affordances. Both identities received
  metadata 304 on revalidation; navigation/metadata ETags differed between them,
  and restricted login fetched fresh metadata without the admin conditional tag.
  Direct restricted CREATE/PATCH/DELETE/action attempts all returned 403. There
  were zero page runtime errors.
- Owner cleanup removed the validation Host, client proxy and all four disposable
  databases. Existing PostgreSQL development service/data were preserved.

These are new checks against the adopted published release. The original
pre-publication proofs in CLIENT-RUNTIME-001/002 retain their original versions
and claims. Application code, live proof sources, package files and the Rolldown
installation fix from `8e1fd53` remain unchanged. No permanent browser dependency
or new E2E framework was introduced. The marker declares consumption; these client
proofs do not replace the backend's shared-conformance suite.

## Recommended directory layout and host requirements

```text
workspace/
├── erbas-contract/    # canonical demo/defaults.env
├── erbas/             # Java implementation
├── alxarafe-dotnet/    # .NET implementation
└── erbas-client/      # this repository
```

Use Bash, Docker Engine with Compose v2, permission to access Docker, curl and
Python 3 (standard library only, also used for focused orchestration tests in
`bin/check`). Initial builds need network access to the repositories' image and
dependency registries. Follow each
backend's own host requirements and configuration instructions. No host Node.js
or Angular CLI installation is needed for the client.

Both backend checkouts must provide executable `bin/up` and `bin/down` scripts.
Update to a revision providing those workflows if they are missing; these helpers
do not substitute another Compose invocation. `demo-up` validates all three
`bin/up` scripts before starting anything. `demo-down` similarly validates all
three `bin/down` scripts before stopping anything.

## Reproducible client checks

`./bin/check` uses the same Dockerfile as CI. The dependency stage pins the
Node/Alpine image by version and multi-platform digest, and installs the exact
npm version declared by `app/package.json` (`packageManager`). Application
packages remain installed exclusively with `npm ci` from the committed lockfile.

Rolldown declares its native bindings as optional dependencies. npm can report a
successful install even when downloading or extracting one fails; merely using
`--include=optional` does not make such errors fatal. The Docker installer first
caches the locked Rolldown artifacts for the current OS, CPU and libc as mandatory
operations, then uses `npm ci --include=optional --prefer-offline`. It loads every
locked Rolldown instance before Docker can cache the dependency layer. A failed
artifact download, integrity check or native load therefore fails the build.
There are no application dependency upgrades, platform-specific declarations or
retry loops. Other platforms' bindings stay in the lockfile.

To validate without reusing a dependency layer or host npm state:

```bash
docker build --no-cache --target dependencies .
./bin/check
```

Repeat both commands for an independent fresh installation. Immutable base image
layers may be reused; dependency installation runs again without cache mounts.
These checks use isolated HTTP fixtures and do not establish backend conformance.

## Quick start

From `erbas-client`:

```bash
./bin/demo-up
./bin/demo-check
```

Startup calls Java `./bin/up`, then .NET `./bin/up`, then client `./bin/up`.
This order creates backend networks before the client attaches its proxy to them.
It then waits up to 90 seconds per endpoint for HTTP 200 and prints URL/status
results. A failed owner command or availability check exits nonzero with an
explicit error. Previously started services remain running for diagnosis;
there is no automatic rollback or data deletion. Availability alone does not
verify the demo's HTTP behavior: run `demo-check` for the integration checks below.

The helpers can be invoked from any working directory. Override repository paths
with `ERBAS_JAVA_DIR` and `ERBAS_DOTNET_DIR`; relative overrides are resolved from
the caller's working directory. Paths containing spaces are supported.

```bash
export ERBAS_JAVA_DIR=/path/to/erbas
export ERBAS_DOTNET_DIR=/path/to/alxarafe-dotnet
./bin/demo-up
./bin/demo-check
./bin/demo-down
```

Keep the same environment for startup and checks. `demo-check` requires the
contract defaults file even though it only checks the running backends over HTTP.
`demo-down` does not require the contract defaults file.

## Demo identities

`erbas-contract/demo/defaults.env` is the canonical source for the four initial
public demo values. Both `demo-up` and `demo-check` require this file. Set
`ERBAS_CONTRACT_DIR` to use another checkout; the default is `../erbas-contract`
relative to this client repository. Explicit relative overrides are resolved
from the caller's working directory. The backends never read this file directly.
This setting selects the demo defaults file; it does not pin or verify a backend
release. Each backend's `contract.revision` and authoritative `./bin/check` own
release verification and shared conformance.

Export any of these variables to override its corresponding contract value:

- `ERBAS_DEMO_ADMIN_EMAIL`
- `ERBAS_DEMO_ADMIN_PASSWORD`
- `ERBAS_DEMO_USER_EMAIL`
- `ERBAS_DEMO_USER_PASSWORD`

An exported value takes precedence, including an empty value (which fails
validation). All four effective values must be nonempty, contain no CR/LF/NUL,
and use distinct admin/user emails. A small explicit KEY=VALUE parser preserves
literal characters without shell evaluation. Keep overrides consistent for
`demo-up` and `demo-check`. **These are intentionally public development/demo
credentials, not secrets; never use them in production.** Passwords and tokens
are not printed by the orchestration.

`demo-up` maps the administrator to Java's existing controlled bootstrap:
`ERBAS_AUTH_BOOTSTRAP_ENABLED=true`, `ERBAS_AUTH_BOOTSTRAP_ADMIN=true`,
`ERBAS_AUTH_BOOTSTRAP_EMAIL` and `ERBAS_AUTH_BOOTSTRAP_PASSWORD`. It maps the same
identity to .NET's `ERBAS_CORE_ADMIN_EMAIL` and `ERBAS_CORE_ADMIN_PASSWORD`, which
Compose forwards as `SecuritySeed__AdminEmail` and `SecuritySeed__AdminPassword`.
Both remain independently runnable. No additional seed subsystem or migration
is introduced, and registration semantics are unchanged.

After backend startup, administrator login and `/api/auth/me` must confirm the
expected email, `enabled=true` and `admin=true`. The regular demo identity must
already exist. Startup verifies regular-user login and `/api/auth/me` with the
expected email, `enabled=true`, `admin=false`, without creating accounts. The
legacy explicit provisioning helper remains available separately; `demo-up`
uses verification only so persistent data is not mutated by this workflow.
The regular user must also receive contractual 403 `forbidden` with no-store
from `GET /api/users`. No user is seeded directly or granted module permissions.
.NET reader/creator accounts remain separate backend/module development fixtures;
they are no longer the ecosystem demo defaults.

Repeated startup works with persistent databases when identities still match.
Existing credentials/state are never silently reset, re-enabled, promoted or
demoted. A modified persisted demo identity fails clearly: reset/recreate the
development environment deliberately, or provide matching `ERBAS_DEMO_*`
overrides. No automatic account-reset behavior is implemented. Backend startup
conflicts also fail safely rather than overwriting accounts. Existing volumes
are retained.

The four effective values pass to the client container. An Nginx entrypoint
writes public `/demo/defaults.env` only when all values are supplied, rejecting
empty/CR/LF values. The resource uses no-store. Angular reads it optionally and
shows both identities as “Default demo values”, with a development warning and
account-mutation caveat. Missing/invalid optional configuration hides the values
without affecting Health, login or backend selection. No auto-login or fill
buttons are added. Tokens remain in memory only. The browser can load its current
profile and administrator collection/detail, and manage users through protected
proxies. Identity verification uses backend ports directly; read verification
covers direct endpoints and client proxies. Creation forwarding checks use an
existing demo email for 409 and a regular bearer for 403, without adding accounts.

## Ports and proxy routes

| Component | Default host URL | Host-port override | Container port |
| --- | --- | --- | --- |
| Java Health | `http://127.0.0.1:48080/health` | `ERBAS_JAVA_PORT` | 8080 |
| .NET Health | `http://127.0.0.1:48081/health` | `ERBAS_DOTNET_PORT` | 8080 |
| Client | `http://127.0.0.1:48082` | `ERBAS_CLIENT_PORT` | 80 |

Use the same exported port variables for startup and checks. They follow the
[shared development port convention](https://github.com/alxarafe/erbas-contract/blob/main/docs/development-ports.md)
and do not change the HTTP contract or the caller-supplied base URL. Publications
are loopback-only; databases are not published by the client.

The client exposes `/backends/java/health` and `/backends/dotnet/health` on its own
origin, plus the exact `/backends/java/api/auth/login` and
`/backends/dotnet/api/auth/login` routes. The exact `/backends/java/api/users`
and `/backends/dotnet/api/users` collection routes allow GET and POST (WEB-003C).
The profile route `/backends/{backend}/api/auth/me` remains GET-only. Detail
routes `/backends/java/api/users/{id}` and `/backends/dotnet/api/users/{id}` allow
GET and PATCH only. The exact
`/backends/java/api/ai/assistant/invocations` and
`/backends/dotnet/api/ai/assistant/invocations` routes allow POST only and map
to the backend `/api/ai/assistant/invocations` operation. POST/DELETE on detail,
PATCH on collection/profile, non-POST assistant requests, and extra path
segments remain blocked. The detail proxy preserves the encoded opaque ID as one
segment and blocks redirects. Login, user reads and assistant calls are
same-origin: no CORS changes or direct browser login to backend host ports are
needed. It connects to backend
Docker networks using existing `bin/up` discovery,
with default container names `erbas-app-1` and `alxarafe-dotnet-app-1`. Custom
backend project/container names require the corresponding `ERBAS_JAVA_CONTAINER`
and `ERBAS_JAVA_UPSTREAM`, or `ERBAS_DOTNET_CONTAINER` and
`ERBAS_DOTNET_UPSTREAM`; see [the README](../README.md#backends-and-same-origin-proxy).
These variables are passed through to the existing owner workflows.

## Authenticated user list (WEB-003A)

Choose either backend, sign in, and load the current profile. Administrators can
then select **Load users**. The same Angular
UsersClient consumes the published v0.4.0 USERS-001 / COLLECTIONS-001 endpoint
from Java or .NET. Access is administrator-only, enforced by the shared contract
and backend. The client does not parse the opaque bearer; the loaded profile
informs UI visibility, while backend authorization remains authoritative.

The table shows ID, email, enabled and administrator flags. Total, offset and
limit come from the response. Previous/Next use a fixed limit of 50, starting
at offset 0, without negative offsets or paging past the reported total.
Reload requests the current window. Empty windows, including offsets beyond a
changed total, remain valid and allow returning with Previous. IDs remain opaque;
the UI preserves server order and validates exactly `id ASC` metadata.

Success requires HTTP 200, JSON media type (charset parameters allowed), no-store,
the exact closed collection and User fields, nonempty ID/email strings, Boolean
flags and valid integer metadata. Offset/limit must echo the request, and item
count must match the contractual window. Invalid pagination arguments are
rejected before HTTP. Invalid success bodies are never partially displayed.

Loading/reloading removes old rows. A protected 401 discards the unusable token
and asks for authentication again; 403 keeps the session and explains the
administrator requirement. 400 reports an invalid request; network/5xx failures
report service unavailability; malformed success reports an invalid response.
No backend payloads, internal errors or tokens are displayed.

Backend switching, Clear session and a replacement login cancel pending profile,
collection and detail requests and discard all protected data. Switching or
signing in again starts at
offset 0. Authentication stays exclusively in the existing memory-only,
backend-bound AuthSession. Tokens never enter storage, cookies or URLs.
Search, filtering and custom sorting remain unimplemented. Basic updates are documented below.
Creation is documented in WEB-003C below.
Profile/detail reads are documented below; historical WEB-003A scope was listing only.

Angular HTTP/component tests verify both backend flows, pagination, errors and
cancellation. Isolated Docker smoke tests exercise both users proxies, including
bearer/query forwarding, no-store, 400/401/403, redirect blocking and refusal of
mutations. `demo-check` verifies real profile/list/detail HTTP behavior through
both proxies; it does not drive browser interaction.

## Current profile and user detail (WEB-003B)

Successful login establishes a backend-bound memory-only bearer and immediately
requests `GET /api/auth/me`. The compact profile shows email, enabled and admin.
Login and profile state remain distinct. Profile loading, unavailability and
invalid response are explicit; network/5xx/malformed-success failures retain the
bearer and offer **Reload profile**. Unexpected `/me` 403/404 is unavailability,
not a new contractual authorization result. A 401 clears the session and all
protected data and asks the user to sign in again.

Only a loaded `admin=true` profile offers collection and detail controls.
`admin=false` keeps authentication and explains the administrator requirement.
This is UI guidance, not security: backend 403 handling remains mandatory when
privileges change after the profile was loaded. No privilege polling is added.

Each collection row offers **View**, which fetches `GET /api/users/{id}` rather
than reusing the row as detail. IDs remain opaque and are encoded as one path
segment. The detail panel identifies the selection and shows ID, email, enabled
and admin. A new selection cancels the prior request and clears stale detail.
403 preserves the session and reports administrator access required; 404
preserves it and reports user not found; network/5xx and malformed successes
report unavailable and invalid response respectively. 401 clears profile,
collection, detail and bearer. Reloading/paging the collection clears its old
selection; reloading profile clears protected data before resolving privileges.

One User validator serves profile, list items and detail: exact four fields,
nonempty ID/email strings and Boolean flags. Individual reads require HTTP 200,
JSON (normal charset parameters accepted) and contractual no-store. Invalid
responses never populate partial data. Bearers are explicit request headers,
never stored, logged, parsed or placed in a URL. Switching backends, Clear session,
replacement login and destruction cancel pending requests; old responses cannot
populate the new selection. Password management remains outside scope;
creation and basic updates are documented below. No router, interceptor, schema
library or new dependency is added.

Angular HTTP/component tests cover both backends, response validation, admin UI,
401/403/404, cancellation and WEB-003A regression. `demo-check` additionally verifies
administrator and regular profiles, list/detail, regular-user 403, invalid-bearer
401 and unknown-user 404 directly and through both client proxies. These new checks
are read-only; existing demo provisioning semantics are unchanged. Component tests
verify rendered interaction; real HTTP checks do not claim browser automation.

## Administrator user creation (WEB-003C)

A loaded `admin=true` profile shows **Create user** for either backend. It sends
`POST /api/users` with the explicit bearer and exactly `email`, `password`, `admin`.
Administrator is a checkbox defaulting to false; enabled is chosen by the server.
The email input preserves the entered text without trimming, normalization,
case folding or syntax validation. Password accepts 12–256 Unicode code points,
including supplementary characters and whitespace, without trimming/composition.
Local invalid input is not sent and can be corrected in place.

While submitting, the form is busy and its submit button disabled. The password
is read directly from the input, never kept in a signal or persisted, never logged
or shown, and cleared after success, HTTP error or cancellation. HTTP errors keep
email/admin available for retry; success also resets email and admin. Only the
public created User is retained in memory.

Success requires HTTP 201, JSON and no-store plus the exact closed User shape:
nonempty ID/email, Boolean enabled/admin, enabled=true, and email/admin matching
the request exactly. A 200 or malformed 201 (including an Angular JSON parse
error) is an invalid response. Expected errors are validated as closed JSON,
no-store and the exact code before applying UI semantics:

| Status | Code | Client behavior |
| --- | --- | --- |
| 400 | `invalid_request` | Invalid-request message; session retained. |
| 401 | `unauthorized` | Requires `WWW-Authenticate: Bearer`; discards session and all protected data. |
| 403 | `forbidden` | Requires no challenge header; retains profile/session and reports administrator access required. |
| 409 | `email_conflict` | Duplicate-email message; retains session, collection and detail for correction/retry. |

Non-contractual representations of these errors are invalid responses, rather
than functional failures. Network/5xx or unexpected statuses are unavailable.
These failures retain authentication unless a validated 401 proves it unusable.
Backend authorization remains authoritative despite the profile's admin flag.

There is no optimistic insertion: IDs and ID ascending order belong to the
server. A valid 201 reloads an already loaded collection at the same offset,
obtaining its new window/total/order. It does not load a previously unloaded
collection or guess where the new ID belongs.

Backend changes, Clear session, replacement login, profile reload, destruction
and replacement creation cancel observations and discard stale creation results.
Cancellation aborts transport when possible and prevents old responses updating
a new session/backend; it **does not roll back a POST already processed by the
server**. No automatic retry is added.

For protected users, Nginx allows POST only on the two exact collection routes.
`/api/auth/me` stays GET-only. WEB-003D allows GET/PATCH on detail only;
POST/DELETE on detail and PATCH/DELETE on collection/profile remain blocked.
Common bearer/body/header forwarding, no buffering, redirect rejection
and backend isolation are preserved.

Angular tests cover creation, strict success/error validation, Unicode boundaries,
password cleanup, cancellation and list refresh. Runtime mocks exercise
201/400/401/403/409 through both proxies and coherent subsequent reads. Real
`demo-check` verifies existing-email 409 and regular-user 403 through Java and .NET
proxies without creating accounts or resetting volumes. Real 201 is not exercised
by this persistent demo; backend conformance and client unit/runtime checks cover
it separately. Password changes, DELETE and roles/permissions UI remain
unimplemented; basic enabled/admin updates are documented below.

## Administrator user update (WEB-003D)

This slice closes WEB-003 basic user administration against published contract
v0.4.0, using the same Angular code and observable behavior for Java and .NET.
An administrator loads the existing user detail, changes **Enabled** and/or
**Administrator**, then submits **Update user**. ID/email remain informational;
there are no email/password edit inputs or new screen/router.

`UpdateUserRequest` has optional readonly boolean `enabled`/`admin` fields.
Runtime validation accepts only a nonempty closed object with one or both
fields. `UsersClient.update()` rejects empty IDs/invalid bodies before HTTP,
encodes opaque IDs with `encodeURIComponent`, and sends PATCH with explicit
JSON Accept/Content-Type and backend-bound Bearer authorization. The component
compares checkboxes to the current detail and sends only differences. No changes
means no request and a local `NoChanges` state, rather than a backend 400.

A valid success is exactly 200, JSON, no-store and the existing closed User
schema. Returned ID must equal the requested ID and every sent field must equal
its requested value. Unsent fields are accepted from the server without guessed
expectations. Other successful statuses, malformed bodies/headers and Angular
JSON parse failures at 200 are `InvalidResponse`. Transport/5xx/unexpected error
statuses are `Unavailable`. Contractual errors must first pass closed-body,
exact-code, JSON/no-store and applicable challenge validation:

| Status/code | Client behavior |
| --- | --- |
| 400 `invalid_request` | Retain session/detail and report invalid request. |
| 401 `unauthorized` | Require Bearer challenge; discard session and all protected data. |
| 403 `forbidden` | Require absent challenge; retain session/data and explain admin requirement. |
| 404 `user_not_found` | Retain session; discard stale detail and report missing target. |
| 409 `last_admin` | Retain session/detail/list and checkbox selection; explain zero enabled admins. |

Malformed contractual errors are `InvalidResponse`, never their functional state.
The client does not count users, guess the last administrator or block a valid
request from the loaded window. The backend enforces the invariant atomically.

On confirmed success, detail becomes exactly the returned User. A matching row
in the loaded collection is replaced with that same response; other rows,
offset/limit/total/order stay unchanged. No insertion, ID comparison/reordering,
optimistic update or collection reload is needed.

Self-updates compare the returned ID to `/api/auth/me`. If the returned user is
disabled, the bearer is immediately discarded and all protected data cleared.
If enabled but no longer admin, the bearer stays, current profile becomes the
returned User, and collection/detail/create/update data and admin UI disappear.
If still enabled/admin, current profile is updated while the session remains.
Updating another user does not change the current profile. No rollback is tried.

The update subscription belongs to the protected lifecycle: another detail,
backend switch, Clear session, replacement login, profile reload, collection
reload/pagination, replacement PATCH and component destruction cancel it.
Checkboxes reset with new detail contexts. Cancellation prevents stale response
acceptance but **does not roll back a PATCH already processed by the server**.
There are no automatic retries.

Nginx changes only the existing validated detail location from GET to GET/PATCH.
Encoded single-segment IDs, extra-segment rejection, bearer/body/Content-Type,
backend isolation, redirect rejection and disabled buffering remain intact.
Collection stays GET/POST and profile stays GET-only.

Angular contract/component tests cover partial requests, strict response/error
validation, server-confirmed row replacement, self-updates and cancellation.
The isolated fake mutates only its in-memory collection; subsequent detail/list
reads reflect PATCH results. It counts enabled administrators in the proposed
result and rejects last-admin mutations without changing state. Both proxy smoke
flows cover 200/400/401/403/404/409, encoded IDs and still-blocked methods.

Real `demo-check` first verifies the probe ID is absent with administrator GET
(404), refusing to send any PATCH if this precondition fails. It probes PATCH
only with a regular bearer (403) and an
administrator bearer targeting an absent ID (404), through both client proxies.
It never sends an administrator PATCH to an existing persistent identity, never
tests real 200/409, and never changes enabled/admin/email/password, creates
accounts, resets accounts or deletes volumes. `demo-up` now verifies the existing
regular identity instead of provisioning one. Success/last_admin are covered in
Angular/fake checks; backend conformance remains a separate backend-owned fact.

The following scope statement records the original WEB-003D slice; current
generic CRUD and routing are covered separately by CLIENT-RUNTIME-001/002.

Email/password editing, DELETE, roles/permissions, search/filter/custom sorting,
generic CRUD and routing remain outside scope. No dependencies are added.

### WEB-003D local verification (2026-10-12)

`./bin/check` exited 0: all 374 Angular tests (14 files, including 60 PATCH
contract and 26 update component tests), 13 Python tests, formatting, shell/
Compose validation, production build and both isolated runtime/proxy flows
passed. Existing Health/login/profile/list/detail/create tests remain enabled.
Both mock proxies passed PATCH 200/400/401/403/404/409, coherent subsequent reads,
and explicit blocking of PATCH collection/profile and POST/DELETE detail.

The final `./bin/demo-up`, `./bin/demo-check` and `./bin/demo-down` each exited 0.
Java and .NET PATCH forwarding passed regular-user 403 and verified-absent-target
404 through the client. No persistent identity was modified, no accounts were
created and no volumes were removed. Real PATCH 200/409 were not attempted.
`git diff --check` passed. Scope review found only enabled/admin updating, with
no new dependencies, secrets, backend-specific client behavior or magic literals.
The README's obsolete editing limitation was generalized; detailed behavior
and evidence live here. These checks do not claim a new backend conformance run.

## ERBAS Assistant (AI-001C)

The Angular application exposes a minimal synchronous **ERBAS Assistant** for the
selected backend. It consumes the published AI-001 operation from
the adopted erbas-contract v0.13.0 and sends exactly one closed `message` field to
`POST /api/ai/assistant/invocations` through the same-origin proxy. The section
is visible before login and explains that authentication is required; the form
appears only with an authenticated, backend-bound bearer.

The .NET backend implements AI-001. The Java backend may return 404 for this
operation until it adopts the published capability; the client treats that as
"not available on the selected backend" without naming an implementation or
changing its request. No backend-specific branch or provider configuration exists
in Angular. This client work does not claim that Java implements AI-001 or that
either backend has passed full v0.11.1 conformance.

Messages are sent unchanged, including whitespace and line breaks. Local
validation requires at least one non-whitespace scalar value, rejects NUL and
unpaired surrogates, and limits the message to 4000 Unicode scalar values.
JavaScript `.length` is not used as the contract limit, so supplementary
characters and the exact 4000-scalar boundary are handled correctly. Invalid
input stays in the textarea for correction and is not sent.

Only one assistant request is active at a time. Another submission, backend
switch, Clear session, replacement login or component destruction cancels it and
prevents a stale result from updating a newer context. Successful answers replace
the prior answer and clear the textarea; recoverable errors preserve the typed
message for an explicit retry. There is no automatic retry.

A successful response requires HTTP 200, JSON, `Cache-Control: no-store`, no
`WWW-Authenticate`, and the exact closed fields `invocationId`, `answer` and
`toolsUsed`. Identifiers are nonempty opaque strings; every tool entry has exactly
`capabilityId` and `invocationId`, and capability IDs follow the published CORE
format. `toolsUsed` may be empty and is not displayed. The answer is rendered as
plain interpolated text with preserved line breaks, never HTML or Markdown.

Expected failures are validated as closed JSON error envelopes with
`Cache-Control: no-store` and only the applicable Bearer challenge:

| Status/code | Client behavior |
| --- | --- |
| 400 `invalid_request` | Report invalid assistant request; retain session and message. |
| 401 `unauthorized` | Require Bearer challenge; discard session and all protected/assistant state. |
| 403 `forbidden` | Require absent challenge; retain session and report missing assistant authorization. |
| 404 | Treat the exact operation as unavailable on the selected backend; retain session. |
| 500 `assistant_execution_failed` | Report a safe execution failure; hide internal/provider details. |
| 503 `module_disabled` | Report that the AI module is disabled; retain session. |
| 503 `assistant_unavailable` | Report temporary unavailability; retain session and allow explicit retry. |

Malformed expected statuses, bodies or headers are invalid responses rather than
functional states. Other statuses, transport failures and proxy errors are
reported neutrally as unavailable. Raw response bodies, tokens, provider/model
information, prompts, tool payloads and backend diagnostics are never displayed.

The two exact Nginx assistant locations forward the bearer, request body and
contractual response status/body/headers, reject every method except POST, block
redirects through the shared protected proxy policy, disable buffering/caching
and access logs, and leave unrelated `/backends/` paths closed. The synthetic
runtime mocks verify both routes, unchanged request bodies, Authorization
forwarding, 200 with empty or nonempty tool usage, 400/401/403/500/503, required
headers and unrelated method/path rejection. No live provider is called.

Conversation history, memory, RAG, embeddings, streaming, Markdown rendering,
WRITE actions, approvals, capability browsing, provider/model selection, prompt
administration, telemetry and prompt/answer persistence remain outside scope.
The only stored value is the existing backend selection; the bearer and assistant
answer remain in memory.

## Stop

```bash
./bin/demo-down
```

Shutdown calls client, .NET, then Java `./bin/down`, without arguments requesting
volume removal. Already stopped services are handled by the owner's normal down
workflow. If an owner command fails, shutdown still attempts the remaining owners
and exits nonzero. No helper deletes backend data or volumes.

## Integration validation versus isolated validation

`./bin/demo-check` requires the ecosystem to be running. It checks the original
five targets:
Java direct Health, .NET direct Health, client HTTP, client → Java Health and client
→ .NET Health. Each Health check requires HTTP 200, `application/json` (optional
media-type parameters are accepted), and exactly the JSON object
`{"status":"ok"}`. Extra or duplicate properties, invalid JSON, redirects and
request failures are rejected. Requests have bounded timeouts and bypass host
HTTP proxy settings for these loopback endpoints. A failed target produces a
nonzero exit code. A backend revision with another Health
representation will fail; the client does not adapt that response.

It also verifies administrator and regular-user login plus `/api/auth/me` on
both direct backends, read-only profile/list/detail and 401/403/404 through both
client proxies, regular-user admin denial, and each identity's successful
and incorrect-password login through both client proxies. WEB-003C also checks
POST forwarding with administrator existing-email 409 and regular-user 403;
these checks neither create accounts nor alter persistent identities. WEB-003D
adds non-mutating PATCH forwarding checks for regular-user 403 and absent-target
404; real 200/409 are deliberately excluded. Response
structures,
status codes and contractual no-store/challenge headers are checked. The client
runtime resource must exactly match the four effective shared values. Angular
component tests prove those resource values are displayed, completing the path
from contract defaults through orchestration and runtime to Angular-visible data.
Tokens and login responses stay in memory; response details are withheld on error.

`./bin/check` remains the authoritative isolated repository validation used by
normal CI. It runs focused Python parsing/override/idempotence tests, Angular
component tests, production build and Docker runtime/proxy smoke checks against
isolated mocks. Runtime checks cover both absent optional demo configuration and
supplied disposable values. `demo-check` is separate real integration evidence,
not normal CI or a substitute for the backend shared Bruno suites.

For manual diagnosis, use each owner's `bin/up`/`bin/down` with the mappings above
and inspect direct/proxied Health. Prefer `demo-up` for the complete sequence,
including safe JSON construction and existing-identity verification. Provision
the regular identity independently before using this persistent demo workflow.

## DEMO-001B integration verification (2026-10-10)

Verified with the three `feature/demo-001-shared-identities` branches and the
unchanged contract checkout at `74abd8ddcafbcdf65530b7f4711002b74c045771`, containing
DEMO-001A `2310183c3887f6a6c9d4faf60863925e1fc3c3a9`. The source was its
`demo/defaults.env`; no demo overrides were exported for the real runs.

`./bin/demo-up`, `./bin/demo-check` and `./bin/demo-down` passed. Repeated startup
and a second `demo-check` passed against the same persistent databases. Both
administrator and regular-user login/current identity, regular-user 403 denial,
direct/proxied Health, successful/incorrect-password proxy login and exact client
runtime values were verified. No passwords or tokens were printed or persisted
by the checks. Owner shutdown succeeded; the existing database and Identity key
volumes remained present. No persistent volumes were removed.

The repeated run exposed a Java readiness-probe issue after rebuilding an
unchanged container: its historical image manifest was no longer available.
Java's owner script now selects the container's configured image reference for
the host-port probe. Repeated startup then passed without account/data changes.

Client `./bin/check` passed six focused Python tests, 62 Angular tests, production
build and runtime/proxy checks with and without demo values. Disposable overrides
proved precedence without editing contract defaults. Modified-account refusal is
covered by focused tests; no real demo account was deliberately mutated for this
verification. UI display is verified by Angular component tests; production
runtime values are verified over HTTP, not by a browser UI test. Backend checks
use their unchanged pinned contract revision separately from the defaults source.

## WEB-002 integration verification (2026-10-09)

Verified locally against the existing development volumes. Java started with
Flyway V1 only; startup applied V2 successfully. The V1 marker remained ID 1,
with its original creation timestamp `2026-10-09 17:25:51.602935+00`.
Java bootstrap created the single `reader@example.test` account; repeated startup
reused that account. .NET reused its existing reader identity with unchanged ID.
Both named PostgreSQL volumes were preserved, with no reset or volume removal.

`demo-check` passed both direct and proxied Health checks and both real login
200/401 exchanges through the client, including JSON and contractual headers.
No browser was available in the verification environment; UI behavior is covered
by Angular component tests, while the production client and login proxy were
verified over HTTP. This evidence does not claim protected API or token-use
validation by the client.
