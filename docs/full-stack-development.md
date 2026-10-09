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
origin. It connects to backend Docker networks using existing `bin/up` discovery,
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

`./bin/demo-check` requires the ecosystem to be running. It checks all five targets:
Java direct Health, .NET direct Health, client HTTP, client → Java Health and client
→ .NET Health. Each Health check requires HTTP 200, `application/json` (optional
media-type parameters are accepted), and exactly the JSON object
`{"status":"ok"}`. Extra or duplicate properties, invalid JSON, redirects and
request failures are rejected. Requests have bounded timeouts and bypass host
HTTP proxy settings for these loopback endpoints. Failures are reported for each
target and produce a nonzero exit code. A backend revision with another Health
representation will fail; the client does not adapt that response.

`./bin/check` remains the authoritative isolated repository validation used by
normal CI. It runs Angular tests, builds and Docker runtime/proxy smoke checks
against isolated mocks, without external clones or running real backends.
`demo-check` is a separate, deliberate integration check and is not part of normal
CI. Health success demonstrates HTTP liveness and contract conformance, not
application/database readiness beyond what each backend defines.

## Equivalent manual workflow

With the recommended sibling layout, from `erbas-client`:

```bash
(cd ../erbas && ./bin/up)
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
