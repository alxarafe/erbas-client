import {
  Type,
  Component,
  EmbeddedViewRef,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { ThemeArtifact } from '../theme/theme-definition';
import { ThemeResolver } from '../theme/theme-runtime';

@Component({ selector: 'core-fe-panel-outlet', templateUrl: './theme-panel-outlet.html' })
export class ThemePanelOutlet {
  private readonly source = viewChild<TemplateRef<unknown>>('content');
  private readonly projected = viewChild('projected', { read: ViewContainerRef });
  private readonly host = viewChild('panel', { read: ViewContainerRef });
  private readonly resolver = inject(ThemeResolver);
  private rendered?: Type<unknown>;
  private view?: EmbeddedViewRef<unknown>;
  constructor() {
    effect(() => {
      const source = this.source(),
        projected = this.projected(),
        host = this.host();
      if (!source || !projected || !host) return;
      this.view ??= projected.createEmbeddedView(source);
      const component = this.resolver.resolve(ThemeArtifact.Panel);
      if (component === this.rendered) return;
      this.rendered = component;
      host.clear();
      host.createComponent(component, { projectableNodes: [this.view.rootNodes] });
    });
  }
}
