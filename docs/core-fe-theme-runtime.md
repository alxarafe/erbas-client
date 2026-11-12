# Shared theme runtime and ERBAS presentation adapters

AUR-INTEGRATION-002 consumes `@alxarafe/ui-runtime@0.3.0-alpha.3` and five independent
`@alxarafe/ui-theme-*` packages at `0.1.0-alpha.3`, each with an exact runtime peer.
The archives come from clean provider commit
`ee60123d03f095a14c4004632c214dbd822332c2` using its official `./bin/pack`.
See [archive provenance and hashes](../app/vendor/README.md).

## Current ownership

`provideThemeRuntime(BUILTIN_THEMES)` registers the public Default, Alternative,
Cyberpunk, Vintage and High Contrast definitions in one runtime registry/resolver.
`aur-theme-shell` owns stable heading/content/region wrappers; its shared navigation
and panel outlets resolve packaged components. CSS comes from each package's public
`theme.css` export, Default first. Local visual shells, navigation, panels, field
renderers and theme CSS have been removed. There is no parallel presentation engine.

ERBAS retains the 17 normalized semantic descriptors and `FieldRendererOutlet`,
which maps backend semantic types to public runtime artifacts and forwards context
and value events. CRUD interpretation, exact numeric/temporal values, relationships,
validation and errors stay in the resource consumer. Application/login/Assistant and
generic resource styles stay in ERBAS global/component CSS. Default is complete;
Alternative replaces BOOLEAN, Cyberpunk shell/panel, High Contrast panel, and
Vintage only CSS. Sparse and unknown selections fall back directly to Default.

`ShellExtensionRegistry` still validates typed slots and snapshots contributions in
priority/ID order. `ShellExtensionRegions` supplies stable templates only for slots
with contributions; `ShellSlotOutlet` instantiates their components. All nine slots
map to the same public region names. No empty region reserves a Cyberpunk rail.
The runtime retains region views and their DOM/focus across structural theme
changes; extension instances do not belong to replaceable visual shells.

## Navigation boundary

App projects the effective validated `RuntimeClient.navigation()` tree in backend
order to `ThemeNavigationItem[]`. RESOURCE targets use `targetUrl`; ROUTE targets
retain validated application paths. `Location.prepareExternalUrl` applies deployment
base paths to anchor hrefs. Backend icon metadata remains in RuntimeClient but is
not rendered by this presentation contract. Groups remain labels with child lists.

The public synchronous `linkActivation` callback resolves the current backend item
by ID and checks the exact prepared href. It intercepts only installed home/resource
routes, calls `preventDefault()` before Router work, and delegates to
`Router.navigateByUrl`. Failed/rejected navigation does not fall back to a page
reload. External, unknown, modified, non-self-target and download links retain
native HTML behavior. The runtime's `activateThemeLink` is neither copied nor changed.
`NavigationEnd` invalidates `current` state for programmatic and history navigation,
so packaged navigation exposes `aria-current="page"`.

Existing resource forms track pending edits, but ERBAS has no universal router
`CanDeactivate` guard or global dirty-state protection. This adoption adds neither;
switching themes preserves draft views, while navigation can still discard edits.
Presentation visibility does not replace backend authorization. Contract revision,
backend protocols, resource screen overrides and session/cancellation behavior stay
unchanged. No Java support beyond its documented adoption is implied.

## Validation and limits

Component tests exercise installed package artifacts, all five themes/fallback,
native field events and exact values, every extension slot, ordering, DOM identity,
draft/focus retention in both theme directions, empty regions, SPA cancellation,
modified links, rejected guards and reactive current state including Back/Forward.
Existing resource, relationship, contextual layout and feature tests remain required.
`./bin/test` and `./bin/check` remain the mandatory Docker consumer validations;
provider packaging alone does not establish consumer acceptance. See [the verification report](qa/aur-integration-002.md) for consumer results,
archive comparison and the outstanding desktop/mobile visual review limitation.

---

## Historical implementation before AUR-INTEGRATION-002

The following record describes the former local visual artifacts and the earlier
runtime-only 0.2.0 adoption. Paths and ownership below are historical, not current.


CORE-FE-THEME-RUNTIME-001 supplies compiled Angular theme artifacts, normalized field
type objects and typed shell extension slots. The theme layer does not consume
Resource APIs; [CLIENT-RUNTIME-001](client-runtime-001.md) now provides that separate
consumer using these compiled artifacts. Existing backend selection, Health, sessions,
profile, users and assistant remain owned by App and their existing clients/services.

## Package boundary (AUR-002B)

`@alxarafe/ui-runtime@0.2.0` now owns theme definitions/artifact keys,
ThemeRegistry, ThemeService, ThemeResolver, provideThemeRuntime and field renderer
contracts. Consumers import these directly from the package public entry point;
the former local implementations have been removed. Distribution and provenance
are documented in [the vendored package record](../app/vendor/README.md).

ERBAS owns its five theme IDs in `core-fe/themes/theme-ids.ts`, reusing the package's
default ID. Theme catalogs, CSS, visual widgets, shell implementations, projection
outlets, shell extensions and normalized semantic type descriptors remain in this
application. There is one package registry/resolver, with no compatibility layer.
Resource and backend contracts are unchanged.

## One-hop themes

`ThemeDefinition` has an id, CSS class and sparse component overrides. ThemeRegistry
validates/snapshots definitions: unique identities, known artifacts, standalone compiled
components and complete default coverage. Field components must expose the common
context input/valueChange output. Missing default artifacts fail initialization;
missing active overrides resolve directly to default. Unknown activation resets to
default and returns false; unknown artifacts/types fail explicitly, never undefined.

```text
active theme artifact exists → active component
otherwise                   → default component
```

There is no parent theme, chain, callback resolver or runtime template download.
ThemeService is application-scoped and exposes a read-only current signal and
activate(id). Selection is in memory, with no profile/storage changes or selector UI.
Ordinary Angular providers compose the catalog; tests use isolated provider instances.

Themes live in `app/src/app/core-fe/themes/`. Each has scoped theme.css; styles.css
imports them at build time. Shared default tokens provide baseline colors/focus;
active CSS class overrides tokens through ordinary CSS. There is no CSS parser,
merging engine, database configuration or runtime stylesheet dependency.

## Actual reference inspection

The local `resource-controller` checkout at revision
`e7dd6b0edd88ecc82adb0c55504c15d6e3ad53b2` supplies the common field/layout templates.
Its five named themes are composed by the local `alxarafe` integration at revision
`8970eb18e47541b7c7d6e543704c91653255c4e9`, not stored as five theme directories inside
resource-controller itself. Classic means the on-disk **vintage** theme (confirmed by
the task owner). No runtime, build, test or filesystem dependency on either checkout
is introduced. These are architectural references, not copied PHP/Blade implementations.

| Reference theme | CSS | Field behavior | Structural overrides | Other relevant differences | Angular equivalent |
| --- | --- | --- | --- | --- | --- |
| Default | Yes | Base field templates, including BOOLEAN checkbox | Base shell/menu/card templates | Complete base catalog lives outside the theme directory | Complete default artifacts |
| Classic / Vintage | Yes | None | None | Vintage has only css/default.css | vintage: CSS only, empty overrides |
| High Contrast | Yes | None | component/card.blade.php | Card adds content wrapper, stronger heading/footer treatment; CSS increases contrast, borders and focus | high-contrast: panel only + CSS |
| Alternative | Yes | BOOLEAN edit Yes/No select; BOOLEAN list badge | No shell/menu/panel override | Generic form/select override changes wrapper/classes, not selection semantics | alternative: BOOLEAN only + CSS; other fields use default |
| Cyberpunk | Yes, plus SCSS source | No BOOLEAN/semantic type change | Main layout, main/user menus, card/menu-item wrappers | Utility rail moves right on desktop/bottom on mobile; generic select skin is cosmetic | cyberpunk: **shell and panel only** + CSS; default navigation and every field renderer reused |

Exact inspected sources (paths relative to their respective checkout):

- resource-controller: `src/Render/DefaultRenderer.php` (ordered path lookup and
  explicit missing-template failure), `src/Component/AbstractField.php`,
  `src/Component/Fields/Boolean.php`, `templates/layout/{list,edit,pagination}.html`,
  and `templates/component/form/fields/{edit,list}/*.html` (base field inventory).
- alxarafe: `src/Infrastructure/Http/Controller/ViewController.php` and
  `src/Infrastructure/Tools/Dispatcher/WebDispatcher.php` register active overrides
  before base templates. `src/Infrastructure/Persistence/Frontend/ThemeManager.php`
  merges base/skin template maps; `AlxarafeResourceBridgeTrait.php` loads the common
  resource-controller field/layout inventory. PHP's app/package/module path precedence
  is deliberately replaced by the smaller requested active→default rule.
- Baseline alxarafe templates: `templates/partial/layout/main.blade.php`,
  `templates/partial/body_standard.blade.php`, `templates/partial/main_menu.blade.php`,
  `templates/component/card.blade.php`, `templates/component/form/boolean.blade.php`;
  default CSS: `templates/themes/default/css/default.css`.
- Vintage's entire override inventory: `templates/themes/vintage/css/default.css`.
- High Contrast's entire inventory: `templates/themes/high-contrast/css/default.css`
  and `component/card.blade.php`.
- Alternative's entire inventory: `templates/themes/alternative/css/default.css`,
  `form/{boolean,select}.blade.php`, and `component/fields/{edit,list}/boolean.blade.php`.
- Cyberpunk's entire inventory: `templates/themes/cyberpunk/css/default.css`,
  `scss/default.scss`, `partial/layout/main.blade.php`,
  `partial/{main_menu,user_menu}.blade.php`, `component/{card,menu_item}.blade.php`,
  and `form/select.blade.php`.

The Angular equivalent preserves sparse replacement, not legacy widget libraries,
permissive PHP value coercions, file includes, inline scripts, notifications or visual
ornaments. Native select option selection needs no Angular Forms. Alternative's
list-only badge, full resource/list view contexts and legacy card title/image/footer
features are not implemented as a Resource Runtime here; the existing component
artifacts/context can evolve without a new resolver abstraction. Generic select
cosmetic differences use CSS rather than extra ENUM overrides.

Cyberpunk is an architectural stress test: its shell changes stacked navigation into
a sidebar/workspace plus a right utility rail (bottom on narrow screens), and its
panel changes the content wrapper. Its navigation implementation is the default
component, restyled/repositioned by the shell/CSS. Exactly two structural replacements
produce that different layout while all semantic field renderers fall back unchanged.
High Contrast needs only the existing Panel artifact; Vintage needs no component.
No fifth theme requires a new abstraction.

## Normalized types and renderers

```text
semantic type → NormalizedFieldType object → ThemeResolver → compiled renderer
```

The registry has one frozen object and distinct artifact per BOOLEAN, STRING, TEXT,
INT8, UINT8, INT16, UINT16, INT32, UINT32, INT64, DECIMAL, UUID, DATE, TIME, DATETIME,
ENUM and BINARY. A Map resolves the descriptor; no giant widget-selection switch
belongs in the Resource metadata consumer. Numeric defaults can share an implementation
while keeping independently replaceable keys.

FieldRendererContext contains id, label, value, disabled/readOnly and optional enum
choices. Values are boolean/string/null; exact numbers and temporal/binary values
stay strings at this boundary. The valueChange output reports edits. Widgets have
accessible native labels/controls, with read-only/disabled mutation guards. BOOLEAN
uses checkbox/null indeterminate state by default, Yes/No select in alternative.
Numbers use text plus decimal keyboard hint to avoid floating-point coercion;
DATETIME retains an exact string rather than losing timezone information. BINARY
currently has a minimal output renderer; file editing/transport is deferred.

Renderers are deliberately small: no Resource DTO, validation engine, dirty state,
relation editor or generic form. The context object may later gain optional state/error
properties without changing descriptor/artifact resolution. Required/type/length assistance, dirty tracking and action availability now belong
to the separate Resource consumer. Exact server constraints remain authoritative;
cross-tab error navigation and advanced editing remain later work.

## Compiled shell and slots

All artifacts are normal standalone Angular components using templateUrl. Angular
compiles templates into the production bundle; no arbitrary HTML, innerHTML, JIT
compiler or runtime filesystem access is used.

App provides heading/content TemplateRefs to ThemeShellOutlet and application-owned
navigation entries. The outlet owns embedded feature views and projects their nodes
into the resolved shell. Shell templates use the same heading/content/footer projection
order. Outlets retain instances when the resolved component type is unchanged, so CSS-only
changes keep the shell, contributions and controls mounted. Theme changes preserve
feature views, unsaved input DOM and App state;
they do not recreate feature logic. Panel and navigation outlets resolve their compiled
artifacts through the same resolver. Theme classes know no backend, AI or user state.

ShellExtensionRegistry is separate: definitions contain id, typed slot, compiled
component and integer priority. IDs are globally unique; ordering is priority ascending,
then ordinal ID, independent of registration order. Definitions are snapshotted,
with no runtime registration API. Components are composed with provideShellExtensions;
ordinary feature services own their state if a shell change recreates contribution views.

Slots are closed constants:

- topbar-start; topbar-actions;
- navigation-before; navigation-after;
- content-before; content-after;
- contextual-actions; floating-actions; footer.

```text
feature/module → what it contributes
registry       → logical slot
active theme   → physical placement
```

Every built-in shell preserves all nine slots. Behavioral tests render the same test
contributions under all five themes and check deterministic ordering and changed
placement. The default puts floating actions low/right; Cyberpunk places the same
slot in its utility rail. topbar-actions reserves the future notifications/messages/
user-actions location; themes may relocate it. No notifications or floating AI launcher
is implemented. Existing assistant remains in its current feature area.

## Consumer boundary and validation

```text
backend Resource Metadata
    → Angular Resource Runtime
    → NormalizedFieldType
    → ThemeResolver
    → renderer
```

The Resource consumer interprets metadata without selecting concrete theme widgets
or generating per-resource Angular source. Its protocol, routes, static CRUD and
validation are documented separately. Theme artifacts still own no Resource HTTP
requests, authorization policies, Angular Forms, workflow engine, remote plugins
or theme inheritance.

`./bin/test` runs Angular component/unit tests with mocked HTTP and formatting.
`./bin/check` also runs Python orchestration tests, the production Angular/Nginx build
and disposable two-backend proxy smoke tests. It needs no live backend. Existing
feature tests remain intact; new tests cover fallback/completeness, all normalized
types, native renderer events, slot preservation/order and App behavior across all
five themes. These checks establish architectural behavior, not final visual design
or a full accessibility certification.
