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
User updating/editing remains unimplemented. These slices are completed.
Do not create placeholder applications or containers. The client owns
`ERBAS_CLIENT_PORT` mapping: default loopback host port 48082 to container port 80.
Follow the common convention in `erbas-contract/docs/development-ports.md`.

Keep the shared HTTP contract and supplied base URL independent of local ports.
Document only existing functionality, clearly distinguishing planned work.
Preserve unrelated changes; write public documentation in English.

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

## Documentation impact review

After implementation, validation and scope review, review whether the task
changes public behavior, architecture, configuration, usage, development
workflow, API capabilities, repository status, or documented limitations.
If it affects any of these areas, update the relevant README and documentation
as part of the same task before its final local commit. If it does not, do not
modify documentation merely to record that the review occurred.

Keep README a brief landing page covering current capabilities, how to try them,
ecosystem relationships, verifiable badges and principal limitations. Keep
detailed architecture, decisions, processes, configuration, operations and
verification evidence in docs/; preserve historical reports as historical.

When a task changes a capability or status shared across the ERBAS ecosystem,
review status references and badges in related repository READMEs. Keep CI,
local contract conformance and full-stack demo verification distinct. If other
repositories need updates, handle them as an independent coordinated task
immediately after the functional change is merged, preferably before the next
major feature. Do not mix those updates into another repository's functional
commit or leave them indefinitely pending; obtain the required task approval.

The lifecycle is: approve task, implement, validate, review scope, review
documentation impact, update relevant docs if needed, local atomic commit,
then obtain approval for the next task. Existing separate authorization rules
for push, PR, merge, release, publication and deployment remain unchanged.

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
