import { By } from '@angular/platform-browser';
import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideThemeRuntime } from '../core-fe/theme/theme-runtime';
import { BUILTIN_THEMES } from '../core-fe/themes/themes';
import { DefaultNavigation } from '../core-fe/themes/default/structure';
import { ResourceForm } from './resource-form';
import { ResourceScreen } from './resource-screen';
import { RuntimeClient } from './runtime-client';
import {
  ResourceHost,
  RESOURCE_SCREENS,
  resourceComponent,
  targetUrl,
  APP_ROUTES,
} from './resource-routing';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import {
  field,
  fixtureMetadata,
  fixtureNavigation,
  TEST_RESOURCE as R,
  TEST_ETAG,
} from './runtime-fixtures';
import { ExactNumber } from './exact-json';
import { Row, RESOURCE_PROTOCOL as P } from './models';
import { orderedFields } from './fields';
const headers = { 'Content-Type': 'application/json', ETag: TEST_ETAG };
@Component({ template: 'Specific screen {{resource()}}' })
class SpecificScreen {
  readonly resource = input.required<string>();
}
describe('Compiled generic screens and menu', () => {
  let http: HttpTestingController, client: RuntimeClient, base: string;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: RESOURCE_SCREENS, useValue: { specific: SpecificScreen } },
        provideRouter(APP_ROUTES),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideThemeRuntime(BUILTIN_THEMES),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(RuntimeClient);
    base = TestBed.inject(BackendSelection).selected().proxyBaseUrl;
    const session = TestBed.inject(AuthSession);
    session.establish('java', 'opaque');
    session.markContextReady();
    TestBed.tick();
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
  });
  afterEach(() => http.verify());
  it('renders backend hierarchy/labels and resolves RESOURCE and normal ROUTE links', async () => {
    const fixture = TestBed.createComponent(DefaultNavigation);
    fixture.componentRef.setInput(
      'items',
      fixtureNavigation.items.map((item) => ({
        ...item,
        children: item.children.map((child) => ({
          ...child,
          applicationRoute: true,
          href: targetUrl(child.target!),
        })),
      })),
    );
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Application');
    expect(page.querySelector('nav nav a')?.getAttribute('href')).toBe('/resources/' + R);
    const links = page.querySelectorAll('a');
    expect(links[1]?.getAttribute('href')).toBe('/');
  });
  it('uses explicit specific component override; other resources resolve to the generic fallback', () => {
    expect(resourceComponent(R, { [R]: SpecificScreen })).toBe(SpecificScreen);
    expect(resourceComponent('unregistered', {})).toBe(ResourceScreen);
  });
  it('renders a compiled registered screen through real Angular routing', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/resources/specific', ResourceHost);
    expect(harness.routeNativeElement?.textContent).toContain('Specific screen specific');
  });
  it('navigates ordinary ROUTE targets without invoking the generic resource API', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    expect(TestBed.inject(Router).url).toBe('/');
    http.expectNone((request) => request.url.includes(P.metadata));
  });
  it('loads metadata and records, paginates and preserves server order through the fallback', async () => {
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
    const request = http.expectOne((r) => r.url === base + P.records + '/' + R);
    expect(request.request.params.get('offset')).toBe('0');
    request.flush(
      '{"items":[{"id":"one","code":"X","name":"Example"}],"offset":0,"limit":50,"total":51}',
      { headers },
    );
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Example');
    fixture.componentInstance.paginate(P.pageSize);
    const next = http.expectOne((r) => r.url === base + P.records + '/' + R);
    expect(next.request.params.get('offset')).toBe(String(P.pageSize));
    next.flush('{"items":[],"offset":50,"limit":50,"total":51}', { headers });
  });
  it('renders entity action parameters and refreshes after execution without requiring GET authority', async () => {
    const meta = fixtureMetadata();
    meta.operations.get.authorized = false;
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(meta), { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush(
        '{"items":[{"id":"one","code":"X","name":"Example"}],"offset":0,"limit":50,"total":1}',
        { headers },
      );
    fixture.componentInstance.open({ id: 'one', name: 'Example' }, false);
    http
      .expectOne(base + P.actions + '/' + R + '/availability')
      .flush('[{"name":"finish","authorized":true,"available":true}]', { headers });
    await fixture.whenStable();
    const button = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'finish')!;
    expect(button.disabled).toBe(false);
    button.click();
    await fixture.whenStable();
    const form = fixture.debugElement.query(By.directive(ResourceForm))
      .componentInstance as ResourceForm;
    form.change('reason', 'Completed');
    form.submit(new Event('submit'));
    const execute = http.expectOne(base + P.actions + '/' + R + '/finish/execute');
    expect(JSON.parse(execute.request.body)).toEqual({
      target: { id: 'one' },
      parameters: { reason: 'Completed' },
    });
    execute.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne(base + P.actions + '/' + R + '/availability')
      .flush('[{"name":"finish","authorized":true,"available":false}]', { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[{"id":"one","name":"Example"}],"offset":0,"limit":50,"total":1}', {
        headers,
      });
    await fixture.whenStable();
    expect(fixture.componentInstance.action()).toBe(null);
    expect(fixture.componentInstance.available('finish')).toBe(false);
  });
  it('maps structured validation paths to controls and keeps unknown conflicts generic', async () => {
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    fixture.componentInstance.create();
    fixture.componentInstance.save({ code: 'X', name: 'Invalid' });
    http
      .expectOne(base + P.records + '/' + R)
      .flush('{"code":"invalid_request","errors":[{"code":"maximum_length","path":"name"}]}', {
        status: 400,
        statusText: 'Bad Request',
        headers,
      });
    expect(fixture.componentInstance.fieldErrors()['name']).toBe('maximum_length');
    expect(fixture.componentInstance.editing()).toBe(true);
    fixture.componentInstance.save({ code: 'X', name: 'Valid' });
    http
      .expectOne(base + P.records + '/' + R)
      .flush('{"code":"resource_conflict","errors":[{"code":"unknown_business_rule"}]}', {
        status: 409,
        statusText: 'Conflict',
        headers,
      });
    expect(fixture.componentInstance.error()?.status).toBe(409);
  });
  it('clears all form, error and action state at the context boundary', async () => {
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    fixture.componentInstance.selected.set({ id: 'old-context' });
    fixture.componentInstance.fieldErrors.set({ name: 'old-context-error' });
    fixture.componentInstance.availability.set([
      { name: 'finish', authorized: true, available: true },
    ]);
    TestBed.inject(AuthSession).contextChanged();
    TestBed.tick();
    expect(fixture.componentInstance.selected()).toBe(null);
    expect(fixture.componentInstance.fieldErrors()).toEqual({});
    expect(fixture.componentInstance.availability()).toEqual([]);
    expect(fixture.componentInstance.page()).toBe(null);
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
  });
  it('drops stale rows after a denied list refresh without discarding authentication', async () => {
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[{"id":"old"}],"offset":0,"limit":50}', { headers });
    fixture.componentInstance.load();
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"code":"forbidden","errors":[{"code":"forbidden"}]}', {
        status: 403,
        statusText: 'Forbidden',
        headers,
      });
    expect(fixture.componentInstance.page()).toBe(null);
    expect(TestBed.inject(AuthSession).authenticated()).toBe(true);
  });
  function form(record: Row | null = null) {
    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('fields', fixtureMetadata().fields);
    fixture.componentRef.setInput('record', record);
    fixture.detectChanges();
    return fixture;
  }
  it('generates static controls, defaults and required/read-only/immutable behavior', async () => {
    const fixture = form();
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('#resource-name')).toBeTruthy();
    expect(page.querySelector<HTMLInputElement>('#resource-id')!.readOnly).toBe(true);
    expect(page.querySelector<HTMLInputElement>('#resource-active')!.checked).toBe(true);
    let payload: Row | undefined;
    fixture.componentInstance.submitted.subscribe((value) => (payload = value));
    fixture.componentInstance.submit(new Event('submit'));
    expect(payload).toBeUndefined();
    fixture.componentInstance.change('code', 'ABC');
    fixture.componentInstance.change('name', 'Name');
    fixture.componentInstance.submit(new Event('submit'));
    expect(payload).toEqual({ code: 'ABC', name: 'Name' });
  });
  it('uses one renderer for editing and sends changed editable fields only, with explicit nullable clear', async () => {
    const fixture = form({
      id: 'one',
      code: 'ABC',
      name: 'Before',
      notes: 'Historical',
      amount: new ExactNumber('9007199254740993.25'),
      day: '2026-10-26',
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#resource-code').readOnly).toBe(true);
    let payload: Row | undefined;
    fixture.componentInstance.submitted.subscribe((value) => (payload = value));
    fixture.componentInstance.change('code', 'ATTEMPT');
    fixture.componentInstance.change('id', 'ATTEMPT');
    fixture.componentInstance.change('name', 'After');
    fixture.componentInstance.change('notes', null);
    fixture.componentInstance.submit(new Event('submit'));
    expect(payload).toEqual({ name: 'After', notes: null });
  });
  it('retains exact DECIMAL and date-only values in compiled controls and submitted payload', () => {
    const fixture = form();
    const exact = '12345678901234567890.123456789012345678';
    const component = fixture.componentInstance;
    let payload: Row | undefined;
    component.submitted.subscribe((value) => (payload = value));
    component.change('code', 'ABC');
    component.change('name', 'Name');
    component.change('amount', exact);
    component.change('day', '2026-10-26');
    component.submit(new Event('submit'));
    expect((payload!['amount'] as ExactNumber).text).toBe(exact);
    expect(payload!['day']).toBe('2026-10-26');
  });
  it('loads MANY_TO_ONE target metadata and a paged identifier/display lookup', async () => {
    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('fields', [field('ownerId', 'UUID', true)]);
    fixture.componentRef.setInput('relations', [
      {
        name: 'owner',
        kind: 'MANY_TO_ONE',
        targetResource: 'owners',
        localField: 'ownerId',
        targetField: 'id',
        displayField: 'name',
        required: true,
      },
    ]);
    await fixture.whenStable();
    http
      .expectOne(base + P.metadata + '/owners')
      .flush(JSON.stringify({ ...fixtureMetadata(), id: 'owners' }), { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/owners')
      .flush(
        '{"items":[{"id":"owner-one","name":"Owner label"}],"offset":0,"limit":100,"total":1}',
        { headers },
      );
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Owner label');
    let payload: Row | undefined;
    fixture.componentInstance.submitted.subscribe((value) => (payload = value));
    fixture.componentInstance.choose('ownerId', JSON.stringify('owner-one'));
    fixture.componentInstance.submit(new Event('submit'));
    expect(payload).toEqual({ ownerId: 'owner-one' });
  });
  it('uses presentation field ordering and Common.Label instead of resource-specific rules', () => {
    const meta = fixtureMetadata();
    meta.presentation = {
      form: {
        behavior: { unsavedChanges: 'CONFIRM_DISCARD' },
        actions: [],
        tabs: [
          {
            id: 'main',
            actions: [],
            sections: [
              {
                id: 'general',
                actions: [],
                groups: [{ id: 'identity', fields: ['name', 'code'] }],
              },
            ],
          },
        ],
      },
    };
    expect(
      orderedFields(meta)
        .slice(0, 2)
        .map((field) => field.name),
    ).toEqual(['name', 'code']);
  });
});
