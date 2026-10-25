import {
  Type,
  Component,
  ViewContainerRef,
  effect,
  inject,
  input,
  inputBinding,
  output,
  outputBinding,
  viewChild,
} from '@angular/core';
import { NormalizedFieldTypeRegistry } from './normalized-field-types';
import {
  FIELD_RENDERER_BINDINGS,
  FieldRenderer,
  FieldRendererContext,
  FieldValue,
} from './renderer-context';
import { ThemeResolver } from '../theme/theme-runtime';

@Component({ selector: 'core-fe-field-renderer', templateUrl: './field-renderer-outlet.html' })
export class FieldRendererOutlet {
  readonly type = input.required<string>();
  readonly context = input.required<FieldRendererContext>();
  readonly valueChange = output<FieldValue>();
  private readonly host = viewChild('renderer', { read: ViewContainerRef });
  private rendered?: Type<FieldRenderer>;
  private readonly types = inject(NormalizedFieldTypeRegistry);
  private readonly themes = inject(ThemeResolver);
  constructor() {
    effect(() => {
      const host = this.host();
      if (!host) return;
      const component = this.themes.resolve(this.types.require(this.type()).rendererArtifact);
      if (component === this.rendered) return;
      this.rendered = component;
      host.clear();
      host.createComponent(component, {
        bindings: [
          inputBinding(FIELD_RENDERER_BINDINGS.context, this.context),
          outputBinding<FieldValue>(FIELD_RENDERER_BINDINGS.valueChange, (value) =>
            this.valueChange.emit(value),
          ),
        ],
      });
    });
  }
}
