# Client working agreement

WEB-001 implements the Angular application and Docker runtime; WEB-002 adds
shared AUTH-001 login, backend-bound in-memory session and real demo verification.
WEB-003A adds administrator-only USERS-001 / COLLECTIONS-001 listing and pagination
against published erbas-contract v0.4.0, with the same code for both backends.
401 clears the session; 403 preserves it. Backend switching and Clear session
cancel protected requests and discard user data. WEB-003B adds the authenticated
`/api/auth/me` profile and administrator
`GET /api/users/{id}` detail view, sharing one closed User validator. The loaded
profile informs administrator UI visibility; backend authorization remains
explicitly authoritative. Profile/detail failures retain authentication except
401, which discards all protected data. WEB-003C adds administrator-only
`POST /api/users`, defensive creation/error validation and a password input that
is never persisted. Successful creation refreshes an already loaded collection
from the same server offset, without optimistic insertion. Client cancellation
prevents stale response acceptance; it does not roll back a server mutation.
WEB-003D completes basic user administration with partial enabled/admin updates,
contractual last_admin handling, immediate session cleanup on self-disable and
administrative-data cleanup on self-demotion. AI-001C adds a minimal synchronous
ERBAS Assistant for both selected backends through the same-origin proxy,
consuming published AI-001 from erbas-contract v0.11.1. .NET implements the
operation; Java may report it unavailable until adoption. The UI keeps one
request at a time, validates the closed success response, preserves the session
on authorization/module failures, and clears it on a validated 401. These slices
are completed.
Do not create placeholder applications or containers. The client owns
`ERBAS_CLIENT_PORT` mapping: default loopback host port 48082 to container port 80.
Follow the common convention in `erbas-contract/docs/development-ports.md`.

Keep the shared HTTP contract and supplied base URL independent of local ports.
Document only existing functionality, clearly distinguishing planned work.
Preserve unrelated changes; write public documentation in English.

## Published contract and generic presentation

`contract.revision` declares formal consumption of published immutable v0.14.0;
[publication identity and backend alignment](docs/full-stack-development.md#published-contract-adoption)
record the exact tag object/commit. .NET formally adopts this release; do not claim
Java support for the new operations before its adoption. Earlier candidate proofs
remain historical evidence, distinct from published-release verification.

Generic CRUD is the primary presentation path for resources fitting standard
patterns. Specific Angular components are reserved for UX that metadata, renderers
or registered extensions cannot reasonably express. Preserve `RESOURCE_SCREENS`
as an explicit override/extension and escape hatch for specialized UX. Improvements
to shared MANY_TO_ONE controls, layouts or themes must benefit all resources using
that pattern. Do not introduce a new registry or renderer to record this policy.

RESOURCE-PRESENTATION-001 consumes the separate contextual presentation endpoint
from published v0.14.0: annotated tag object
`22191afb8ab477fef319093b8c212264f4019816`, target commit
`9919ad3725e50d63e7a19befbe0d81b4d91df0cc`. .NET adopts it at
`6c8cf72b5ceefd15411f24befa140bcf28b9e201`.
Validate identity before applying contexts and preserve absent versus explicit
empty declarations. See [contextual presentation](docs/resource-presentation-001.md).
This is presentation, not authorization. Java v0.14.0 compatibility is not claimed.

## Task lifecycle

Obtain explicit task approval, implement only its scope, pass applicable
validations, review the diff, close with a local atomic commit, then request and
obtain approval before starting the next task. Task approval also authorizes
staging and the final local commit once implementation, validation and scope
review are complete; no second authorization is required solely for that commit.

Use one atomic commit, or the minimum number the task's structure requires, with
clear messages consistent with repository conventions. Do not commit incomplete
tasks or tasks with failed validations. Correct and revalidate defects found
before closing a task. Do not start the next task with uncommitted changes from
the previous one; if a task exceptionally starts with another task's pending
changes, separate their commits correctly before continuing. Preserve all other
repository-specific rules.

Task approval does not authorize push, PR creation, merge, tag, release,
publication or deployment; each requires separate express authorization.

### Efficient validation execution

During implementation, prefer the narrowest applicable validation that gives
useful feedback — the focused unit, build, or other checks this repository already
provides — before running broader or full validation. Do not invent new
verification commands or architecture.

Do not run a long-running repository-wide test, image build, demo verification, or
full `./bin/check` inside an AI-agent session merely to wait for it to finish when
the developer or CI can run it directly. Repeatedly polling such a process is
specifically discouraged: each poll may cost another model turn that reprocesses
the existing conversation and repository context even though the external process
itself needs no reasoning, consuming effort without adding engineering value.

Whether a command is "long-running" depends on the repository and the task; no
fixed duration threshold applies. When a required full validation is expected to
take materially longer than the focused checks, normally provide the exact command
for the developer or CI to execute. That required long full validation must still
pass: when its result is required before commit or task completion, stop and wait
for it, continue only once it is provided, and never claim the validation passed
unless its result is actually known.

If a long-running command genuinely must be executed by the agent, avoid repeated
polling, wait as efficiently as the available tooling permits, and do not
repeatedly reread unchanged files or rerun unchanged validations.

This changes execution responsibility, not validation authority, and a failed or
missing required validation still blocks task completion or commit exactly as
before.

## Documentation impact review

Every task must review its documentation impact after implementation, validation
and scope review, before the final local commit. If it changes public behavior,
architecture, configuration, usage, development workflow, API capabilities,
repository status or documented limitations, update the relevant documentation
within the same task and the same future pull request. Otherwise, do not modify
documentation merely to record that the review occurred.

README.md is a stable, brief public landing page for project purpose, high-level
capabilities, architecture and ecosystem relationships, essential quick start,
onboarding and configuration, principal limitations, verifiable badges and links
to detailed documentation. It is not a changelog, task history, endpoint catalog,
record of individual WEB-003 slices or exhaustive inventory of internal checks.
Do not change it merely because an endpoint, field, validation or test is added
or changed, or an internal task is completed. Change README only when its
high-level description, onboarding, architecture, essential configuration,
principal capabilities or limitations become materially false or incomplete.

Functional and technical detail belongs preferably in `docs/`. Feature code and
documentation normally belong in the same task and pull request; use separate
functional and documentation commits when that improves review, for example
`feat(...): ...` and `docs: ...`. Do not automatically create a follow-up DOCS task
or coordinated documentation synchronization after each feature.

Cross-repository documentation synchronization is necessary only for a shared
policy change, a contractual or published version change, an architecture or
ecosystem change, materially false information in another repository, or a
significant milestone that actually affects several repositories. Review related
status references when one of these conditions applies; obtain task approval
for necessary changes in other repositories and keep each repository's commits
separate. Preserve historical references and reports as historical; never rewrite
them to appear current. Change badges only when the verifiable fact they represent
changes. Keep CI, local contract conformance and real full-stack demo verification
distinct.

Write public documentation in English. Complete necessary documentation updates
before the final local commit, then obtain approval before starting the next task.
Independent authorization for push, PR creation, merge, tag, release, publication
and deployment remains required.

## Engineering simplicity

Prefer simple, explicit and maintainable solutions.

Apply these principles:

- **KISS** — keep solutions as simple as the requirements allow.
- **DRY** — avoid duplicated logic and duplicated sources of truth.
- **YAGNI** — do not build abstractions, extension points or infrastructure without a concrete current need.
- **Occam's razor** — when several solutions satisfy the requirements equally well, prefer the one with fewer concepts, dependencies and moving parts.
- **Reuse before invention** — prefer existing mechanisms, conventions and components before introducing new ones.

Do not introduce layers, helpers, factories, interfaces, services or abstractions merely for architectural symmetry or possible future use.

Simplicity must not compromise correctness, security, performance, clarity, testability or contractual behavior.

When duplication is small and removing it would create a more complex abstraction, prefer the clearer solution over mechanically applying DRY.

### No magic literals

Do not use magic literals.

Any literal with contractual, domain, protocol, configuration or behavioral
meaning must have one explicit and descriptive source of truth instead of being
scattered through implementation code, tests, templates, scripts or configuration.
This includes, where applicable:

- numeric and string values;
- endpoint paths, URLs and path fragments;
- HTTP header names, media types, HTTP/status/error codes and protocol tokens;
- state names, configuration keys and environment-variable names;
- contract field names and regular expressions with semantic meaning;
- timeouts, limits, sizes and thresholds;
- database/schema identifiers when they carry semantic meaning.

Prefer, in this order:

1. Existing framework/platform constants or enums.
2. Existing project/domain constants or types.
3. Existing configuration.
4. A narrowly scoped named constant or enum introduced for the concrete need.

Do not introduce local constants that merely duplicate an available and clearer
framework facility, such as HTTP status, header or media-type abstractions.
Examples of meaningful values that should not be scattered:

```text
USERS_PAGE_SIZE = 50
USERS_ENDPOINT = "/api/users"
JSON_MEDIA_TYPE = "application/json"
```

Do not mechanically replace every literal with a constant. A literal may remain
inline when it has no independent semantic meaning, its value is obvious from
the immediate local structure, naming it would reduce clarity, or it is incidental
fixture data whose exact value is irrelevant. Examples include simple array
indexes, trivial loop counters, structural zero/one values without domain meaning,
and arbitrary test values used only as distinct fixtures. Do not introduce
pointless constants such as `ZERO`, `ONE` or `TRUE` without a named domain or
protocol concept.

The objective is to eliminate hidden meaning and duplicated sources of truth,
prevent accidental inconsistencies, and improve readability and maintainability.
It is not a global constants catalog, needless abstraction, or replacement of
every string or number. Apply KISS, DRY, YAGNI, Occam's razor and reuse before
invention; this rule must reinforce simplicity.

Tests are subject to the same rule for production, contractual, protocol or
domain behavior. Do not duplicate production-significant literals unnecessarily:
prefer an exported `USERS_PAGE_SIZE` when asserting the production page size.
A deliberate contractual boundary such as 100 may use a named test/contract
constant when that improves semantic clarity. Arbitrary fixture values may
remain local. Do not couple tests unnecessarily to implementation internals;
correctness and test independence remain important.

The shared contract standardizes observable behavior, not implementation
internals. Each stack may represent contractual values idiomatically in its own
constants, enums or types. This rule does not make erbas-contract a general
constants package or require shared cross-language source-code constants or
generated constants infrastructure.

During scope review, explicitly inspect newly introduced meaningful literals and
confirm that no magic literals were added.
