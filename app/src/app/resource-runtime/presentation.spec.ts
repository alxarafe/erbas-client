import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideThemeRuntime } from '../core-fe/theme/theme-runtime';
import { BUILTIN_THEMES } from '../core-fe/themes/themes';
import { ResourceForm } from './resource-form';
import { ResourceScreen } from './resource-screen';
import { ResourceLayout, projectLayout } from './resource-layout';
import { RuntimeClient } from './runtime-client';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import {
  field,
  fixtureMetadata,
  finishLegacyPresentation,
  fixtureNavigation,
  TEST_ETAG,
  TEST_RESOURCE as R,
} from './runtime-fixtures';
import { Action, Field, Metadata, Presentation, Row, RESOURCE_PROTOCOL as P } from './models';
import { ExactNumber } from './exact-json';
const headers = { 'Content-Type': 'application/json', ETag: TEST_ETAG };
function action(name: string): Action {
  return { ...fixtureMetadata().actions[0]!, name };
}
function layout(): Presentation {
  return {
    form: {
      behavior: { unsavedChanges: 'CONFIRM_DISCARD' },
      actions: ['finish'],
      tabs: [
        {
          id: 'identity',
          label: 'Identity tab',
          actions: [],
          sections: [
            {
              id: 'identity',
              label: 'Identity section',
              collapsible: false,
              initiallyCollapsed: false,
              actions: [],
              groups: [
                { id: 'names', label: 'Names group', fields: ['name', 'code'] },
                { id: 'status', label: 'Status group', fields: ['active'] },
              ],
            },
            {
              id: 'danger',
              label: 'Lifecycle section',
              collapsible: true,
              initiallyCollapsed: true,
              actions: ['retire'],
              groups: [{ id: 'audit', label: 'Record group', fields: ['id'] }],
            },
          ],
        },
        {
          id: 'financial',
          label: 'Purchase tab',
          actions: ['move'],
          sections: [
            {
              id: 'purchase',
              label: 'Purchase section',
              collapsible: false,
              initiallyCollapsed: false,
              actions: [],
              groups: [{ id: 'price', label: 'Price group', fields: ['amount', 'day'] }],
            },
          ],
        },
        {
          id: 'empty',
          label: 'Must disappear',
          actions: ['unauthorized'],
          sections: [
            {
              id: 'empty',
              collapsible: false,
              initiallyCollapsed: false,
              actions: [],
              groups: [{ id: 'empty', fields: ['hidden'] }],
            },
          ],
        },
      ],
    },
  };
}
function meta(): Metadata {
  const value = fixtureMetadata();
  value.presentation = layout();
  value.actions = [
    action('finish'),
    action('retire'),
    action('move'),
    { ...action('unauthorized'), authorized: false },
  ];
  value.fields.push(
    field('hidden', 'STRING', false, {
      annotations: [{ vocabulary: 'UI', term: 'Hidden', value: true }],
    }),
  );
  return value;
}
describe('Presentation projection without authorization policy inference', () => {
  it('uses declared order and keeps known fields in their declared groups', () => {
    const value = meta(),
      result = projectLayout(
        value.fields,
        value.presentation,
        value.actions.filter((a) => a.authorized),
      );
    expect(result.tabs.map((t) => t.id)).toEqual(['identity', 'financial']);
    expect(result.tabs[0]!.sections.map((s) => s.id)).toEqual(['identity', 'danger']);
    expect(result.tabs[0]!.sections[0]!.groups.map((g) => g.id)).toEqual(['names', 'status']);
    expect(result.tabs[0]!.sections[0]!.groups[0]!.fields.map((f) => f.name)).toEqual([
      'name',
      'code',
    ]);
    expect(result.fallback.map((f) => f.name)).toEqual(['notes']);
  });
  it('removes empty groups, sections and tabs after static visibility and effective actions', () => {
    const value = meta(),
      result = projectLayout(value.fields, value.presentation, []);
    expect(result.tabs.find((t) => t.id === 'empty')).toBeUndefined();
    expect(
      result.tabs
        .flatMap((t) => t.sections)
        .flatMap((s) => s.groups)
        .some((g) => g.id === 'empty'),
    ).toBe(false);
  });
  it('retains action-only effective sections while removing empty groups', () => {
    const value = layout();
    value.form.tabs[2]!.sections[0]!.actions = ['finish'];
    value.form.actions = [];
    const result = projectLayout([], value, [action('finish')]);
    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0]!.sections[0]!.groups).toEqual([]);
    expect(result.tabs[0]!.sections[0]!.actions[0]?.name).toBe('finish');
  });
  it('ignores unknown references and places unassigned fields once in metadata order', () => {
    const value = meta();
    value.presentation!.form.tabs[0]!.sections[0]!.groups[0]!.fields = ['missing', 'name', 'name'];
    const result = projectLayout(value.fields, value.presentation, []);
    expect(result.tabs[0]!.sections[0]!.groups[0]!.fields.map((f) => f.name)).toEqual(['name']);
    expect(result.fallback.map((f) => f.name)).toEqual(['code', 'notes']);
  });
  it('never renders unauthorized or unsupported-scope action references', () => {
    const value = meta();
    const result = projectLayout(value.fields, value.presentation, [
      ...value.actions,
      { ...action('collection'), scope: 'COLLECTION' },
    ]);
    expect(result.tabs.some((tab) => tab.id === 'empty')).toBe(false);
    expect(result.unplacedActions.some((action) => action.name === 'collection')).toBe(false);
  });
  it('falls back to flat fields and actions when presentation is absent', () => {
    const fields = fixtureMetadata().fields;
    const result = projectLayout(fields, undefined, [action('finish')]);
    expect(result.tabs).toEqual([]);
    expect(result.fallback).toEqual(fields);
    expect(result.unplacedActions[0]?.name).toBe('finish');
  });
});
describe('Compiled hierarchical forms and effective metadata', () => {
  let http: HttpTestingController, base: string, client: RuntimeClient, session: AuthSession;
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
    session = TestBed.inject(AuthSession);
    client = TestBed.inject(RuntimeClient);
    session.establish('java', 'admin-token');
    session.markContextReady();
    TestBed.tick();
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
  });
  afterEach(() => http.verify());
  async function form(readOnly = false, presentation: Presentation | undefined = layout()) {
    const fixture = TestBed.createComponent(ResourceForm),
      value = meta();
    fixture.componentRef.setInput('fields', value.fields);
    fixture.componentRef.setInput('presentation', presentation);
    fixture.componentRef.setInput(
      'actions',
      readOnly ? [] : value.actions.filter((a) => a.authorized),
    );
    fixture.componentRef.setInput('availability', [
      { name: 'finish', authorized: true, available: true },
      { name: 'retire', authorized: true, available: true },
      { name: 'move', authorized: true, available: false },
    ]);
    fixture.componentRef.setInput('readOnly', readOnly);
    if (readOnly)
      fixture.componentRef.setInput('record', { id: 'one', code: 'CODE', name: 'Record' });
    await fixture.whenStable();
    return fixture;
  }
  it('renders labelled ordered tabs, sections, groups and field placement from metadata', async () => {
    const fixture = await form();
    const page = fixture.nativeElement as HTMLElement;
    expect([...page.querySelectorAll('[role=tab]')].map((t) => t.textContent?.trim())).toEqual([
      'Identity tab',
      'Purchase tab',
    ]);
    expect(page.querySelector('#resource-name')!.closest('fieldset')!.dataset['group']).toBe(
      'names',
    );
    expect(
      page.querySelector('#resource-amount')!.closest('[data-tab]')!.getAttribute('data-tab'),
    ).toBe('financial');
    expect(page.textContent).toContain('Identity section');
    expect(page.textContent).toContain('Names group');
    expect(page.querySelector('[data-layout-fallback] #resource-notes')).not.toBeNull();
    expect(page.querySelector('#resource-hidden')).toBeNull();
  });
  it('chooses first effective tab and preserves values when changing tabs with pointer or keyboard', async () => {
    const fixture = await form();
    let page = fixture.nativeElement as HTMLElement;
    const tabs = page.querySelectorAll<HTMLButtonElement>('[role=tab]');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    fixture.componentInstance.change('name', 'Unsaved');
    tabs[1]!.click();
    await fixture.whenStable();
    expect(page.querySelector<HTMLElement>('[data-tab=financial]')!.hidden).toBe(false);
    tabs[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await fixture.whenStable();
    expect(page.querySelector<HTMLInputElement>('#resource-name')!.value).toBe('Unsaved');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
  });
  it('uses native collapsible sections with the declared initial state', async () => {
    const fixture = await form();
    expect(fixture.nativeElement.querySelector('details[data-section=danger]').open).toBe(false);
    expect(fixture.nativeElement.querySelector('details summary').textContent).toContain(
      'Lifecycle section',
    );
  });
  it('places authorized actions at form, tab and section levels; disables unavailable actions', async () => {
    const fixture = await form(),
      page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('[data-action=finish]')!.closest('[data-tab]')).toBeNull();
    expect(
      page.querySelector('[data-action=move]')!.closest('[data-tab]')!.getAttribute('data-tab'),
    ).toBe('financial');
    expect(
      page
        .querySelector('[data-action=retire]')!
        .closest('[data-section]')!
        .getAttribute('data-section'),
    ).toBe('danger');
    expect(page.querySelector<HTMLButtonElement>('[data-action=move]')!.disabled).toBe(true);
    expect(page.querySelector('[data-action=unauthorized]')).toBeNull();
    let chosen: Action | undefined;
    fixture.componentInstance.actionSelected.subscribe((value) => (chosen = value));
    page.querySelector<HTMLButtonElement>('[data-action=finish]')!.click();
    expect(chosen?.name).toBe('finish');
  });
  it('read-only viewing uses the same static layout with no write submission', async () => {
    const fixture = await form(true);
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector<HTMLInputElement>('#resource-name')!.readOnly).toBe(true);
    expect(page.querySelector('[type=submit]')).toBeNull();
    expect(page.querySelectorAll('[role=tab]')).toHaveLength(2);
    let submitted = false;
    fixture.componentInstance.submitted.subscribe(() => (submitted = true));
    fixture.componentInstance.change('name', 'Attempt');
    fixture.componentInstance.submit(new Event('submit'));
    expect(submitted).toBe(false);
  });
  it('retains immutable, nullable and required semantics independent of field placement', async () => {
    const fixture = await form();
    fixture.componentRef.setInput('record', {
      id: 'one',
      code: 'CODE',
      name: 'Before',
      notes: 'Note',
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#resource-code').readOnly).toBe(true);
    let payload: Row | undefined;
    fixture.componentInstance.submitted.subscribe((value) => (payload = value));
    fixture.componentInstance.change('code', 'ATTEMPT');
    fixture.componentInstance.change('notes', null);
    fixture.componentInstance.submit(new Event('submit'));
    expect(payload).toEqual({ notes: null });
  });
  it('static hidden fields cannot leak into either the layout fallback or PATCH payload', async () => {
    const fixture = await form();
    fixture.componentRef.setInput('record', {
      id: 'one',
      code: 'CODE',
      name: 'Before',
      hidden: 'Secret',
    });
    await fixture.whenStable();
    let payload: Row | undefined;
    fixture.componentInstance.submitted.subscribe((value) => (payload = value));
    fixture.componentInstance.change('hidden', 'Attempt');
    fixture.componentInstance.change('name', 'After');
    fixture.componentInstance.submit(new Event('submit'));
    expect(payload).toEqual({ name: 'After' });
    expect(fixture.nativeElement.querySelector('#resource-hidden')).toBeNull();
  });
  it('keeps scalar type controls and exact decimal/date semantics under layout', async () => {
    const fixture = await form();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector<HTMLInputElement>('#resource-day')!.type).toBe('date');
    expect(page.querySelector<HTMLInputElement>('#resource-active')!.type).toBe('checkbox');
    let payload: Row | undefined;
    fixture.componentInstance.submitted.subscribe((value) => (payload = value));
    fixture.componentInstance.change('name', 'Name');
    fixture.componentInstance.change('code', 'CODE');
    fixture.componentInstance.change('amount', '9007199254740993.123456789');
    fixture.componentInstance.submit(new Event('submit'));
    expect((payload!['amount'] as ExactNumber).text).toBe('9007199254740993.123456789');
  });
  it('a placed MANY_TO_ONE field retains generic lookup labels and identifier transport', async () => {
    const fixture = TestBed.createComponent(ResourceForm);
    fixture.componentRef.setInput('fields', [field('ownerId', 'UUID', true)]);
    fixture.componentRef.setInput('record', { ownerId: 'owner-one' });
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
    const presentation = layout();
    presentation.form.tabs[0]!.sections[0]!.groups[0]!.fields = ['ownerId'];
    fixture.componentRef.setInput('presentation', presentation);
    await fixture.whenStable();
    http
      .expectOne(base + P.metadata + '/owners')
      .flush(JSON.stringify({ ...fixtureMetadata(), id: 'owners' }), { headers });
    http
      .expectOne((request) => request.url === base + P.records + '/owners')
      .flush('{"items":[{"id":"owner-one","name":"Owner label"}],"offset":0,"limit":100}', {
        headers,
      });
    await fixture.whenStable();
    const select = fixture.nativeElement.querySelector('#resource-ownerId') as HTMLSelectElement;
    expect(select.closest('fieldset')!.getAttribute('data-group')).toBe('names');
    expect(select.textContent).toContain('Owner label');
    expect(select.value).toBe(JSON.stringify('owner-one'));
    expect(select.selectedOptions[0]?.textContent).toContain('Owner label');
    expect(select.textContent).not.toContain('Current: owner-one');
  });
  it('field labels and constraint help come from scalar metadata, not container rules', async () => {
    const fixture = await form();
    const fields = meta().fields;
    fields.find((field) => field.name === 'name')!.annotations = [
      { vocabulary: 'Common', term: 'Label', value: 'Display name' },
    ];
    fields.find((field) => field.name === 'name')!.constraints = {
      maximumLength: new ExactNumber('80'),
    };
    fixture.componentRef.setInput('fields', fields);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('label[for=resource-name]').textContent).toBe(
      'Display name',
    );
    expect(fixture.nativeElement.textContent).toContain('maximumLength: 80');
  });
  it('missing layout retains the existing flat form', async () => {
    const fixture = await form();
    fixture.componentRef.setInput('presentation', undefined);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=tablist]')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-layout-fallback] #resource-name'),
    ).not.toBeNull();
  });
  async function screen(value: Metadata) {
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', R);
    await fixture.whenStable();
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(value), { headers });
    finishLegacyPresentation(http);
    http
      .expectOne((request) => request.url === base + P.records + '/' + R)
      .flush('{"items":[{"id":"one","name":"Record","code":"CODE"}],"offset":0,"limit":50}', {
        headers,
      });
    await fixture.whenStable();
    return fixture;
  }
  it.each([true, false])(
    'effective profile admin=%s controls CRUD/actions while field schema stays static',
    async (admin) => {
      const value = meta();
      if (!admin) {
        for (const op of ['create', 'update', 'delete'] as const)
          value.operations[op].authorized = false;
        value.actions.forEach((action) => (action.authorized = false));
      }
      const fixture = await screen(value),
        page = fixture.nativeElement as HTMLElement;
      const buttons = [...page.querySelectorAll('button')].map((button) =>
        button.textContent?.trim(),
      );
      expect(buttons.includes('Create')).toBe(admin);
      expect(buttons.includes('Edit')).toBe(admin);
      expect(buttons.includes('Delete')).toBe(admin);
      fixture.componentInstance.open({ id: 'one' }, false);
      http
        .expectOne(base + P.records + '/' + R + '/one')
        .flush('{"id":"one","code":"CODE","name":"Record"}', { headers });
      if (admin)
        http.expectOne(base + P.actions + '/' + R + '/availability').flush(
          JSON.stringify(
            value.actions.map((action) => ({
              name: action.name,
              authorized: action.authorized,
              available: action.authorized,
            })),
          ),
          { headers },
        );
      await fixture.whenStable();
      expect(page.querySelectorAll('[role=tab]')).toHaveLength(2);
      expect(page.querySelectorAll('[data-action]').length > 0).toBe(admin);
      expect(page.querySelector<HTMLInputElement>('#resource-name')!.readOnly).toBe(true);
    },
  );
  it('metadata 304 preserves presentation; changed ETag refreshes it without continuous fetches', async () => {
    const fixture = await screen(meta());
    fixture.componentInstance.refreshMetadata();
    let request = http.expectOne(base + P.metadata + '/' + R);
    expect(request.request.headers.get(P.conditional)).toBe(TEST_ETAG);
    request.flush('', { status: HttpStatusCode.NotModified, statusText: 'Not Modified' });
    finishLegacyPresentation(http);
    http
      .expectOne((req) => req.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    expect(fixture.componentInstance.meta()!.presentation!.form.tabs[0]!.label).toBe(
      'Identity tab',
    );
    const changed = meta();
    changed.presentation!.form.tabs[0]!.label = 'Updated label';
    fixture.componentInstance.refreshMetadata();
    request = http.expectOne(base + P.metadata + '/' + R);
    request.flush(JSON.stringify(changed), { headers: { ...headers, ETag: '"changed"' } });
    finishLegacyPresentation(http);
    http
      .expectOne((req) => req.url === base + P.records + '/' + R)
      .flush('{"items":[],"offset":0,"limit":50}', { headers });
    await fixture.whenStable();
    fixture.componentInstance.create();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Updated label');
    http.expectNone(base + P.metadata + '/' + R);
  });
  it('switching identities never shares cached metadata/capabilities/ETags', () => {
    client.metadata(R).subscribe();
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(meta()), { headers });
    finishLegacyPresentation(http);
    session.clear();
    session.establish('java', 'restricted-token');
    session.markContextReady();
    TestBed.tick();
    http
      .expectOne(base + P.navigation)
      .flush(JSON.stringify({ ...fixtureNavigation, version: 'restricted', items: [] }), {
        headers: { ...headers, ETag: '"restricted"' },
      });
    let loaded: Metadata | undefined;
    client.metadata(R).subscribe((value) => (loaded = value));
    const request = http.expectOne(base + P.metadata + '/' + R);
    expect(request.request.headers.has(P.conditional)).toBe(false);
    const restricted = meta();
    restricted.operations.create.authorized = false;
    request.flush(JSON.stringify(restricted), { headers });
    expect(loaded!.operations.create.authorized).toBe(false);
    expect(client.navigation()!.items).toEqual([]);
  });
  it('backend denial remains authoritative for a stale write affordance', async () => {
    const fixture = await screen(meta());
    fixture.componentInstance.create();
    fixture.componentInstance.save({ code: 'CODE', name: 'Attempt' });
    http
      .expectOne(base + P.records + '/' + R)
      .flush('{"code":"forbidden","errors":[{"code":"forbidden"}]}', {
        status: HttpStatusCode.Forbidden,
        statusText: 'Forbidden',
        headers,
      });
    expect(fixture.componentInstance.error()!.status).toBe(HttpStatusCode.Forbidden);
    expect(session.authenticated()).toBe(true);
  });
});
