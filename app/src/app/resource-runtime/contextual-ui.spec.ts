import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import { provideThemeRuntime } from '../core-fe/theme/theme-runtime';
import { BUILTIN_THEMES } from '../core-fe/themes/themes';
import { RuntimeClient } from './runtime-client';
import { ResourceScreen } from './resource-screen';
import { ResourceForm } from './resource-form';
import {
  fixtureMetadata,
  fixtureForm,
  fixtureNavigation,
  TEST_ETAG,
  TEST_RESOURCE as R,
} from './runtime-fixtures';
import { ContextPresentation, Metadata, RESOURCE_PROTOCOL as P } from './models';
const headers = { 'Content-Type': 'application/json', ETag: TEST_ETAG };
describe('Context selection before the common ResourceForm/ResourceLayout renderer', () => {
  let http: HttpTestingController, base: string;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideThemeRuntime(BUILTIN_THEMES),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    base = TestBed.inject(BackendSelection).selected().proxyBaseUrl;
    TestBed.inject(RuntimeClient);
    const session = TestBed.inject(AuthSession);
    session.establish('java', 'opaque');
    session.markContextReady();
    TestBed.tick();
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
  });
  afterEach(() => http.verify());
  function contexts(): ContextPresentation {
    return {
      list: { columns: [{ field: 'name', label: 'Display name' }, { field: 'code' }], actions: [] },
      create: fixtureForm('code', 'name'),
      edit: fixtureForm('id', 'name', 'code'),
      view: fixtureForm('name', 'id'),
    };
  }
  async function screen(context = contexts(), meta = fixtureMetadata()) {
    meta.actions = [];
    meta.presentation = { form: fixtureForm(...meta.fields.map((field) => field.name)) };
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(meta), { headers });
    http
      .expectOne(base + P.metadata + '/' + R + P.presentation)
      .flush(
        JSON.stringify({ id: R, definitionHash: meta.definitionHash, presentation: context }),
        { headers },
      );
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[{"id":"one","name":"Record","code":"TYPE"}],"offset":0,"limit":50}', {
        headers,
      });
    await fixture.whenStable();
    return fixture;
  }
  function names(fixture: any): string[] {
    return [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        'app-resource-form [id^="resource-"]',
      ),
    ].map((field) => field.id.replace('resource-', ''));
  }
  it('renders exact contextual list columns and labels without changing the query', async () => {
    const fixture = await screen();
    expect(
      [...fixture.nativeElement.querySelectorAll('th[data-field]')].map(
        (th: any) => th.dataset.field,
      ),
    ).toEqual(['name', 'code']);
    expect(fixture.nativeElement.querySelector('th').textContent.trim()).toBe('Display name');
    expect(fixture.componentInstance.query().sort).toEqual([]);
  });
  it('CREATE only renders its exact two inputs and submits using existing form semantics', async () => {
    const fixture = await screen();
    fixture.componentInstance.create();
    await fixture.whenStable();
    expect(names(fixture)).toEqual(['code', 'name']);
    const form = fixture.debugElement.query(By.directive(ResourceForm))
      .componentInstance as ResourceForm;
    form.change('code', 'TYPE');
    form.change('name', 'Created');
    form.submit(new Event('submit'));
    const request = http.expectOne(base + P.records + '/' + R);
    expect(request.request.method).toBe('POST');
    expect(JSON.parse(request.request.body)).toEqual({ code: 'TYPE', name: 'Created' });
    request.flush('{"id":"two","name":"Created","code":"TYPE"}', { headers });
    http
      .expectOne((req) => req.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
  });
  it.each([true, false])(
    'persisted row selects EDIT/VIEW for edit=%s and preserves immutable/read-only controls',
    async (edit) => {
      const fixture = await screen();
      fixture.componentInstance.open({ id: 'one' }, edit);
      http
        .expectOne(base + P.records + '/' + R + '/one')
        .flush('{"id":"one","name":"Record","code":"TYPE"}', { headers });
      await fixture.whenStable();
      expect(names(fixture)).toEqual(edit ? ['id', 'name', 'code'] : ['name', 'id']);
      expect(fixture.nativeElement.querySelector('#resource-name').readOnly).toBe(!edit);
      if (edit) expect(fixture.nativeElement.querySelector('#resource-code').readOnly).toBe(true);
      const buttons = [...fixture.nativeElement.querySelectorAll('app-resource-form button')].map(
        (button: any) => button.textContent.trim(),
      );
      expect(buttons.includes('Save')).toBe(edit);
    },
  );
  it('an explicitly empty CREATE and LIST render no omitted fields or columns', async () => {
    const fixture = await screen({
      create: { behavior: { unsavedChanges: 'CONFIRM_DISCARD' }, actions: [], tabs: [] },
      list: { columns: [], actions: [] },
    });
    fixture.componentInstance.create();
    await fixture.whenStable();
    expect(names(fixture)).toEqual([]);
    expect(fixture.nativeElement.querySelector('[data-layout-fallback]')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('th[data-field]')).toHaveLength(0);
  });
  it('invalid contextual representation leaves no usable CRUD screen or silent legacy fallback', async () => {
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
    http
      .expectOne(base + P.metadata + '/' + R + P.presentation)
      .flush('{"id":"other","definitionHash":"hash","presentation":{}}', { headers });
    await fixture.whenStable();
    expect(fixture.componentInstance.meta()).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('invalid_response');
    fixture.nativeElement.querySelector('button').click();
    const retry = http.expectOne(base + P.metadata + '/' + R);
    expect(retry.request.headers.has(P.conditional)).toBe(false);
    retry.flush(JSON.stringify(fixtureMetadata()), { headers });
    http.expectOne(base + P.metadata + '/' + R + P.presentation).flush(
      JSON.stringify({
        id: R,
        definitionHash: fixtureMetadata().definitionHash,
        presentation: {},
      }),
      { headers },
    );
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    await fixture.whenStable();
    expect(fixture.componentInstance.error()).toBeNull();
    expect(fixture.componentInstance.meta()).not.toBeNull();
    http.expectNone((req) => req.url === base + P.records + '/' + R);
  });
  it('COLLECTION/SELECTION placements use existing availability and parameter execution, not CRUD permission', async () => {
    const meta = fixtureMetadata(),
      entity = meta.actions[0]!;
    meta.actions = [
      { ...entity, name: 'collect', scope: 'COLLECTION', parameters: [] },
      { ...entity, name: 'select', scope: 'SELECTION', parameters: [], requiresSelection: true },
      { ...entity, name: 'denied', scope: 'COLLECTION', authorized: false },
    ];
    for (const operation of ['create', 'update', 'delete'] as const)
      meta.operations[operation].authorized = false;
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(meta), { headers });
    http.expectOne(base + P.metadata + '/' + R + P.presentation).flush(
      JSON.stringify({
        id: R,
        definitionHash: meta.definitionHash,
        presentation: { list: { columns: [{ field: 'name' }], actions: ['select', 'collect'] } },
      }),
      { headers },
    );
    http
      .expectOne((req) => req.url === base + P.records + '/' + R)
      .flush('{"items":[{"id":"one","name":"Record"}],"offset":0,"limit":50}', { headers });
    http
      .expectOne(base + P.actions + '/' + R + '/availability')
      .flush('[{"name":"collect","authorized":true,"available":true}]', { headers });
    await fixture.whenStable();
    expect(
      [...fixture.nativeElement.querySelectorAll('[data-action]')].map(
        (button: any) => button.dataset.action,
      ),
    ).toEqual(['select', 'collect']);
    expect(fixture.nativeElement.querySelector('[data-action="select"]').disabled).toBe(true);
    fixture.componentInstance.toggleSelection(fixture.componentInstance.page()!.items[0]!);
    for (const request of http.match(base + P.actions + '/' + R + '/availability')) {
      const scope = JSON.parse(request.request.body).scope;
      request.flush(
        JSON.stringify([
          {
            name: scope === 'COLLECTION' ? 'collect' : 'select',
            authorized: true,
            available: true,
          },
        ]),
        { headers },
      );
    }
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-action="select"]').disabled).toBe(false);
    fixture.componentInstance.action.set(meta.actions[1]!);
    fixture.componentInstance.execute({});
    const request = http.expectOne(base + P.actions + '/' + R + '/select/execute');
    expect(JSON.parse(request.request.body).target).toEqual({ ids: ['one'] });
    request.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne((req) => req.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    http.expectOne(base + P.actions + '/' + R + '/availability').flush('[]', { headers });
  });
  it('CREATE places a COLLECTION action without an entity target and refreshes its availability after execution', async () => {
    const meta = fixtureMetadata();
    meta.actions = [{ ...meta.actions[0]!, name: 'collect', scope: 'COLLECTION', parameters: [] }];
    const create = fixtureForm('name');
    create.actions = ['collect'];
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(meta), { headers });
    http
      .expectOne(base + P.metadata + '/' + R + P.presentation)
      .flush(
        JSON.stringify({ id: R, definitionHash: meta.definitionHash, presentation: { create } }),
        { headers },
      );
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    http
      .expectOne(base + P.actions + '/' + R + '/availability')
      .flush('[{"name":"collect","authorized":true,"available":true}]', { headers });
    fixture.componentInstance.create();
    http
      .expectOne(base + P.actions + '/' + R + '/availability')
      .flush('[{"name":"collect","authorized":true,"available":true}]', { headers });
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('app-resource-form [data-action="collect"]');
    expect(button.disabled).toBe(false);
    button.click();
    fixture.componentInstance.execute({});
    const execution = http.expectOne(base + P.actions + '/' + R + '/collect/execute');
    expect(JSON.parse(execution.request.body)).toEqual({ parameters: {} });
    execution.flush(null, { status: 204, statusText: 'No Content' });
    http
      .expectOne(base + P.actions + '/' + R + '/availability')
      .flush('[{"name":"collect","authorized":true,"available":false}]', { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    http
      .expectOne(base + P.actions + '/' + R + '/availability')
      .flush('[{"name":"collect","authorized":true,"available":false}]', { headers });
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('app-resource-form [data-action="collect"]').disabled,
    ).toBe(true);
  });
});
