// Explicit opt-in real HTTP proof. Not part of the default *.spec.ts suite.
// Run with Angular's existing --include and disposable backend/proxy infrastructure.
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { AuthClient } from '../auth-client';
import { UsersClient } from '../users-client';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import { provideThemeRuntime } from '../core-fe/theme/theme-runtime';
import { BUILTIN_THEMES } from '../core-fe/themes/themes';
import { RuntimeClient } from './runtime-client';
import { ResourceScreen } from './resource-screen';
import { ResourceForm } from './resource-form';
import { Target } from './models';
import { APP_ROUTES, targetUrl } from './resource-routing';
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
  .process.env;
it('real .NET navigation → metadata → compiled generic catalogue list/create/PATCH/delete', async () => {
  const base = env['ERBAS_RUNTIME_LIVE_URL'];
  const email = env['ERBAS_TEST_EMAIL'];
  const password = env['ERBAS_TEST_PASSWORD'];
  if (!base || !email || !password)
    throw new Error('Explicit disposable live configuration is required');
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
  const login = await firstValueFrom(TestBed.inject(AuthClient).login(base, { email, password }));
  const session = TestBed.inject(AuthSession);
  session.establish('dotnet', login.accessToken);
  await firstValueFrom(TestBed.inject(UsersClient).current(base, login.accessToken));
  session.markContextReady();
  const client = TestBed.inject(RuntimeClient);
  TestBed.tick();
  await vi.waitFor(() => expect(client.navigation()).not.toBeNull(), { timeout: 15000 });
  const leaves = client.navigation()!.items.flatMap((root) => root.children);
  // Select by public static schema, not an Assets name or compiled screen.
  let target: Target | undefined;
  for (const leaf of leaves) {
    if (leaf.target?.type !== 'RESOURCE') continue;
    const meta = await firstValueFrom(client.metadata(leaf.target.resource));
    if (
      meta.operations.create.authorized &&
      meta.operations.delete.authorized &&
      meta.fields.some((f) => f.name === 'code' && f.type === 'STRING' && f.immutable) &&
      meta.fields.some((f) => f.name === 'name' && f.type === 'STRING')
    ) {
      target = leaf.target;
      break;
    }
  }
  if (target?.type !== 'RESOURCE') throw new Error('No suitable curated static catalogue');
  expect(targetUrl(target)).toBe('/resources/' + encodeURIComponent(target.resource));
  const resource = target.resource;
  const fixture = TestBed.createComponent(ResourceScreen);
  fixture.componentRef.setInput('resource', resource);
  await fixture.whenStable();
  await vi.waitFor(() => expect(fixture.componentInstance.page()).not.toBeNull(), {
    timeout: 15000,
  });
  const code = 'CLIENT_' + crypto.randomUUID().slice(0, 8).toUpperCase();
  const original = 'Client generic proof';
  const edited = 'Client generic proof edited';
  let createdId: unknown;
  try {
    fixture.componentInstance.create();
    await fixture.whenStable();
    let form = fixture.debugElement.query(By.directive(ResourceForm))
      .componentInstance as ResourceForm;
    form.change('code', code);
    form.change('name', original);
    form.submit(new Event('submit'));
    expect(form.message()).toBe('');
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.busy()).toBe(false), {
      timeout: 15000,
    });
    expect(fixture.componentInstance.error()).toBe(null);
    const page = await firstValueFrom(
      client.list(resource, {
        offset: 0,
        limit: 50,
        sort: [],
        filters: [{ field: 'code', operator: 'eq', value: code }],
      }),
    );
    const row = page.items[0]!;
    expect(row['name']).toBe(original);
    createdId = row['id'];
    fixture.componentInstance.open(row, true);
    await vi.waitFor(() => expect(fixture.componentInstance.editing()).toBe(true), {
      timeout: 15000,
    });
    await fixture.whenStable();
    form = fixture.debugElement.query(By.directive(ResourceForm)).componentInstance as ResourceForm;
    form.change('name', edited);
    form.submit(new Event('submit'));
    expect(form.message()).toBe('');
    await fixture.whenStable();
    await vi.waitFor(() => expect(fixture.componentInstance.busy()).toBe(false), {
      timeout: 15000,
    });
    expect((await firstValueFrom(client.get(resource, row['id']!)))['name']).toBe(edited);
    fixture.componentInstance.deleting.set(row);
    fixture.componentInstance.confirmDelete();
    await vi.waitFor(() => expect(fixture.componentInstance.deleting()).toBe(null), {
      timeout: 15000,
    });
    expect(fixture.componentInstance.error()).toBe(null);
    createdId = undefined;
    const remaining = await firstValueFrom(
      client.list(resource, {
        offset: 0,
        limit: 50,
        sort: [],
        filters: [{ field: 'code', operator: 'eq', value: code }],
      }),
    );
    expect(remaining.items).toEqual([]);
    console.info('LIVE_RUNTIME=passed RESOURCE=' + resource + ' CREATE_PATCH_DELETE=passed');
  } finally {
    if (createdId !== undefined) await firstValueFrom(client.delete(resource, createdId as string));
    fixture.destroy();
    session.clear();
  }
}, 60000);
