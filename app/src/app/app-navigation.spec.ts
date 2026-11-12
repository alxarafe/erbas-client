import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_BASE_HREF, Location, PlatformLocation } from '@angular/common';
import { MockPlatformLocation, MOCK_PLATFORM_LOCATION_CONFIG } from '@angular/common/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ThemeService } from '@alxarafe/ui-runtime';
import { App } from './app';
import { AuthSession } from './auth-session';
import { RuntimeClient } from './resource-runtime/runtime-client';
import { Navigation } from './resource-runtime/models';
import { RESOURCE_ROUTE_ROOT, targetUrl } from './resource-runtime/resource-routing';
import { ThemeId } from './core-fe/themes/theme-ids';

@Component({ template: 'Managed page' })
class Page {}
const BASE = '/demo';
const RESOURCE = 'example';
const RESOURCE_URL = targetUrl({ type: 'RESOURCE', resource: RESOURCE });
const menu: Navigation = {
  version: 'fixture',
  items: [
    {
      id: 'group',
      label: 'Group',
      order: 0,
      children: [
        {
          id: 'resource',
          label: 'Records',
          order: 0,
          children: [],
          target: { type: 'RESOURCE', resource: RESOURCE },
          icon: 'retained-icon',
        },
        {
          id: 'home',
          label: 'Home',
          order: 1,
          children: [],
          target: { type: 'ROUTE', route: '/' },
        },
        {
          id: 'unmanaged',
          label: 'Uninstalled',
          order: 2,
          children: [],
          target: { type: 'ROUTE', route: '/uninstalled' },
        },
      ],
    },
  ],
};
describe('ERBAS public theme navigation integration', () => {
  let allow: boolean;
  beforeEach(() => {
    allow = true;
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PlatformLocation, useClass: MockPlatformLocation },
        {
          provide: MOCK_PLATFORM_LOCATION_CONFIG,
          useValue: { startUrl: 'http://localhost' + BASE + '/' },
        },
        { provide: APP_BASE_HREF, useValue: BASE + '/' },
        { provide: RuntimeClient, useValue: { navigation: signal(menu), error: signal(null) } },
        provideRouter([
          { path: '', pathMatch: 'full', component: Page },
          { path: RESOURCE_ROUTE_ROOT + '/:resource', component: Page, canActivate: [() => allow] },
        ]),
      ],
    });
    TestBed.inject(AuthSession).establish('java', 'navigation-token');
  });
  async function setup() {
    TestBed.inject(Router).setUpLocationChangeListener();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/demo/defaults.env').flush('');
    http.expectOne('/backends/java/health').flush({ status: 'ok' });
    http.verify();
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    return fixture;
  }
  it.each(Object.values(ThemeId))(
    'routes synchronously cancelled links and updates current in %s',
    async (theme) => {
      const fixture = await setup();
      fixture.debugElement.injector.get(ThemeService).activate(theme);
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      const link = page.querySelector<HTMLAnchorElement>(`a[href="${BASE + RESOURCE_URL}"]`)!;
      expect(link).not.toBeNull();
      expect(page.querySelector('nav button')).toBeNull();
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      await fixture.whenStable();
      expect(TestBed.inject(Router).url).toBe(RESOURCE_URL);
      expect(link.getAttribute('aria-current')).toBe('page');
      await TestBed.inject(Router).navigateByUrl('/');
      await fixture.whenStable();
      expect(link.hasAttribute('aria-current')).toBe(false);
      expect(page.querySelector('a[aria-current="page"]')?.textContent).toBe('Home');
      expect(TestBed.inject(RuntimeClient).navigation()?.items[0]?.children[0]?.icon).toBe(
        'retained-icon',
      );
    },
  );
  it('keeps modified clicks native and leaves uninstalled or mismatched URLs untouched', async () => {
    const fixture = await setup();
    const page = fixture.nativeElement as HTMLElement;
    const link = page.querySelector<HTMLAnchorElement>(`a[href="${BASE + RESOURCE_URL}"]`)!;
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    for (const modifiers of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...modifiers });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    for (const attributes of [{ target: '_blank' }, { download: '' }]) {
      for (const [key, value] of Object.entries(attributes)) link.setAttribute(key, value);
      const event = new MouseEvent('click', { cancelable: true });
      link.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      link.removeAttribute('target');
      link.removeAttribute('download');
    }
    const preventDefault = vi.fn();
    for (const href of ['https://example.test/', '//example.test/', BASE + '/other']) {
      fixture.componentInstance.activateLink({
        itemId: 'resource',
        href,
        defaultPrevented: false,
        preventDefault,
      });
    }
    fixture.componentInstance.activateLink({
      itemId: 'unmanaged',
      href: BASE + '/uninstalled',
      defaultPrevented: false,
      preventDefault,
    });
    expect(preventDefault).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
  it('cancels before a guard rejects without native fallback', async () => {
    const fixture = await setup();
    allow = false;
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    fixture.nativeElement.querySelector(`a[href="${BASE + RESOURCE_URL}"]`).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });
  it('refreshes aria-current after history Back and Forward', async () => {
    const fixture = await setup();
    const router = TestBed.inject(Router);
    await router.navigateByUrl(RESOURCE_URL);
    await fixture.whenStable();
    const location = TestBed.inject(Location);
    location.back();
    await vi.waitFor(() => expect(router.url).toBe('/'));
    await fixture.whenStable();
    expect(router.url).toBe('/');
    expect(fixture.nativeElement.querySelector('a[aria-current="page"]').textContent).toBe('Home');
    location.forward();
    await vi.waitFor(() => expect(router.url).toBe(RESOURCE_URL));
    await fixture.whenStable();
    expect(router.url).toBe(RESOURCE_URL);
    expect(fixture.nativeElement.querySelector('a[aria-current="page"]').textContent).toBe(
      'Records',
    );
  });
});
