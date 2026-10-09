# Client working agreement

WEB-001 implements the Angular application and Docker runtime. Do not create
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
