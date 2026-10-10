# Full-stack development with the real backends

`bin/demo-up` is a development convenience that calls each repository's own
scripts. Java and .NET retain ownership of their Docker infrastructure, Compose
files, builds, databases and lifecycle. The client defines no backend containers
or combined ecosystem Compose file.

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
prove contract compliance: run `demo-check` for that.

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
expected email, `enabled=true` and `admin=true`. The regular user is created
through administrator-authorized `POST /api/users` with `admin=false`.
A 201 response or 409 `email_conflict` is followed by regular-user login and
`/api/auth/me` verification of the expected email, `enabled=true`, `admin=false`.
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
buttons are added. Tokens remain in memory only. No browser `/api/users` or
`/api/auth/me` proxy is introduced; orchestration accesses backend ports directly.

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
`/backends/dotnet/api/auth/login` routes. Login is same-origin: no CORS changes or
direct browser login to backend host ports are needed. It connects to backend
Docker networks using existing `bin/up` discovery,
with default container names `erbas-app-1` and `alxarafe-dotnet-app-1`. Custom
backend project/container names require the corresponding `ERBAS_JAVA_CONTAINER`
and `ERBAS_JAVA_UPSTREAM`, or `ERBAS_DOTNET_CONTAINER` and
`ERBAS_DOTNET_UPSTREAM`; see [the README](../README.md#backends-and-same-origin-proxy).
These variables are passed through to the existing owner workflows.

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
both direct backends, regular-user admin denial, and each identity's successful
and incorrect-password login through both client proxies. Response structures,
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
including safe JSON construction and regular-user creation/verification; simply
starting three containers does not provision the shared identities.

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
