# Client working agreement

WEB-001 implements the Angular application and Docker runtime; WEB-002 adds
shared AUTH-001 login, backend-bound in-memory session and real demo verification.
Both are completed. Do not create
placeholder applications or containers. The client owns
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
