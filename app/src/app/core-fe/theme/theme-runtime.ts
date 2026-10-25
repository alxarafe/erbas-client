import { Injectable, Provider, Type, inject, reflectComponentType, signal } from '@angular/core';
import {
  ThemeArtifact,
  ThemeArtifacts,
  ThemeDefinition,
  ThemeId,
  THEME_ARTIFACTS,
} from './theme-definition';
import { FIELD_RENDERER_BINDINGS } from '../field-types/renderer-context';

const STYLE_ID = /^[a-z][a-z0-9-]*$/;
export class ThemeRegistry {
  readonly all: readonly ThemeDefinition[];
  private readonly themes = new Map<string, ThemeDefinition>();
  constructor(definitions: readonly ThemeDefinition[]) {
    for (const definition of definitions) {
      if (
        !STYLE_ID.test(definition.id) ||
        !STYLE_ID.test(definition.cssClass) ||
        this.themes.has(definition.id)
      )
        throw new Error('Invalid or duplicate theme identity');
      const overrides = { ...definition.overrides };
      for (const [key, component] of Object.entries(overrides)) {
        if (!THEME_ARTIFACTS.includes(key as ThemeArtifact) || typeof component !== 'function')
          throw new Error('Unknown or invalid theme artifact');
        const mirror = reflectComponentType(component as Type<unknown>);
        if (!mirror?.isStandalone)
          throw new Error('Theme artifacts must be compiled standalone components');
        if (
          key.startsWith('field.') &&
          (!mirror.inputs.some((input) => input.templateName === FIELD_RENDERER_BINDINGS.context) ||
            !mirror.outputs.some(
              (output) => output.templateName === FIELD_RENDERER_BINDINGS.valueChange,
            ))
        )
          throw new Error('Invalid field renderer contract');
      }
      this.themes.set(
        definition.id,
        Object.freeze({ ...definition, overrides: Object.freeze(overrides) }),
      );
    }
    const fallback = this.themes.get(ThemeId.Default);
    if (!fallback || THEME_ARTIFACTS.some((artifact) => !fallback.overrides[artifact]))
      throw new Error('Default theme must provide every artifact');
    this.all = Object.freeze(
      [...this.themes.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    );
  }
  find(id: string): ThemeDefinition | undefined {
    return this.themes.get(id);
  }
  require(id: string): ThemeDefinition {
    const theme = this.find(id);
    if (!theme) throw new Error('Unknown theme');
    return theme;
  }
}
@Injectable()
export class ThemeService {
  private readonly registry = inject(ThemeRegistry);
  private readonly selection = signal(this.registry.require(ThemeId.Default));
  readonly current = this.selection.asReadonly();
  activate(id: string): boolean {
    const theme = this.registry.find(id);
    this.selection.set(theme ?? this.registry.require(ThemeId.Default));
    return theme !== undefined;
  }
}
@Injectable()
export class ThemeResolver {
  private readonly registry = inject(ThemeRegistry);
  private readonly service = inject(ThemeService);
  resolve<K extends ThemeArtifact>(artifact: K): ThemeArtifacts[K] {
    if (!THEME_ARTIFACTS.includes(artifact)) throw new Error('Unknown theme artifact');
    const component =
      this.service.current().overrides[artifact] ??
      this.registry.require(ThemeId.Default).overrides[artifact];
    if (!component) throw new Error('Missing theme artifact');
    return component as ThemeArtifacts[K];
  }
}
// App-scoped providers keep selection local and make isolated test compositions easy.
export function provideThemeRuntime(themes: readonly ThemeDefinition[]): Provider[] {
  return [
    { provide: ThemeRegistry, useFactory: () => new ThemeRegistry(themes) },
    ThemeService,
    ThemeResolver,
  ];
}
