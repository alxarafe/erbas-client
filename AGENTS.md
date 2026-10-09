# Client working agreement

WEB-001 implements the Angular application and Docker runtime. Do not create
placeholder applications or containers. The client owns
`ERBAS_CLIENT_PORT` mapping: default loopback host port 48082 to container port 80.
Follow the common convention in `erbas-contract/docs/development-ports.md`.

Keep the shared HTTP contract and supplied base URL independent of local ports.
Document only existing functionality, clearly distinguishing planned work.
Preserve unrelated changes; write public documentation in English. Staging,
commits, pushes, PRs, merges, tags, releases and deployments require express
authorization.
