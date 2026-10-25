import {
  Type,
  Component,
  EmbeddedViewRef,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
  inputBinding,
  viewChild,
} from '@angular/core';
import { ThemeArtifact } from '../theme/theme-definition';
import { ThemeResolver, ThemeService } from '../theme/theme-runtime';
import { NavigationEntry, STRUCTURE_BINDINGS } from './shell-content';

@Component({
  selector: 'core-fe-shell-outlet',
  templateUrl: './theme-shell-outlet.html',
  host: { '[class]': 'theme.current().cssClass' },
})
export class ThemeShellOutlet {
  readonly heading = input.required<TemplateRef<unknown>>();
  readonly content = input.required<TemplateRef<unknown>>();
  readonly footer = input<TemplateRef<unknown>>();
  readonly navigation = input<readonly NavigationEntry[]>([]);
  readonly theme = inject(ThemeService);
  private readonly resolver = inject(ThemeResolver);
  private readonly templates = viewChild('templates', { read: ViewContainerRef });
  private readonly shell = viewChild('shell', { read: ViewContainerRef });
  private rendered?: Type<unknown>;
  private sources: readonly (TemplateRef<unknown> | undefined)[] = [];
  private views: (EmbeddedViewRef<unknown> | undefined)[] = [];
  constructor() {
    effect(() => {
      const templates = this.templates(),
        shell = this.shell();
      if (!templates || !shell) return;
      const sources = [this.heading(), this.content(), this.footer()];
      if (sources.some((source, index) => source !== this.sources[index])) {
        shell.clear();
        this.rendered = undefined;
        templates.clear();
        this.sources = sources;
        this.views = sources.map((source) =>
          source ? templates.createEmbeddedView(source) : undefined,
        );
      }
      const component = this.resolver.resolve(ThemeArtifact.Shell);
      if (component === this.rendered) return;
      this.rendered = component;
      shell.clear();
      // Embedded views remain owned here, not by the replaceable shell. Projection
      // moves their nodes; changing themes does not recreate feature forms/state.
      shell.createComponent(component, {
        projectableNodes: this.views.map((view) => view?.rootNodes ?? []),
        bindings: [inputBinding(STRUCTURE_BINDINGS.navigation, this.navigation)],
      });
    });
  }
}
