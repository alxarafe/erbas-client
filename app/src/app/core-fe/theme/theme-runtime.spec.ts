import { TestBed } from '@angular/core/testing';
import { ThemeArtifact, ThemeDefinition, ThemeId, THEME_ARTIFACTS } from './theme-definition';
import { provideThemeRuntime, ThemeRegistry, ThemeResolver, ThemeService } from './theme-runtime';
import { BUILTIN_THEMES, DEFAULT_ARTIFACTS } from '../themes/themes';
import { DefaultBooleanRenderer, DefaultStringRenderer } from '../themes/default/field-renderers';
import { AlternativeBooleanRenderer } from '../themes/alternative/boolean-renderer';
import { HighContrastPanel } from '../themes/high-contrast/panel';
import { DefaultShell, DefaultNavigation } from '../themes/default/structure';
import { CyberpunkShell } from '../themes/cyberpunk/structure';
import { NormalizedFieldTypeRegistry } from '../field-types/normalized-field-types';

const CSS_ONLY: ThemeDefinition = { id: 'css-only', cssClass: 'theme-css-only', overrides: {} };
describe('Theme runtime', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideThemeRuntime([...BUILTIN_THEMES, CSS_ONLY])],
    }),
  );
  it.each([
    [ThemeId.Default, ThemeArtifact.Shell, DefaultShell],
    [ThemeId.Alternative, ThemeArtifact.Shell, DefaultShell],
    [ThemeId.Alternative, ThemeArtifact.FieldBoolean, AlternativeBooleanRenderer],
    [ThemeId.Alternative, ThemeArtifact.FieldString, DefaultStringRenderer],
    [ThemeId.Cyberpunk, ThemeArtifact.Shell, CyberpunkShell],
    [ThemeId.Cyberpunk, ThemeArtifact.Navigation, DefaultNavigation],
    [ThemeId.Cyberpunk, ThemeArtifact.FieldBoolean, DefaultBooleanRenderer],
    [ThemeId.Vintage, ThemeArtifact.Shell, DefaultShell],
    [ThemeId.Vintage, ThemeArtifact.FieldBoolean, DefaultBooleanRenderer],
    [ThemeId.HighContrast, ThemeArtifact.Panel, HighContrastPanel],
    [ThemeId.HighContrast, ThemeArtifact.Shell, DefaultShell],
    [ThemeId.HighContrast, ThemeArtifact.FieldBoolean, DefaultBooleanRenderer],
  ] as const)('resolves %s / %s with one fallback hop', (theme, artifact, expected) => {
    TestBed.inject(ThemeService).activate(theme);
    expect(TestBed.inject(ThemeResolver).resolve(artifact)).toBe(expected);
  });
  it.each(THEME_ARTIFACTS)('supports a CSS-only overlay for %s', (artifact) => {
    const themes = TestBed.inject(ThemeService);
    themes.activate(CSS_ONLY.id);
    expect(themes.current().cssClass).toBe(CSS_ONLY.cssClass);
    expect(TestBed.inject(ThemeResolver).resolve(artifact)).toBe(DEFAULT_ARTIFACTS[artifact]);
  });
  it('falls back safely for unknown selection without persisting preference', () => {
    const themes = TestBed.inject(ThemeService);
    themes.activate(ThemeId.Cyberpunk);
    expect(themes.activate('unknown')).toBe(false);
    expect(themes.current().id).toBe(ThemeId.Default);
    expect(TestBed.inject(ThemeResolver).resolve(ThemeArtifact.Shell)).toBe(DefaultShell);
  });
  it.each(THEME_ARTIFACTS)('rejects a missing default artifact: %s', (artifact) => {
    const overrides = { ...DEFAULT_ARTIFACTS };
    delete (overrides as Partial<typeof overrides>)[artifact];
    expect(
      () => new ThemeRegistry([{ id: ThemeId.Default, cssClass: 'theme-default', overrides }]),
    ).toThrow(/every artifact/);
  });
  it('rejects missing/duplicate themes, unknown artifacts and non-components', () => {
    expect(() => new ThemeRegistry([])).toThrow();
    expect(() => new ThemeRegistry([...BUILTIN_THEMES, BUILTIN_THEMES[0]!])).toThrow(/duplicate/);
    expect(
      () =>
        new ThemeRegistry([
          ...BUILTIN_THEMES,
          { ...CSS_ONLY, overrides: { unknown: DefaultShell } } as ThemeDefinition,
        ]),
    ).toThrow(/Unknown/);
    expect(
      () =>
        new ThemeRegistry([
          ...BUILTIN_THEMES,
          { ...CSS_ONLY, overrides: { [ThemeArtifact.Shell]: class NotAComponent {} } },
        ]),
    ).toThrow(/compiled/);
    expect(
      () =>
        new ThemeRegistry([
          ...BUILTIN_THEMES,
          {
            ...CSS_ONLY,
            overrides: { [ThemeArtifact.FieldString]: DefaultShell },
          } as unknown as ThemeDefinition,
        ]),
    ).toThrow(/renderer contract/);
    expect(() => TestBed.inject(ThemeResolver).resolve('invalid' as ThemeArtifact)).toThrow(
      /Unknown/,
    );
  });
  it('captures immutable definitions rather than retaining mutable registration state', () => {
    const source = {
      id: CSS_ONLY.id,
      cssClass: CSS_ONLY.cssClass,
      overrides: { [ThemeArtifact.FieldBoolean]: DefaultBooleanRenderer },
    };
    const registry = new ThemeRegistry([...BUILTIN_THEMES, source]);
    source.overrides[ThemeArtifact.FieldBoolean] = AlternativeBooleanRenderer;
    expect(registry.require(source.id).overrides[ThemeArtifact.FieldBoolean]).toBe(
      DefaultBooleanRenderer,
    );
    expect(Object.isFrozen(registry.all)).toBe(true);
    expect(Object.isFrozen(registry.require(source.id).overrides)).toBe(true);
  });
  it('uses every default field renderer unchanged under the Cyberpunk stress shell', () => {
    TestBed.inject(ThemeService).activate(ThemeId.Cyberpunk);
    const resolver = TestBed.inject(ThemeResolver);
    for (const type of TestBed.inject(NormalizedFieldTypeRegistry).all)
      expect(resolver.resolve(type.rendererArtifact)).toBe(
        DEFAULT_ARTIFACTS[type.rendererArtifact],
      );
  });
  it('keeps proof overlays sparse and independent', () => {
    const registry = TestBed.inject(ThemeRegistry);
    expect(Object.keys(registry.require(ThemeId.Vintage).overrides)).toEqual([]);
    expect(Object.keys(registry.require(ThemeId.HighContrast).overrides)).toEqual([
      ThemeArtifact.Panel,
    ]);
    expect(Object.keys(registry.require(ThemeId.Alternative).overrides)).toEqual([
      ThemeArtifact.FieldBoolean,
    ]);
    expect(Object.keys(registry.require(ThemeId.Cyberpunk).overrides)).toEqual([
      ThemeArtifact.Shell,
      ThemeArtifact.Panel,
    ]);
  });
});
describe('Normalized semantic field types', () => {
  it('has exactly one object/artifact per backend semantic identity', () => {
    const types = new NormalizedFieldTypeRegistry();
    const expected = [
      'BOOLEAN',
      'STRING',
      'TEXT',
      'INT8',
      'UINT8',
      'INT16',
      'UINT16',
      'INT32',
      'UINT32',
      'INT64',
      'DECIMAL',
      'UUID',
      'DATE',
      'TIME',
      'DATETIME',
      'ENUM',
      'BINARY',
    ];
    expect(types.all.map((type) => type.id)).toEqual(expected);
    expect(new Set(types.all.map((type) => type.id)).size).toBe(expected.length);
    expect(new Set(types.all.map((type) => type.rendererArtifact)).size).toBe(expected.length);
    for (const type of types.all) {
      expect(types.require(type.id)).toBe(type);
      expect(Object.isFrozen(type)).toBe(true);
      expect(DEFAULT_ARTIFACTS[type.rendererArtifact]).toBeDefined();
    }
    expect(() => types.require('unknown')).toThrow(/Unsupported/);
  });
});
