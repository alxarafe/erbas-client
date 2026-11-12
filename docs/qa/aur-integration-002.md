# AUR-INTEGRATION-002 verification

## Source and installation

Consumer branch: `feature/aur-integration-002`, based on main
`8d1573c315e03a6edbc92bd7b3d41d851bd54ab9`, verified against fetched `origin/main`.
The prior QA branch and its untracked reference-theme artifacts are preserved.
Provider tracked files remain unchanged, at clean merge
`ee60123d03f095a14c4004632c214dbd822332c2`.

The developer supplied successful official `./bin/pack` output on 2026-11-12.
Generated theme evidence identifies that commit with empty source status.
All six actual APF files were copied into vendor; hashes are recorded in
[the provenance record](../../app/vendor/aur-integration-002-provenance.json).
The lockfile changes only the runtime and five theme entries. Strict-peer install
and `npm ci` succeeded. The obsolete runtime 0.2.0 archive was removed after
confirming that neither package.json nor package-lock.json references it.
Its historical provenance remains documented.

## Known results

- Focused Angular tests: **153 passed**, covering core theme/field/slot adapters,
  App theme behavior, SPA navigation, generic resource UI and contextual presentation.
- Developer-reported Docker consumer validation: `./bin/test` passed all **730 tests
  in 28 files**; `./bin/check` completed with **CHECK PASS**, including production
  build, Docker runtime and both same-origin backend proxy smoke suites.
- Rebuilt provider artifacts (2026-11-12, after the initial vendoring) match all six
  original vendored SHA-256 values byte for byte. Provider source remains clean
  at the pinned commit.
- Prettier check and `git diff --check`: **passed**. Dependency inspection confirms
  one deduplicated Angular Core/runtime instance.
- Python orchestration/architecture/APF checks: **17 passed**. The APF test checks
  actual archive bytes, compiled ESM/declarations, public CSS, clean source provenance,
  lockfile installation paths and exact runtime peers.
- Theme switching tests retain the same input DOM, edited value, extension instances
  and focused node across all themes in both directions. Empty extension slots do
  not create public region wrappers.
- Navigation tests use a non-root deployment base, real Router transitions, history
  Back/Forward and rejected guards. Modified/alternate-target/download links stay
  native; uninstalled, external and mismatched URLs are not intercepted.

These are component/mock HTTP checks, not live backend verification. Tests still
assert the original resource and exact-value behavior; the navigation markup
assertion now targets nested lists instead of the former nested nav landmarks.
The mutation test's input typing now allows different packaged component classes;
its immutable-registry assertion is unchanged.

## Visual review limitation

No enabled browser was returned by the session's computer-use inventory. No
screenshot, responsive-layout or visual accessibility acceptance is claimed.
Desktop/mobile review remains outstanding: login, reachable navigation, local table
scrolling, Assistant operation and keyboard focus in each effective theme.
This limitation is recorded under the task's unavailable-visual-tools provision;
component focus checks are not browser visual acceptance.

## Scope and documentation review

The final scope review checks package/lockfile changes, public imports, removed
local visual implementations, retained resource styling, one runtime registry and
all extension regions. New meaningful routing literals use the shared
`RESOURCE_ROUTE_ROOT` and Angular's `PRIMARY_OUTLET`; no new scattered protocol or
behavioral literals were introduced. No contract revision, backend, Docker
provisioning or other repository tracked files were changed. Public architecture,
demo composition and package provenance documentation are updated in this task;
prior adoption descriptions are explicitly historical. Pre-existing untracked
reference-theme artifacts are preserved outside the commit.

The implementation retains pending-edit form state across theme changes; there is
no universal navigation-discard guard. Backend icon metadata is retained but not
rendered. These are current limitations, not new runtime features or backend claims.

No push, PR, merge, tag, publication or deployment is authorized. No consumer commit
is permitted while mandatory validation is missing or failed.
