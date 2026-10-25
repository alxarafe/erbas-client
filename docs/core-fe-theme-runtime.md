# Core FE theme runtime and shell slots

CORE-FE-THEME-RUNTIME-001 supplies compiled Angular theme artifacts, normalized field
type objects and typed shell extension slots. It does not consume Resource APIs or
implement the future Resource Runtime. Existing backend selection, Health, sessions,
profile, users and assistant remain owned by App and their existing clients/services.

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
merging engine, database configuration or extra npm dependency.

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
belongs in the future Resource Runtime. Numeric defaults can share an implementation
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
properties without changing descriptor/artifact resolution. Future required/range/
length/pattern validation, maximumLength prevention, dirty tracking, cross-tab error
navigation and action authorization/availability remain Resource Runtime work.

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

## Next phase and validation

```text
backend Resource Metadata
    → Angular Resource Runtime
    → NormalizedFieldType
    → ThemeResolver
    → renderer
```

The next runtime consumes metadata directly and must not select concrete widgets or
generate per-resource Angular source. This task makes no `/api/meta/resources`,
`/api/resources` or `/api/resource-actions` requests. It adds no Router, Angular Forms,
UI framework, generic CRUD, Resource tabs/actions, dirty guards, shell business rules,
AI integration, remote plugins or theme inheritance.

`./bin/test` runs Angular component/unit tests with mocked HTTP and formatting.
`./bin/check` also runs Python orchestration tests, the production Angular/Nginx build
and disposable two-backend proxy smoke tests. It needs no live backend. Existing
feature tests remain intact; new tests cover fallback/completeness, all normalized
types, native renderer events, slot preservation/order and App behavior across all
five themes. These checks establish architectural behavior, not final visual design
or a full accessibility certification.
