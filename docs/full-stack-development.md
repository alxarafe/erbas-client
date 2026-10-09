# Full-stack development with the real backends

`bin/demo-up` is a development convenience that calls each repository's own
scripts. Java and .NET retain ownership of their Docker infrastructure, Compose
files, builds, databases and lifecycle. The client defines no backend containers
or combined ecosystem Compose file.

## Recommended directory layout and host requirements

```text
workspace/
├── erbas/              # Java implementation
├── alxarafe-dotnet/    # .NET implementation
└── erbas-client/      # this repository
```

Use Bash, Docker Engine with Compose v2, permission to access Docker, and curl.
`demo-check` also needs Python 3 (standard library only). Initial builds need
network access to the repositories' image and dependency registries. Follow each
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

Keep the same environment when stopping. No repository paths are required by
`demo-check`, which only makes HTTP requests to the running ecosystem.

## Demo identity

The default is the current .NET Catalog development seed's `reader@example.test`
identity and its public, versioned `SecuritySeed__ReaderPassword` value (see the
backend's development Compose or usage documentation). **Development/demo only;
never use these credentials in production.** Scripts do not print the password.
`ERBAS_DEMO_EMAIL` and `ERBAS_DEMO_PASSWORD` override the common credentials for
both startup and verification; export them consistently for `demo-up` and
`demo-check`. An override must already authenticate an existing .NET account;
these helpers do not change .NET seed configuration or reset its users.

`demo-up` enables Java's official development bootstrap with
`ERBAS_AUTH_BOOTSTRAP_ENABLED`, `ERBAS_AUTH_BOOTSTRAP_EMAIL` and
`ERBAS_AUTH_BOOTSTRAP_PASSWORD`. Flyway applies pending schema migrations first.
Bootstrap creates only the specified identity when absent, or reuses a matching
existing account. A conflicting password/disabled account fails safely rather
than resetting it. No SQL provisioning or registration endpoint is used.

Existing development volumes are retained. An old Java V1 database receives V2
normally, preserving `erbas_persistence_marker`. The .NET normal development seed
reuses its existing account. Restarting with the same credentials is idempotent.
Login tokens are checked in memory and discarded without decoding or consuming
backend-specific protected APIs.

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
HTTP proxy settings for these loopback endpoints. Failures are reported for each
target and produce a nonzero exit code. A backend revision with another Health
representation will fail; the client does not adapt that response.

It additionally verifies successful login and deliberately incorrect-password
401 responses for both real backends **through the client proxy**. Success must
be HTTP 200 JSON with exactly one nonempty string `accessToken` and
`Cache-Control: no-store`; failure must be HTTP 401 JSON with exactly
`{"code":"invalid_credentials"}` and `WWW-Authenticate: Bearer`. Redirects and
unexpected responses fail. Login bodies, tokens, passwords and exceptions are
never printed. Credentials and login responses are processed in memory, with
no login response files; the temporary Health-check directory is removed by trap.

`./bin/check` remains the authoritative isolated repository validation used by
normal CI. It runs Angular tests, builds and Docker runtime/proxy smoke checks
against isolated mocks, including login 200/400/401, headers and rejection of
undeclared routes, without external clones or running real backends.
`demo-check` is a separate, deliberate integration check and is not part of normal
CI. Health success demonstrates HTTP liveness and contract conformance, not
application/database readiness beyond what each backend defines.

## Equivalent manual workflow

With the recommended sibling layout, from `erbas-client`:

```bash
# Export the same existing .NET development identity via ERBAS_DEMO_EMAIL/PASSWORD.
(cd ../erbas && ERBAS_AUTH_BOOTSTRAP_ENABLED=true \
  ERBAS_AUTH_BOOTSTRAP_EMAIL="$ERBAS_DEMO_EMAIL" \
  ERBAS_AUTH_BOOTSTRAP_PASSWORD="$ERBAS_DEMO_PASSWORD" ./bin/up)
(cd ../alxarafe-dotnet && ./bin/up)
./bin/up

curl --fail --noproxy '*' http://127.0.0.1:48080/health
curl --fail --noproxy '*' http://127.0.0.1:48081/health
curl --fail --noproxy '*' http://127.0.0.1:48082
curl --fail --noproxy '*' -H 'Accept: application/json' http://127.0.0.1:48082/backends/java/health
curl --fail --noproxy '*' -H 'Accept: application/json' http://127.0.0.1:48082/backends/dotnet/health
./bin/demo-check

./bin/down
(cd ../alxarafe-dotnet && ./bin/down)
(cd ../erbas && ./bin/down)
```

Run each startup command only after the previous one succeeds. Replace sibling
paths and ports with your overrides when needed. The curl commands are useful
for diagnosis; `demo-check` performs the strict automated contract checks.

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
