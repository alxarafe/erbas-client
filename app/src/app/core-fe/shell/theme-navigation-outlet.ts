import {
  Type,
  Component,
  ViewContainerRef,
  effect,
  inject,
  input,
  inputBinding,
  viewChild,
} from '@angular/core';
import { ThemeArtifact } from '../theme/theme-definition';
import { ThemeResolver } from '../theme/theme-runtime';
import { NavigationEntry, STRUCTURE_BINDINGS } from './shell-content';

@Component({ selector: 'core-fe-navigation-outlet', templateUrl: './theme-navigation-outlet.html' })
export class ThemeNavigationOutlet {
  readonly items = input<readonly NavigationEntry[]>([]);
  private readonly host = viewChild('navigation', { read: ViewContainerRef });
  private rendered?: Type<unknown>;
  private readonly resolver = inject(ThemeResolver);
  constructor() {
    effect(() => {
      const host = this.host();
      if (!host) return;
      const component = this.resolver.resolve(ThemeArtifact.Navigation);
      if (component === this.rendered) return;
      this.rendered = component;
      host.clear();
      host.createComponent(component, {
        bindings: [inputBinding(STRUCTURE_BINDINGS.items, this.items)],
      });
    });
  }
}
