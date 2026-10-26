// Explicit external .NET proof with existing real profiles and disposable data.
// The browser proof is separate; this uses the project's current Vitest/JSDOM.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch, HttpStatusCode } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { AuthClient } from '../auth-client';
import { UsersClient } from '../users-client';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import { provideThemeRuntime } from '../core-fe/theme/theme-runtime';
import { BUILTIN_THEMES } from '../core-fe/themes/themes';
import { RuntimeClient } from './runtime-client';
import { ResourceScreen } from './resource-screen';
import { APP_ROUTES, resourceComponent } from './resource-routing';
import { stringifyExact } from './exact-json';
import { NavigationItem, Row } from './models';
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;
const liveTimeout = 15000;
it('two real identities share static presentation but not navigation, capabilities or metadata cache', async () => {
  const base = env['ERBAS_RUNTIME_LIVE_URL'],
    resource = env['ERBAS_PRESENTATION_RESOURCE'],
    id = env['ERBAS_PRESENTATION_ID'];
  if (!base || !resource || !id)
    throw new Error('Explicit live proof URL, resource and record are required');
  TestBed.configureTestingModule({
    providers: [
      provideRouter(APP_ROUTES),
      provideHttpClient(withFetch()),
      provideThemeRuntime(BUILTIN_THEMES),
      {
        provide: BackendSelection,
        useValue: { selected: signal({ id: 'dotnet', proxyBaseUrl: base }) },
      },
    ],
  });
  const session = TestBed.inject(AuthSession),
    client = TestBed.inject(RuntimeClient);
  const baseUrl = base;
  async function login(email: string | undefined, password: string | undefined) {
    if (!email || !password) throw new Error('Explicit credentials required');
    const response = await firstValueFrom(
      TestBed.inject(AuthClient).login(baseUrl, { email, password }),
    );
    session.establish('dotnet', response.accessToken);
    await firstValueFrom(TestBed.inject(UsersClient).current(baseUrl, response.accessToken));
    session.markContextReady();
    TestBed.tick();
    await vi.waitFor(() => expect(client.navigation()).not.toBeNull(), { timeout: liveTimeout });
  }
  function flatten(items: NavigationItem[]): NavigationItem[] {
    return items.flatMap((item) => [item, ...flatten(item.children)]);
  }
  async function screen(row: Row) {
    const fixture = TestBed.createComponent(ResourceScreen);
    fixture.componentRef.setInput('resource', resource);
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.page()).not.toBeNull(), {
      timeout: liveTimeout,
    });
    fixture.componentInstance.open(row, false);
    await vi.waitFor(() => expect(fixture.componentInstance.selected()).not.toBeNull(), {
      timeout: liveTimeout,
    });
    await fixture.whenStable();
    return fixture;
  }
  await login(env['ERBAS_TEST_EMAIL'], env['ERBAS_TEST_PASSWORD']);
  const admin = await firstValueFrom(client.metadata(resource));
  const adminNav = flatten(client.navigation()!.items);
  const row = await firstValueFrom(client.get(resource, id));
  expect(resourceComponent(resource, {})).toBe(ResourceScreen);
  expect(admin.presentation!.form.tabs.length).toBeGreaterThan(1);
  expect(
    admin.presentation!.form.tabs.some((tab) =>
      tab.sections.some((section) => section.collapsible),
    ),
  ).toBe(true);
  for (const op of ['create', 'update', 'delete'] as const)
    expect(admin.operations[op].authorized).toBe(true);
  const adminFixture = await screen(row);
  await vi.waitFor(
    () => expect(adminFixture.componentInstance.availability().length).toBeGreaterThan(0),
    { timeout: liveTimeout },
  );
  const adminLabels = [
    ...(adminFixture.nativeElement as HTMLElement).querySelectorAll('[role=tab]'),
  ].map((tab) => tab.textContent);
  expect(adminLabels.length).toBeGreaterThan(1);
  expect(adminFixture.nativeElement.querySelectorAll('[data-action]').length).toBeGreaterThan(0);
  adminFixture.componentInstance.open(row, true);
  await vi.waitFor(() => expect(adminFixture.componentInstance.editing()).toBe(true), {
    timeout: liveTimeout,
  });
  await adminFixture.whenStable();
  const writable = admin.fields.find(
    (field) => field.type === 'STRING' && !field.readOnly && !field.immutable,
  )!;
  expect(
    (adminFixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#resource-' + writable.name,
    )!.readOnly,
  ).toBe(false);
  adminFixture.destroy();
  session.clear();
  expect(client.navigation()).toBe(null);
  await login(env['ERBAS_RESTRICTED_EMAIL'], env['ERBAS_RESTRICTED_PASSWORD']);
  const restricted = await firstValueFrom(client.metadata(resource));
  expect(stringifyExact(restricted.fields)).toBe(stringifyExact(admin.fields));
  expect(stringifyExact(restricted.presentation)).toBe(stringifyExact(admin.presentation));
  for (const op of ['create', 'update', 'delete'] as const)
    expect(restricted.operations[op].authorized).toBe(false);
  expect(restricted.actions.filter((action) => action.authorized)).toEqual([]);
  const readerNav = flatten(client.navigation()!.items);
  expect(readerNav.length).toBeLessThan(adminNav.length);
  expect(
    readerNav.some((item) => item.target?.type === 'RESOURCE' && item.target.resource === resource),
  ).toBe(true);
  const readerFixture = await screen(row);
  expect(
    [...(readerFixture.nativeElement as HTMLElement).querySelectorAll('[role=tab]')].map(
      (tab) => tab.textContent,
    ),
  ).toEqual(adminLabels);
  const buttons = [...(readerFixture.nativeElement as HTMLElement).querySelectorAll('button')].map(
    (button) => button.textContent?.trim(),
  );
  for (const label of ['Create', 'Edit', 'Delete']) expect(buttons).not.toContain(label);
  expect(readerFixture.nativeElement.querySelectorAll('[data-action]')).toHaveLength(0);
  expect(
    (readerFixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '#resource-' + writable.name,
    )!.readOnly,
  ).toBe(true);
  expect(await firstValueFrom(client.metadata(resource, true))).toBe(restricted);
  const target = row[restricted.idDefinition.field]!;
  const create = Object.fromEntries(
    restricted.fields
      .filter((field) => field.required && !field.readOnly)
      .map((field) => [field.name, row[field.name]!]),
  ) as Row;
  const action = admin.actions.find(
    (action) =>
      action.scope === 'ENTITY' && action.parameters.every((parameter) => !parameter.required),
  )!;
  const operations: Observable<unknown>[] = [
    client.save(resource, create),
    client.save(resource, { [writable.name]: row[writable.name]! }, target),
    client.delete(resource, target),
    client.execute(resource, action.name, target, {}),
  ];
  for (const operation of operations) {
    await expect(firstValueFrom(operation)).rejects.toMatchObject({
      status: HttpStatusCode.Forbidden,
    });
  }
  const availability = await firstValueFrom(client.availability(resource, target));
  expect(availability.every((action) => !action.authorized && !action.available)).toBe(true);
  readerFixture.destroy();
  session.clear();
  console.info(
    'PRESENTATION_LIVE=passed STATIC_FIELDS_IDENTICAL=passed EFFECTIVE_CAPABILITIES=passed DIRECT_FORBIDDEN_WRITES=4',
  );
}, 60000);
