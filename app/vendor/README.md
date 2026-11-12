# Private Angular UI Runtime and theme distributions

The six installed APF archives are built from clean
[angular-ui-runtime](https://github.com/alxarafe/angular-ui-runtime) commit
`ee60123d03f095a14c4004632c214dbd822332c2` (PR #14 merge), using its official
`./bin/pack` and pinned Docker/Node/npm workflow. No source alias, public npm package,
floating Git reference or private source path is used by the application.

Runtime is `0.3.0-alpha.3`; each theme is independently versioned `0.1.0-alpha.3`
and requires that runtime exactly. All six packages remain private/unpublished.
Angular Core is a `^22.0.0` peer; themes depend only on public runtime/Angular peers
and tslib. The provider's `docs/contracts/package-versioning.md` and
`theme-composition-v1.md` at the pinned commit define compatibility and projection.

| Archive | SHA-256 |
| --- | --- |
| `alxarafe-ui-runtime-0.3.0-alpha.3.tgz` | `8b07a27d640bec08a619c893556d91d11ca6a458d699526e048c469fd585913b` |
| `alxarafe-ui-theme-alternative-0.1.0-alpha.3.tgz` | `f225f89bb8f36dece6efce043143fb83ec95962237c702efc34aa415616690bf` |
| `alxarafe-ui-theme-cyberpunk-0.1.0-alpha.3.tgz` | `7a104f6247f94ac3c8e0bb689bb8ece4d61f4f04f1e92925b0497a445472f82b` |
| `alxarafe-ui-theme-default-0.1.0-alpha.3.tgz` | `ed4c3e8feeaa3479e19355aa5f0c70a097b8f76f2ca1fb519074f6c83349757d` |
| `alxarafe-ui-theme-high-contrast-0.1.0-alpha.3.tgz` | `b8d7816b5cc16d1c0eac35d87e122747213deaf97115d1156b95a17be1ac0881` |
| `alxarafe-ui-theme-vintage-0.1.0-alpha.3.tgz` | `005bf7392e7af9b11fb0617132ab73d8b4f9ef2dd7d0c95192ff53c84ad90a6a` |

The machine-readable record is `aur-integration-002-provenance.json`. The lockfile
also pins SHA-512 integrity; `npm ci` verifies the same vendored bytes in Docker
and CI. Docker copies vendor archives before installing dependencies, with no
provider checkout or registry publication required. LICENSE/NOTICE and package
provenance remain inside the APF archives. Package metadata and exported CSS are
validated against the installed dependency graph.

To reproduce, use a separate clean provider checkout at the pinned commit and run
`./bin/pack`, then compare SHA-256 for all six archives against the table. The rebuilt provider archives were compared with the initial vendored bytes on
2026-11-12; all six SHA-256 values match.
Never rebuild the provider during ERBAS dependency installation.

## Historical runtime-only adoption

The following describes the earlier 0.2.0 integration. Its archive is no longer
installed; its historical checksum and source identity are retained here.


`alxarafe-ui-runtime-0.2.0.tgz` is the compiled Angular Package Format distribution
of `@alxarafe/ui-runtime@0.2.0` from
[alxarafe/angular-ui-runtime](https://github.com/alxarafe/angular-ui-runtime), main
commit `c1869b2d17a19864ac24ccfb7f593af2de172851`.
It is temporarily vendored because the package is not published to npm.

SHA-256: `50c5896a6317a5f276190211da16f99540dc7753e84c540af82a55d49a475ed5`.
The npm lockfile additionally pins the archive's SHA-512 integrity. `npm ci`
verifies that integrity; Docker copies `vendor/` before dependency installation,
so local builds and GitHub Actions consume the same bytes without another checkout,
an unpublished registry or a machine-specific path.

## Provenance verification

At adoption, the source checkout HEAD and remote main both matched the commit above.
All four TypeScript sources embedded in the compiled bundle's source map matched
`git show <commit>:<source-path>` byte for byte. The archive's README, LICENSE and
NOTICE also matched that commit. Its manifest declares version 0.2.0, Angular 22
as a peer, and public compiled ESM/declaration exports. The bundle contains the
partial-compiled Angular injectables, with no application widgets. Apache-2.0
LICENSE and NOTICE remain inside the archive.

To rebuild from source in a separate checkout, check out the pinned commit and run
its documented `./bin/pack`. This uses its pinned Docker/Node/npm toolchain and
lockfile and writes `artifacts/alxarafe-ui-runtime-0.2.0.tgz`. Compare unpacked
contents when reproducing: npm archive metadata may differ between pack runs.
Do not rebuild or fetch source as part of ERBAS Client dependency installation.

To verify the vendored bytes from the repository root:

```sh
sha256sum app/vendor/alxarafe-ui-runtime-0.2.0.tgz
```

Updates require explicit source/version and provenance review, replacement of the
archive and this record, and regeneration of the npm lockfile. There is no floating
Git dependency.
