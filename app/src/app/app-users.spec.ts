import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthSession } from './auth-session';

describe('Application users collection', () => {
  let fixture: ComponentFixture<App>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: AuthSession;
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const token = 'opaque-issued-token';
  const user = { id: 'opaque-identifier', email: 'admin@example.test', enabled: true, admin: true };
  const collection = (offset = 0, total = 1) => ({
    items: Array.from({ length: Math.min(50, Math.max(0, total - offset)) }, (_, index) => ({
      ...user,
      id: index === 0 ? user.id : `opaque-${offset + index}`,
    })),
    offset,
    limit: 50,
    total,
    order: [{ field: 'id', direction: 'asc' }],
  });
  const click = (id: string) => page.querySelector<HTMLButtonElement>(`#${id}`)!.click();
  const request = (backend = 'java', offset = 0) =>
    http.expectOne(`/backends/${backend}/api/users?offset=${offset}&limit=50`);
  const health = (backend: string) =>
    http.expectOne(`/backends/${backend}/health`).flush({ status: 'ok' }, { headers });
  const switchTo = async (backend: string) => {
    const select = page.querySelector<HTMLSelectElement>('#backend')!;
    select.value = backend;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    health(backend);
    await fixture.whenStable();
  };
  const login = async (backend = 'java', email = user.email) => {
    page.querySelector<HTMLInputElement>('#email')!.value = email;
    page.querySelector<HTMLInputElement>('#password')!.value = 'fictitious-password';
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http
      .expectOne(`/backends/${backend}/api/auth/login`)
      .flush({ accessToken: token }, { headers });
    await fixture.whenStable();
  };
  const loaded = async (backend = 'java') => {
    click('reload-users');
    request(backend).flush(collection(), { headers });
    await fixture.whenStable();
  };

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    fixture = TestBed.createComponent(App);
    page = fixture.nativeElement;
    await fixture.whenStable();
    http.expectOne('/demo/defaults.env').flush('', { status: 404, statusText: 'Not Found' });
    health('java');
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  it('requires authentication without issuing a protected request', () => {
    expect(page.textContent).toContain('Authentication is required');
    expect(page.querySelector('#reload-users')).toBeNull();
    fixture.componentInstance.loadUsers();
    http.expectNone((req) => req.url.endsWith('/api/users'));
  });

  it.each(['java', 'dotnet'])(
    'renders the same admin flow for %s with the issued bearer in memory only',
    async (backend) => {
      if (backend !== 'java') await switchTo(backend);
      await login(backend);
      click('reload-users');
      await fixture.whenStable();
      expect(page.textContent).toContain('Loading users');
      expect(page.querySelector<HTMLButtonElement>('#reload-users')!.disabled).toBe(true);
      const req = request(backend);
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      req.flush(collection(), { headers });
      await fixture.whenStable();
      expect(session.tokenFor(backend)).toBe(token);
      expect(page.querySelectorAll('tbody tr').length).toBe(1);
      expect(page.textContent).toContain(user.id);
      expect(page.textContent).toContain(user.email);
      expect(page.textContent).toContain('Total users: 1');
      expect(page.textContent).toContain('ID ascending');
      expect(page.textContent).not.toContain(token);
      expect(Object.values(localStorage)).not.toContain(token);
      expect(sessionStorage.length).toBe(0);
      expect(document.cookie).not.toContain(token);
    },
  );

  it('pages with server total, disables boundaries and reloads the current window', async () => {
    await login();
    click('reload-users');
    request().flush(collection(0, 51), { headers });
    await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('#previous-users')!.disabled).toBe(true);
    expect(page.querySelector<HTMLButtonElement>('#next-users')!.disabled).toBe(false);
    click('next-users');
    request('java', 50).flush(collection(50, 51), { headers });
    await fixture.whenStable();
    expect(page.textContent).toContain('Total users: 51');
    expect(page.textContent).toContain('Offset 50');
    expect(page.querySelector<HTMLButtonElement>('#next-users')!.disabled).toBe(true);
    click('reload-users');
    request('java', 50).flush(collection(50, 51), { headers });
    await fixture.whenStable();
    click('previous-users');
    request().flush(collection(0, 51), { headers });
    await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('#previous-users')!.disabled).toBe(true);
    click('previous-users');
    http.expectNone((req) => req.url.endsWith('/api/users'));
  });

  it('handles an empty window after the server total shrinks and permits returning', async () => {
    await login();
    click('reload-users');
    request().flush(collection(0, 51), { headers });
    await fixture.whenStable();
    click('next-users');
    request('java', 50).flush(collection(50, 7), { headers });
    await fixture.whenStable();
    expect(page.textContent).toContain('No users in this window');
    expect(page.textContent).toContain('Total users: 7');
    expect(page.querySelector<HTMLButtonElement>('#next-users')!.disabled).toBe(true);
    expect(page.querySelector<HTMLButtonElement>('#previous-users')!.disabled).toBe(false);
  });

  it.each([
    [401, 'Sign in again', false],
    [403, 'requires an administrator', true],
    [400, 'pagination request is invalid', true],
    [503, 'service is unavailable', true],
  ])(
    'handles HTTP %s with safe feedback and no stale rows',
    async (status, message, authenticated) => {
      await login('java', status === 403 ? 'regular@example.test' : user.email);
      await loaded();
      click('reload-users');
      await fixture.whenStable();
      expect(page.querySelector('tbody')).toBeNull();
      request().flush({ code: 'private-backend-detail' }, { status, statusText: 'Failure' });
      await fixture.whenStable();
      expect(session.authenticated()).toBe(authenticated);
      expect(page.textContent).toContain(message);
      expect(page.textContent).not.toContain('private-backend-detail');
      expect(page.querySelector('tbody')).toBeNull();
      if (status === 401) {
        expect(session.tokenFor('java')).toBeNull();
        expect(page.querySelector('#reload-users')).toBeNull();
        await login();
        expect(session.authenticated()).toBe(true);
      }
    },
  );

  it('reports transport failure without clearing authentication', async () => {
    await login();
    click('reload-users');
    request().error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(page.textContent).toContain('service is unavailable');
    expect(session.authenticated()).toBe(true);
  });

  it('rejects malformed success without retaining partial or old data', async () => {
    await login();
    await loaded();
    click('reload-users');
    request().flush({ ...collection(), items: [user, { private: 'private-detail' }] }, { headers });
    await fixture.whenStable();
    expect(page.textContent).toContain('invalid users response');
    expect(page.textContent).not.toContain('private-detail');
    expect(page.querySelector('tbody')).toBeNull();
    expect(session.authenticated()).toBe(true);
  });

  it.each([
    ['java', 'dotnet'],
    ['dotnet', 'java'],
  ])('discards %s token/data and cancels late responses when switching to %s', async (from, to) => {
    if (from !== 'java') await switchTo(from);
    await login(from);
    await loaded(from);
    click('reload-users');
    const old = request(from);
    await switchTo(to);
    expect(old.cancelled).toBe(true);
    expect(() => old.flush(collection(), { headers })).toThrow('cancelled');
    expect(session.tokenFor(from)).toBeNull();
    expect(session.tokenFor(to)).toBeNull();
    expect(page.querySelector('tbody')).toBeNull();
    expect(page.textContent).not.toContain(user.email);
    expect(fixture.componentInstance.usersState()).toBe('idle');
    await login(to);
    await loaded(to);
    expect(session.tokenFor(to)).toBe(token);
  });

  it('clears loaded rows and discards the bearer on Clear session', async () => {
    await login();
    await loaded();
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent === 'Clear session')!
      .click();
    await fixture.whenStable();
    expect(session.authenticated()).toBe(false);
    expect(page.querySelector('tbody')).toBeNull();
    expect(fixture.componentInstance.users()).toBeNull();
    http.expectNone((req) => req.url.endsWith('/api/users'));
  });

  it('cancels a protected request on Clear session and application destruction', async () => {
    await login();
    click('reload-users');
    const pending = request();
    fixture.componentInstance.clearSession();
    expect(pending.cancelled).toBe(true);
    expect(() => pending.flush(collection(), { headers })).toThrow('cancelled');
    await fixture.whenStable();
    expect(session.authenticated()).toBe(false);
    await login();
    click('reload-users');
    const destroyed = request();
    fixture.destroy();
    expect(destroyed.cancelled).toBe(true);
  });

  it('cancels protected data when a new login replaces the existing session', async () => {
    await login();
    click('reload-users');
    const old = request();
    await login();
    expect(old.cancelled).toBe(true);
    expect(fixture.componentInstance.users()).toBeNull();
  });

  it.each([
    ['java', 'dotnet'],
    ['dotnet', 'java'],
  ])('clears displayed %s rows when switching to %s', async (from, to) => {
    if (from !== 'java') await switchTo(from);
    await login(from);
    await loaded(from);
    expect(page.querySelector('tbody')).not.toBeNull();
    await switchTo(to);
    expect(page.querySelector('tbody')).toBeNull();
    expect(session.authenticated()).toBe(false);
    expect(page.textContent).not.toContain(user.email);
    await login(to);
    click('reload-users');
    request(to).flush(collection(), { headers });
    await fixture.whenStable();
    expect(page.textContent).toContain('Offset 0');
  });
});
