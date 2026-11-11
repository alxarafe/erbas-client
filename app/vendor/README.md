# Angular UI Runtime distribution

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
