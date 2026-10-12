# ERBAS Client

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

[![Java backend CI](https://github.com/alxarafe/erbas/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alxarafe/erbas/actions/workflows/ci.yml)
[![.NET backend CI / shared conformance](https://github.com/alxarafe/alxarafe-dotnet/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alxarafe/alxarafe-dotnet/actions/workflows/ci.yml)
[![Angular client CI](https://github.com/alxarafe/erbas-client/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alxarafe/erbas-client/actions/workflows/ci.yml)

The shared Angular client demonstrates **one executable contract, multiple
interchangeable implementations**. It provides backend selection, public Health,
shared authentication and basic administrator user management with pagination,
consuming published erbas-contract v0.4.0.
It uses standalone components, strict TypeScript, HttpClient and signals.
Angular 22 is built inside Docker; Nginx serves the production bundle.

[erbas-contract](https://github.com/alxarafe/erbas-contract) is the HTTP authority.
The same Health client consumes Java ([alxarafe/erbas](https://github.com/alxarafe/erbas))
and .NET ([alxarafe/alxarafe-dotnet](https://github.com/alxarafe/alxarafe-dotnet)).
It requires `GET /health`, `Accept: application/json`, HTTP 200 and a JSON object
containing exactly `{"status":"ok"}`. Additional properties, incorrect media types,
invalid JSON, other statuses, redirects, timeouts and connection failures are errors.
Health indicates HTTP process liveness, not database readiness.

| Repository | Responsibility |
| --- | --- |
| [erbas-contract](https://github.com/alxarafe/erbas-contract) | Shared OpenAPI and sole Bruno conformance collection; published immutable v0.4.0 |
| [erbas](https://github.com/alxarafe/erbas) | Java/Spring Boot implementation of v0.4.0 |
| [alxarafe-dotnet](https://github.com/alxarafe/alxarafe-dotnet) | .NET implementation of v0.4.0 plus platform modules |
| [erbas-client](https://github.com/alxarafe/erbas-client) | Shared Angular client for Health, authentication and basic user administration from either backend |

The Angular badge reports client tests, build, runtime and isolated proxy checks.
Java and .NET badges report each backend's authoritative `./bin/check`, including
mandatory shared conformance against published `v0.4.0`. The Angular client
consumes these shared operations; its CI does not perform backend shared conformance.
The [verified real dual-backend demo](docs/full-stack-development.md#web-002-integration-verification-2026-10-09)
is separate integration evidence; no badge claims contract-repository CI.

## Full-stack Quick Start

With sibling `../erbas-contract` containing `demo/defaults.env`, and `../erbas`
and `../alxarafe-dotnet` providing their own `bin/up` and `bin/down` scripts:

```bash
./bin/demo-up
./bin/demo-check
```

Stop with `./bin/demo-down`. See [full-stack development](docs/full-stack-development.md)
for host requirements, repository/port overrides and the equivalent manual workflow.
`demo-up` is a development convenience; each backend continues to own its scripts
and Docker infrastructure. `demo-check` validates the real ecosystem separately
from the isolated `bin/check` suite used by normal CI.

## Host requirements and workflow

Docker Engine with Docker Compose v2, Bash, Python 3 and permission to use Docker
are required. Python uses only its standard library for demo orchestration and
focused tests. Initial builds need network access to image and npm registries.
The host needs neither Node.js nor Angular CLI. Run from this checkout:

```bash
./bin/up       # build and start; open http://127.0.0.1:48082
./bin/down     # stop and remove the client's Compose containers/network
./bin/test     # Angular unit/component tests with mocked HTTP
./bin/check    # authoritative validation; also used unchanged by GitHub Actions
```

`bin/check` runs shell syntax and Compose validation, all Angular tests, the
production build, and runtime checks of the shared API proxies against two
isolated mock servers.
It publishes no validation ports and removes its temporary containers, network
and image tags. Docker build caches and downloaded base images remain reusable.
The suite does not require either actual backend to be running.

## Development ports

| Component | Default host endpoint | Container port |
| --- | --- | --- |
| Java | `http://127.0.0.1:48080` | 8080 |
| .NET | `http://127.0.0.1:48081` | 8080 |
| Client | `http://127.0.0.1:48082` | 80 |

The client publication binds exclusively to loopback. Override its port:

```bash
ERBAS_CLIENT_PORT=49082 ./bin/up
```

Ports follow the [shared development convention](https://github.com/alxarafe/erbas-contract/blob/main/docs/development-ports.md)
and are infrastructure settings, independent of HTTP behavior.
Changing the client origin also changes its origin-scoped localStorage selection.

## Backends and same-origin proxy

Start the backends using their own repository workflows, then run `./bin/up`.
The initial dropdown contains **ERBAS Java / Spring Boot** (`java`) and
**Alxarafe.NET / ASP.NET Core** (`dotnet`). Selection triggers a Health check and
persists its identifier in localStorage. Missing or obsolete selection defaults
to Java; disabled storage does not prevent using the application. Check again
retries manually. The screen displays checking, online, or offline/error with
request duration and last-check time. Technical errors are not shown to users.

```text
browser -> 127.0.0.1:48082 -> Nginx :80
                              /backends/java/health   -> Java container :8080/health
                              /backends/dotnet/health -> .NET container :8080/health
                              /backends/java/api/auth/login   -> Java :8080/api/auth/login
                              /backends/dotnet/api/auth/login -> .NET :8080/api/auth/login
                              /backends/java/api/users -> Java :8080/api/users
                              /backends/dotnet/api/users -> .NET :8080/api/users
                              /backends/{backend}/api/auth/me -> selected backend :8080/api/auth/me
                              /backends/{backend}/api/users/{id} -> selected backend :8080/api/users/{id}
```

The displayed development URLs are informational. Browser requests use relative,
same-origin proxy URLs. No CORS changes or backend-specific Health code are needed.
Docker bridge containers cannot reach a host service published only on loopback;
therefore `bin/up` attaches only the client container to each existing backend's
Docker network. It leaves backend containers and repositories unchanged. Nginx
resolves upstream container names at request time, so a missing backend produces
an error without preventing client startup. No database or extra service is published.

Default backend container names are `erbas-app-1` and `alxarafe-dotnet-app-1`.
If a backend starts after the client, rerun `./bin/up` to attach its network.
For custom Compose project names, supply both the discovery container and upstream:

```bash
ERBAS_JAVA_CONTAINER=my-java-app-1 \
ERBAS_JAVA_UPSTREAM=my-java-app-1:8080 ./bin/up
```

Equivalent settings are `ERBAS_DOTNET_CONTAINER` and `ERBAS_DOTNET_UPSTREAM`.
Upstreams must be trusted Docker DNS names (with port), reachable on the attached
networks. These are deployment configuration, not user-provided proxy destinations.
Only Health, `/api/auth/login`, `/api/auth/me` and users collection/detail paths
are proxied. Each route permits only its implemented contract methods; other
methods and extra detail path segments are blocked. See the
[proxy details](docs/full-stack-development.md#ports-and-proxy-routes).
All other `/backends/` paths return 404. Login preserves backend HTTP statuses, JSON
bodies, `Cache-Control: no-store` and `WWW-Authenticate: Bearer`.
Protected proxies forward the bearer, pagination query or encoded opaque ID,
preserve contractual errors and headers, block redirects, and disable buffering,
caching and access logs.
This workflow targets the existing Docker backends, rather than arbitrary host-native
processes. A deployment-specific network configuration would be needed for those.

## Structure and extending the client

- `app/src/app/backends.ts`: central typed registry, public endpoint metadata and proxy routes.
- `app/src/app/backend-selection.ts`: selection and storage recovery.
- `app/src/app/health-client.ts`: destination-neutral HTTP client and contract validation.
- `app/src/app/auth-client.ts`: destination-neutral AUTH-001 login and response validation.
- `app/src/app/auth-session.ts`: one in-memory session tied to its issuing backend.
- `app/src/app/users-client.ts`: destination-neutral protected user operations with one closed User validator.
- `app/src/app/app.*`: shared presentation, pagination and protected request cancellation.
- `Dockerfile`, `compose.yaml`, `docker/`: build, runtime proxy and isolated smoke fixtures.
- `bin/`: lifecycle and validation workflows; `.github/workflows/ci.yml`: calls `bin/check`.

To add an implementation, add a registry entry and an exact Nginx Health route,
exact login and users routes, then configure its upstream/network. No HTTP client changes
are needed. The small
HTTP service can later be replaced with a contract-generated client without changing
backend selection. Dependency resolution is recorded in `app/package-lock.json`;
normal builds use `npm ci`.

## Current scope and limitations

WEB-002 implements the same email/password login form for Java and .NET through
`POST /api/auth/login` on the same-origin Nginx proxy. Invalid credentials produce
a neutral message; request, service and invalid-response failures remain distinct.
The UI never displays bearer tokens or interprets their format.

The access token is an opaque string, kept only in memory. Java and .NET issue
different, non-interoperable tokens; each session belongs only to its issuing
backend. Changing backend cancels pending login and discards the session, even
when returning to the previous backend. Reloading also loses the session.
**Clear session** discards local state only; it does not revoke the server token.
Only the backend selection is persisted in localStorage.

After login, `/api/auth/me` loads the current email, enabled and administrator
flags. A loaded administrator profile offers **Load users** and row **View**
actions; regular users remain authenticated without administrator controls.
Backend authorization remains authoritative. **View** fetches a fresh user detail
through `GET /api/users/{id}` with a safely encoded opaque ID. The
table shows public user fields and server total; Previous/Next use fixed windows
of 50 in contractual ID ascending order. 401 discards the unusable session;
403 preserves it and explains the administrator requirement. Clearing or
switching sessions cancels requests and removes profile, collection and detail.
Profile network/5xx/invalid-response failures retain the bearer and allow retry;
detail 404 reports user not found without clearing authentication. See
[user listing](docs/full-stack-development.md#authenticated-user-list-web-003a) and
[profile/detail](docs/full-stack-development.md#current-profile-and-user-detail-web-003b)
for response validation and error states.

Administrators can create users and update their enabled/administrator flags.
Credentials are never persisted. Server-confirmed changes refresh the displayed
user data; self-updates immediately adjust local session access. See
[basic user administration](docs/full-stack-development.md#administrator-user-update-web-003d)
for behavior, error handling and verification limits.
Email/password changes, deletion, roles and permissions remain outside scope,
along with refresh, registration, server logout, ERP navigation, SSR, PWA and
production deployment.
Health stays public and independent of authentication. The client does not adapt
nonconforming responses. Health redirects are blocked by Nginx; login statuses
and bodies pass through without error interception. Proxy timeouts are bounded.

`bin/check` verifies the shared API proxies against isolated mocks;
`bin/demo-check` verifies both real development backends through the client.
The demo reads public administrator and regular-user defaults from
`erbas-contract/demo/defaults.env`, with explicit `ERBAS_DEMO_*` overrides.
Backend-owned startup provides the administrator; the helper verifies existing
demo identities without creating or resetting accounts. Optional public runtime
demo values appear
in the login screen; modified persisted accounts are never silently reset.
See [demo identities](docs/full-stack-development.md#demo-identities).
These public demo credentials must never be used in production.

## License

Copyright (c) 2026 Alxarafe. Licensed under [Apache-2.0](LICENSE).
