# ERBAS Client

[![Client CI](https://github.com/alxarafe/erbas-client/actions/workflows/ci.yml/badge.svg)](https://github.com/alxarafe/erbas-client/actions/workflows/ci.yml)

The shared Angular client demonstrates **one executable contract, multiple
interchangeable implementations**. WEB-002 provides backend selection, a public
Health check and shared AUTH-001 login, using standalone components, strict
TypeScript, HttpClient
and signals. Angular 22 is built inside Docker; Nginx serves the production bundle.

[erbas-contract](https://github.com/alxarafe/erbas-contract) is the HTTP authority.
The same Health client consumes Java ([alxarafe/erbas](https://github.com/alxarafe/erbas))
and .NET ([alxarafe/alxarafe-dotnet](https://github.com/alxarafe/alxarafe-dotnet)).
It requires `GET /health`, `Accept: application/json`, HTTP 200 and a JSON object
containing exactly `{"status":"ok"}`. Additional properties, incorrect media types,
invalid JSON, other statuses, redirects, timeouts and connection failures are errors.
Health indicates HTTP process liveness, not database readiness.

## Full-stack Quick Start

With sibling `../erbas` and `../alxarafe-dotnet` checkouts providing their own
`bin/up` and `bin/down` scripts:

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

Docker Engine with Docker Compose v2, Bash and permission to use Docker are
required. Initial builds need network access to image and npm registries.
The host needs neither Node.js nor Angular CLI. Run from this checkout:

```bash
./bin/up       # build and start; open http://127.0.0.1:48082
./bin/down     # stop and remove the client's Compose containers/network
./bin/test     # Angular unit/component tests with mocked HTTP
./bin/check    # authoritative validation; also used unchanged by GitHub Actions
```

`bin/check` runs shell syntax and Compose validation, all Angular tests, the
production build, and runtime Health/login proxy smoke tests against two isolated
mock servers.
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
Only the exact Health and `/api/auth/login` paths for each backend are proxied;
other `/backends/` paths return 404. Login preserves backend HTTP statuses, JSON
bodies, `Cache-Control: no-store` and `WWW-Authenticate: Bearer`.
This workflow targets the existing Docker backends, rather than arbitrary host-native
processes. A deployment-specific network configuration would be needed for those.

## Structure and extending the client

- `app/src/app/backends.ts`: central typed registry, public endpoint metadata and proxy routes.
- `app/src/app/backend-selection.ts`: selection and storage recovery.
- `app/src/app/health-client.ts`: destination-neutral HTTP client and contract validation.
- `app/src/app/auth-client.ts`: destination-neutral AUTH-001 login and response validation.
- `app/src/app/auth-session.ts`: one in-memory session tied to its issuing backend.
- `app/src/app/app.*`: login/Health presentation, cancellation and session orchestration.
- `Dockerfile`, `compose.yaml`, `docker/`: build, runtime proxy and isolated smoke fixtures.
- `bin/`: lifecycle and validation workflows; `.github/workflows/ci.yml`: calls `bin/check`.

To add an implementation, add a registry entry and an exact Nginx Health route,
an exact login route, then configure its upstream/network. No Health logic changes
are needed. The small
HTTP service can later be replaced with a contract-generated client without changing
backend selection. Dependency resolution is recorded in `app/package-lock.json`;
normal builds use `npm ci`.

## Current scope and limitations

WEB-002 implements the same email/password login form for Java and .NET through
`POST /api/auth/login` on the same-origin Nginx proxy. Invalid credentials produce
a neutral message; request, service and invalid-response failures remain distinct.
The UI never displays tokens, claims or a purported authenticated identity.

The access token is an opaque string, kept only in memory. Java and .NET issue
different, non-interoperable tokens; each session belongs only to its issuing
backend. Changing backend cancels pending login and discards the session, even
when returning to the previous backend. Reloading also loses the session.
**Clear session** discards local state only; it does not revoke the server token.
Only the backend selection is persisted in localStorage.

There is no refresh, bearer interceptor, shared protected API consumed by the
client, registration, server logout, roles or permissions UI. ERP navigation,
CRUD, Catalog, AiAgent, SSR, PWA and production deployment remain outside scope.
Health stays public and independent of authentication. The client does not adapt
nonconforming responses. Health redirects are blocked by Nginx; login statuses
and bodies pass through without error interception. Proxy timeouts are bounded.

`bin/check` verifies runtime Health/login proxies against isolated mocks;
`bin/demo-check` verifies both real development backends through the client.
The demo uses the .NET development seed identity `reader@example.test` and Java's
explicit development bootstrap; see [demo credentials](docs/full-stack-development.md#demo-identity).
These public demo credentials must never be used in production.

## License

Copyright (c) 2026 Alxarafe. Licensed under [Apache-2.0](LICENSE).
