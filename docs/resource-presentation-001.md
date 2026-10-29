# RESOURCE-PRESENTATION-001: contextual generic presentation

## Identity and scope

erbas-client formally adopts published immutable **erbas-contract v0.14.0**
through [`contract.revision`](../contract.revision). RESOURCE-PRESENTATION-001
belongs to this published release:

- Annotated tag object: `22191afb8ab477fef319093b8c212264f4019816`.
- Target commit: `9919ad3725e50d63e7a19befbe0d81b4d91df0cc`.
- Adopting .NET revision: `6c8cf72b5ceefd15411f24befa140bcf28b9e201`.

The normative [published specification](https://github.com/alxarafe/erbas-contract/blob/v0.14.0/docs/core/resource-presentation-001.md)
is the authority. Java v0.14.0 compatibility is not claimed. Backend shared
conformance and client proofs are distinct evidence.

The historical pre-publication proof below used the same contractual target
commit while it was a candidate, with .NET implementation
`00d6de93450407e5709f1a7f44c673a11819c931` and the client's then-published
v0.13.0 pin. Formal adoption changes no implementation or proof source.

## Published adoption verification — 2026-10-29

Remote `git ls-remote` verified the published v0.14.0 annotated tag and peeled
commit against the exact identities above. `./bin/check` passed 693 Angular tests,
16 Python tests, formatting, production Docker build (cached), runtime/proxy
smokes including contextual presentation, ETag/304 and legacy 404, and cleanup.
The existing Rolldown installation correction is unchanged. Normal checks use
synthetic backends and perform no shared contract checkout or conformance run;
no new live-backend proof was required or performed for this adoption.
Only the release marker and documentation changed; implementation is unchanged.

## Discovery, validation and cache

RuntimeClient requests `GET /api/meta/resources/{resource}/presentation` only after
valid metadata. Compiled TypeScript models and explicit validation enforce closed
root/context/form/container/column/behavior objects, known field/action references,
uniqueness, container-local IDs, collapse behavior and permitted action scopes.
No TypeScript, templates, components or executable metadata are generated at runtime.

The document ID and definitionHash must match the currently cached metadata from
the same effective context. A mismatch or invalid document discards the associated
metadata/presentation cache and reports `invalid_response`; the screen withholds
CRUD content instead of silently applying a legacy layout. Explicit Refresh metadata
can fetch a consistent pair. Responses racing with metadata invalidation cannot
restore or combine stale documents.

Presentation documents and opaque ETags are held only in memory, scoped by backend,
authentication/context epoch and resource, bound to the metadata definition identity.
Explicit revalidation sends If-None-Match; 304 retains the valid cached document.
Logout, backend/context changes cancel protected requests and discard caches.
`invalidateMetadata(resource)` removes both resource caches; a changed metadata
hash removes the previous presentation ETag. No polling or persistent presentation
cache is introduced. Nginx admits only the new GET route and forwards authentication,
conditional/private cache headers without shared proxy caching.

After valid metadata, only endpoint 404 permits legacy interoperability. That
absence is cached in the same context and reconsidered on explicit revalidation.
401 clears the session; 400, 403, 500, invalid JSON/shapes, missing/invalid ETag,
uncached 304 and identity mismatch are errors, never legacy fallback. Existing
resources with `presentation: {}` on a new server remain valid.

## Context resolution before rendering

| Mode | First choice | If absent | If also absent |
| --- | --- | --- | --- |
| CREATE / EDIT / VIEW | Exact corresponding contextual form | Legacy `metadata.presentation.form` | Metadata field order |
| LIST | Exact contextual columns | Metadata field order | — |

Presence is tested explicitly. Empty contexts, tabs or columns are intentional;
no omitted fields are appended to an explicit form. Legacy forms preserve placement
order and append unplaced eligible fields once in metadata order. Legacy forms
never determine LIST columns.

The resolver supplies fields/layout to the existing ResourceForm → ResourceLayout
→ FieldRendererOutlet/theme pipeline. CREATE, EDIT and VIEW share those compiled
primitives; VIEW sets the existing read-only mode. LIST uses declared membership,
order and column-label → Common.Label → field-name fallback. Record ordering,
filtering, search, sorting and pagination remain in the query protocol. Existing
scalar/exact-number handling and MANY_TO_ONE controls are reused.

UI.Hidden excludes fields everywhere; UI.FormExcluded excludes forms, including
VIEW, but not LIST. Empty containers are pruned after static hints and effective
action projection. Required/default/nullable/constraint/relation rules still come
from metadata/backend. Immutable fields allow CREATE input but remain nonwritable
in EDIT and excluded from PATCH. Layout is not field authorization.

## Actions and generic architecture

CREATE placements permit COLLECTION; EDIT/VIEW ENTITY; LIST COLLECTION/SELECTION.
The same existing action protocol provides availability and execution. Ordered
placements precede eligible unplaced actions; unauthorized actions are absent,
unavailable actions disabled. Selection is explicit and bounded to the protocol
maximum; page/context changes discard it. COLLECTION execution omits a target,
ENTITY supplies its ID and SELECTION its IDs. CREATE collection actions are
independent operations, not hooks or replacements for normal CRUD submission.

Static presentation never grants CRUD or action permissions. Backend guards remain
authoritative even for manipulated requests. No field permissions, state-dependent
layouts, registry, DMS, calculated fields, renderers, themes or API semantics are
invented here. Generic CRUD remains the primary path for standard resources;
`RESOURCE_SCREENS` is preserved as an explicit specialized override. Assets does
not register one. Shared layout/renderer improvements benefit all resources using
the pattern, without resource-name branches.

## Assets proof and reproducibility

The exact .NET declaration supplies:

- LIST: `name`, `assetTypeId`, `assetTag`, `lifecycle`, `condition`, `locationId`.
- CREATE: `assetTypeId`, `name`, in that order, with no other controls.
- EDIT: the complete existing hierarchical form, with immutable type preserved.
- VIEW: the complete declared read-only hierarchy.

Use the existing real-HTTP/component proofs (`runtime-live.proof.ts` and
`presentation-live.proof.ts`) and the bounded Chromium procedure in
[CLIENT-RUNTIME-002](client-runtime-002.md#bounded-real-browser-procedure).
The contextual proof additionally creates an Asset through the visible two-field
form, checks the exact POST and persisted DRAFT via GET, then opens that record
through EDIT and VIEW and compares every placed field with the respective backend
declaration. No automatic CREATE→EDIT navigation or backend exception is added.

Production Nginx serves the compiled client on the disposable backend network,
without host ports, interception or mocked real-proof responses. Reuse the recorded
Playwright 1.56.1/Chromium Docker image and digest; install nothing in project
packages. Supply fresh temporary credentials through a private environment file,
never URLs or logs. The backend's existing validation-db workflow owns the four
ephemeral databases/Host. Provision a temporary reader with only `assets.read` and
tenant membership. Verify admin/reader layouts, absence of forbidden affordances,
direct forbidden mutations (403), ETag/304 and fresh context requests without the
previous identity's If-None-Match. Delete owned records/type, stop the proxy and
validation Host, and drop/verify all four dedicated databases, removing temporary
identities, claims, memberships and business data. Preserve development data.

Normal `./bin/check` remains mock-based. Unit/component tests cover closed parsing,
identity, cache/invalidation/races, errors versus permitted legacy 404, all contexts,
exact ordering, empty/absent fallback, labels, hints, immutable fields and actions.
A source boundary test rejects Assets-specific names in production runtime code.
Proxy smokes cover contextual GET/private headers/304 plus a valid legacy metadata
response followed by endpoint 404. This introduces no permanent test dependency.

## Historical pre-publication verification — 2026-10-28

- `./bin/check`: **693 Angular tests** (66 added), **16 Python tests** (one added),
  zero failures/skips, formatting, production build, both runtime/proxy smokes and
  cleanup passed. Dockerfile, npm/package/lockfile and the Rolldown installation
  correction remain unchanged.
- Existing `runtime-live.proof.ts` and expanded `presentation-live.proof.ts` passed
  against the historical .NET implementation revision above, with real login/profile/navigation,
  generic CRUD, contextual identity/ETag validation and separate identity caches.
- Chromium **141.0.7390.37**, temporary Playwright **1.56.1**, passed the real
  two-phase Assets flow: six exact ordered LIST columns, only the two CREATE
  fields, exact POST fields, persisted DRAFT GET, complete EDIT including immutable
  type, and VIEW matching its contextual declaration. Backend VIEW and EDIT use
  the same complete hierarchy; distinct synthetic VIEW layouts are tested in the
  component suite rather than modifying the backend to manufacture a difference.
- Four ordered tabs, seven sections, nine groups, collapse/tab behavior and an
  authorized entity action (204) passed. The restricted profile had read-only
  VIEW, no write/action affordances, and four direct CRUD/action attempts returned
  403. Metadata/presentation conditional GETs returned 304; logout/restricted login
  fetched fresh documents without the previous identity's conditional tag. There
  were zero browser page errors and no response interception.
- Owned Asset records/type were deleted and verified; disposal of all four
  dedicated databases removed temporary identities/claims/memberships and data.
  Host/proxy cleanup and sensitive-log checks passed. Existing development
  PostgreSQL service/data and all other repository working trees were preserved.
- Final diff, local links, credential-marker/NUL and generic-resource boundary
  checks passed. No dependency, contract pin, backend, contract or Java changes,
  tags, publication or v0.14.0 adoption are part of this task.
