import { Component, InjectionToken, Type, computed, inject } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { ActivatedRoute, Routes } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ResourceScreen } from './resource-screen';
import { Target } from './models';
// Overrides choose compiled screens, never define menus or authorization.
export const RESOURCE_SCREENS = new InjectionToken<Readonly<Record<string, Type<unknown>>>>(
  'Compiled resource screens',
  { providedIn: 'root', factory: () => Object.create(null) },
);
export function resourceComponent(
  resource: string,
  registry: Readonly<Record<string, Type<unknown>>>,
): Type<unknown> {
  return Object.hasOwn(registry, resource) ? registry[resource]! : ResourceScreen;
}
export function targetUrl(target: Target): string {
  return target.type === 'RESOURCE'
    ? '/resources/' + encodeURIComponent(target.resource)
    : target.route;
}
@Component({
  selector: 'app-resource-host',
  imports: [NgComponentOutlet],
  template: '<ng-container *ngComponentOutlet="component(); inputs: inputs()" />',
})
export class ResourceHost {
  private readonly route = inject(ActivatedRoute);
  private readonly registry = inject(RESOURCE_SCREENS);
  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  readonly resource = computed(() => this.params().get('resource') ?? '');
  readonly component = computed(() => resourceComponent(this.resource(), this.registry));
  readonly inputs = computed(() => ({ resource: this.resource() }));
}
@Component({ selector: 'app-route-not-found', template: '<p>Application page not installed.</p>' })
export class RouteNotFound {}
@Component({ selector: 'app-home-route', template: '' })
export class HomeRoute {}
export const APP_ROUTES: Routes = [
  { path: 'resources/:resource', component: ResourceHost },
  { path: '', pathMatch: 'full', component: HomeRoute },
  { path: '**', component: RouteNotFound },
];
