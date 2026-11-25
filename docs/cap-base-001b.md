# CAP-BASE-001B — ERBAS Client regression baseline

2026-11-25. Status: focused checks and developer-executed full validation passed.

## Scope and revisions

ERBAS source: `1ec83f63f2cf77dc2820e47af18c645fcf156b11`, initially clean.
References inspected at arp-contract `8948d5da5e36688b8b7d233ae1c6daad6258b5a4`:
`docs/aur-capabilities-001.md` and `docs/decisions/ARP-UI-BOUNDARIES-001.md`.
Local AUR HEAD: `26d4fa3458c8d4fc66b65a1eac9d9c5e5f036e9e`.
ERBAS must adapt to ARP. Existing erbas-contract `v0.14.0` behavior is preservation
evidence, not the future ARP protocol or Angular API. No production, dependency,
backend, protocol or AUR changes belong to this task.

## Regression coverage

Paths below are under `app/src/app/`. Existing assertions were retained, without
adding parallel coverage for already established behaviors.

| Behavior | Existing evidence inspected |
| --- | --- |
| Generic navigation, list/read/update and specialized overrides | `resource-runtime/resource-ui.spec.ts`, `app-navigation.spec.ts` |
| Static/contextual forms, explicit empty versus absent layouts | `resource-runtime/presentation.spec.ts`, `contextual-ui.spec.ts`, `contextual-presentation.spec.ts` |
| MANY_TO_ONE lookup, selection and identifier transport | `resource-runtime/resource-ui.spec.ts`, `presentation.spec.ts` |
| Effective actions and backend authorization | `resource-runtime/contextual-ui.spec.ts`, `presentation.spec.ts`, `runtime-client.spec.ts` |
| Filter, repeated sort, search, pagination and exact decimals/dates | `resource-runtime/runtime-client.spec.ts`, `resource-ui.spec.ts` |
| Validation/conflicts and retained form data | `resource-runtime/resource-ui.spec.ts`, `presentation.spec.ts` |
| Session invalidation, context epochs and stale requests | `resource-runtime/runtime-client.spec.ts`, `contextual-cache.spec.ts`, `auth-session.spec.ts` |
| Backend switching and authentication | `app-login.spec.ts`, `app-demo-shell.spec.ts`, `backend-selection.spec.ts`, auth client/session suites |
| Five themes, form state, DOM and focus retention | `app-theme.spec.ts`, `core-fe/shell/shell-slots.spec.ts`, `core-fe/field-types/field-renderer-outlet.spec.ts` |

Four new cases fill gaps:

- `runtime-client.spec.ts`: POST/GET exact scalar wire values, false, empty string,
  null and absent keys; DELETE opaque identifier encoding and no-content completion.
- Same suite, codec boundary: nested JSON, exact numbers, empty containers, null
  and escaped text round-trip.
- `resource-ui.spec.ts`: reverting edits suppresses no-op submission; explicit empty
  differs from null; untouched absent/default values stay out of PATCH payloads.

## Package provenance

All six declared file dependencies were inspected in the archives, lockfile and
existing installed graph. Recorded provider source is
`ee60123d03f095a14c4004632c214dbd822332c2`, built by `./bin/pack` from a clean
source tree according to `app/vendor/aur-integration-002-provenance.json`.
This source claim was inspected, not independently rebuilt in this task.
Runtime declares `0.3.0-alpha.3`; themes each declare `0.1.0-alpha.3` and exact
runtime peer `0.3.0-alpha.3`; Angular Core peer is `^22.0.0` throughout.

| Archive | Recomputed SHA-256 |
| --- | --- |
| `alxarafe-ui-runtime-0.3.0-alpha.3.tgz` | `8b07a27d640bec08a619c893556d91d11ca6a458d699526e048c469fd585913b` |
| `alxarafe-ui-theme-alternative-0.1.0-alpha.3.tgz` | `f225f89bb8f36dece6efce043143fb83ec95962237c702efc34aa415616690bf` |
| `alxarafe-ui-theme-cyberpunk-0.1.0-alpha.3.tgz` | `7a104f6247f94ac3c8e0bb689bb8ece4d61f4f04f1e92925b0497a445472f82b` |
| `alxarafe-ui-theme-default-0.1.0-alpha.3.tgz` | `ed4c3e8feeaa3479e19355aa5f0c70a097b8f76f2ca1fb519074f6c83349757d` |
| `alxarafe-ui-theme-high-contrast-0.1.0-alpha.3.tgz` | `b8d7816b5cc16d1c0eac35d87e122747213deaf97115d1156b95a17be1ac0881` |
| `alxarafe-ui-theme-vintage-0.1.0-alpha.3.tgz` | `005bf7392e7af9b11fb0617132ab73d8b4f9ef2dd7d0c95192ff53c84ad90a6a` |

Read-only Python inspection recomputed SHA-256 and SHA-512 from every archive:
6/6 match the provenance record and corresponding `package-lock.json` integrity.
All 63 regular installed package files match archive contents byte for byte
(runtime 8, each theme 11). Theme `PROVENANCE.json` records historical ERBAS
extraction revision `8d1573c315e03a6edbc92bd7b3d41d851bd54ab9`; that is distinct
from the provider build SHA. Runtime has no embedded PROVENANCE.json.
Nominal versions do not establish compatibility with current AUR: these installed
bytes predate its current public composition/editor API and use older numeric
field artifacts. A future adoption must test actual bytes and public exports.

## Executed results and evidence levels

Focused mocked/unit checks used ephemeral `node:24.19.0-bookworm-slim` containers,
a temporary copy of `app/` including existing dependencies, and no host Node/npm.
This is not a fresh lockfile installation or the pinned full validation image.
Exact focused command:

```sh
docker run --rm -v /home/rsanjose/Desarrollo/Alxarafe/erbas-client/app:/source:ro -w /tmp/app node:24.19.0-bookworm-slim sh -c 'cp -a /source/. /tmp/app/ && npm test -- --include=src/app/resource-runtime/runtime-client.spec.ts --include=src/app/resource-runtime/resource-ui.spec.ts && npm run format:check'
```

- Initial focused test run: exit 1, 41 assertions reported passed but two unhandled
  errors. The new nested-resource fixture violated the existing scalar-only Row
  validator. Corrected the fixture; production behavior was preserved.
- Corrected focused run: 42 tests passed (27 transport/codec, 15 component), no
  unhandled errors; test phase passed. Combined command exited 1 because Prettier
  flagged the new test. The first formatting attempt lacked the repository config and still failed;
  rerunning Prettier with explicit `--config /tmp/app/.prettierrc --write` in
  Docker followed by `npm run format:check` passed (exit 0).
- `git diff --check`: passed after report creation. Complete test diff and new
  report reviewed; only tests and this report changed.
- Required `./bin/check`: passed, executed by the developer in `erbas-client`
  and reported in the CAP-BASE-001B final validation message. This includes
  `./bin/test`, clean installation, production build and isolated mock proxy
  smoke checks. The agent did not rerun this long validation. Supplied final output:

  ```text
  Runtime and proxy smoke tests passed
  (isolated mocks, no host ports).

  OK: public demo runtime resource preserves
  supplied values.

  CHECK PASS: unit tests, production build,
  Docker runtime and both same-origin Health,
  login, profile, users/detail, user
  creation/update and AI assistant proxies.
  ```

  Java/.NET here identify isolated mock proxy targets, not real Java/.NET
  backend implementations. This is no new real-backend compatibility evidence;
  no full-suite test count or backend conformance result is inferred from the
  supplied final output.
- Browser evidence: none executed. jsdom focus/DOM assertions are not browser
  rendering, responsive viewport, screenshot or accessibility acceptance.
- Real backend evidence: none executed; mocked Java/.NET proxies are not backend
  conformance. No Java v0.14.0 compatibility is claimed without formal adoption.
- Historical evidence, not rerun: [AUR integration QA](qa/aur-integration-002.md),
  [full-stack verification](full-stack-development.md) and
  [contextual presentation](resource-presentation-001.md). Their original revisions,
  backend adoption limits and dates remain authoritative for those runs only.

## Gaps and closeout

Responsive behavior across five themes still needs real-browser acceptance.
Nested JSON preservation is proven at the codec boundary; current generic resource
rows remain scalar-only. No future ARP compatibility follows from these tests.
The agent reran the two focused suites; the developer subsequently reported the
full required check passed. Browser/responsive and real backend verification were
not rerun. Existing limitations include
no universal navigation discard guard, as recorded in historical QA.
Documentation impact is confined to this report. New meaningful values reuse
protocol constants and Angular HTTP status enums; other values are fixture data.
All required validations have passed. The local atomic commit identity and
post-commit working-tree status are reported in the task closeout message.
