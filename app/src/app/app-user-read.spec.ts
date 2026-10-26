import { RuntimeClient } from './resource-runtime/runtime-client';
import { RESOURCE_PROTOCOL } from './resource-runtime/models';
import { finishLegacyNavigation } from './resource-runtime/runtime-fixtures';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './resource-runtime/resource-routing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthSession } from './auth-session';
import { CURRENT_USER_ENDPOINT, USERS_ENDPOINT, USERS_PAGE_SIZE, USER_HTTP } from './users-client';
import { UserReadState } from './user-read-state';

describe('Profile and administrator detail UI', () => {
  let fixture: ComponentFixture<App>,
    page: HTMLElement,
    http: HttpTestingController,
    session: AuthSession;
  const bearer = 'opaque-fixture-token';
  const admin = { id: 'opaque-admin', email: 'admin@example.test', enabled: true, admin: true };
  const regular = {
    id: 'opaque /?# user',
    email: 'regular@example.test',
    enabled: true,
    admin: false,
  };
  const headers = {
    [USER_HTTP.contentType]: USER_HTTP.json,
    [USER_HTTP.cacheControl]: USER_HTTP.noStore,
  };
  const current = (backend = 'java') =>
    http.expectOne(`/backends/${backend}${CURRENT_USER_ENDPOINT}`);
  const detail = (id = regular.id, backend = 'java') =>
    http.expectOne(`/backends/${backend}${USERS_ENDPOINT}/${encodeURIComponent(id)}`);
  const login = () => {
    page.querySelector<HTMLInputElement>('#email')!.value = admin.email;
    page.querySelector<HTMLInputElement>('#password')!.value = 'fixture-password';
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    const backend = fixture.componentInstance.selection.selected().id;
    http
      .expectOne(`/backends/${backend}/api/auth/login`)
      .flush({ accessToken: bearer }, { headers });
    return current(backend);
  };
  const signedIn = async (user = admin) => {
    login().flush(user, { headers });
    await fixture.whenStable();
  };
  const loaded = async () => {
    page.querySelector<HTMLButtonElement>('#reload-users')!.click();
    const backend = fixture.componentInstance.selection.selected().id;
    http.expectOne(`/backends/${backend}${USERS_ENDPOINT}?offset=0&limit=${USERS_PAGE_SIZE}`).flush(
      {
        items: [regular],
        offset: 0,
        limit: USERS_PAGE_SIZE,
        total: 1,
        order: [{ field: 'id', direction: 'asc' }],
      },
      { headers },
    );
    await fixture.whenStable();
  };
  const switchBackend = async () => {
    const select = page.querySelector<HTMLSelectElement>('#backend')!;
    select.value = fixture.componentInstance.selection.selected().id === 'java' ? 'dotnet' : 'java';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    http
      .expectOne(`${fixture.componentInstance.selection.selected().proxyBaseUrl}/health`)
      .flush({ status: 'ok' }, { headers });
    await fixture.whenStable();
  };
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(APP_ROUTES), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    fixture = TestBed.createComponent(App);
    page = fixture.nativeElement;
    await fixture.whenStable();
    http
      .expectOne('/demo/defaults.env')
      .flush('', { status: HttpStatusCode.NotFound, statusText: 'Not Found' });
    http.expectOne('/backends/java/health').flush({ status: 'ok' }, { headers });
    await fixture.whenStable();
  });
  afterEach(() => {
    finishLegacyNavigation(http);
    http.verify();
  });

  it.each(['java', 'dotnet'])(
    'loads %s profile after login and fetches detail through the same UI',
    async (backend) => {
      if (backend === 'dotnet') await switchBackend();
      const profile = login();
      expect(session.tokenFor(backend)).toBe(bearer);
      expect(profile.request.headers.get(USER_HTTP.authorization)).toBe(
        `${USER_HTTP.bearer} ${bearer}`,
      );
      await fixture.whenStable();
      expect(page.querySelector('#reload-users')).toBeNull();
      profile.flush(admin, { headers });
      await fixture.whenStable();
      expect(page.querySelector('#current-user')!.textContent).toContain(admin.email);
      expect(page.querySelector('#reload-users')).not.toBeNull();
      await loaded();
      page.querySelector<HTMLButtonElement>('.view-user')!.click();
      const req = detail(regular.id, backend);
      expect(req.request.headers.get(USER_HTTP.authorization)).toBe(
        `${USER_HTTP.bearer} ${bearer}`,
      );
      req.flush(regular, { headers });
      await fixture.whenStable();
      expect(page.querySelector('#user-detail')!.textContent).toContain(regular.email);
      expect(fixture.componentInstance.detailUser()).toEqual(regular);
      expect(page.textContent).not.toContain(bearer);
      expect(Object.values(localStorage)).not.toContain(bearer);
      expect(sessionStorage.length).toBe(0);
      expect(document.cookie).not.toContain(bearer);
    },
  );

  it('keeps a regular profile authenticated without offering administrator controls', async () => {
    await signedIn(regular);
    expect(session.authenticated()).toBe(true);
    expect(page.textContent).toContain('requires an administrator');
    expect(page.querySelector('#reload-users')).toBeNull();
    expect(page.querySelector('#next-users')).toBeNull();
    fixture.componentInstance.loadUsers();
    fixture.componentInstance.viewUser(regular.id);
    http.expectNone((req) => req.url.includes(USERS_ENDPOINT));
  });

  it.each([HttpStatusCode.Forbidden, HttpStatusCode.NotFound, HttpStatusCode.ServiceUnavailable])(
    'unexpected /me HTTP %s retains the bearer and reports unavailable',
    async (status) => {
      login().flush({ code: 'private-backend-detail' }, { status, statusText: 'Failure' });
      await fixture.whenStable();
      expect(session.authenticated()).toBe(true);
      expect(fixture.componentInstance.profileState()).toBe(UserReadState.Unavailable);
      expect(page.textContent).not.toContain('private-backend-detail');
      expect(page.querySelector('#reload-users')).toBeNull();
    },
  );

  it('network /me failure retains session, permits profile reload and does not claim invalid credentials', async () => {
    login().error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(page.textContent).toContain('profile is unavailable');
    expect(page.textContent).not.toContain('Invalid email or password');
    expect(session.authenticated()).toBe(true);
    page.querySelector<HTMLButtonElement>('#reload-profile')!.click();
    current().flush(admin, { headers });
    await fixture.whenStable();
    expect(fixture.componentInstance.administrator()).toBe(true);
  });

  it('malformed /me does not display partial identity or discard the bearer', async () => {
    login().flush({ ...admin, password: 'private-value' }, { headers });
    await fixture.whenStable();
    expect(fixture.componentInstance.profileState()).toBe(UserReadState.InvalidResponse);
    expect(fixture.componentInstance.currentUser()).toBeNull();
    expect(session.authenticated()).toBe(true);
    expect(page.textContent).not.toContain('private-value');
  });

  it.each([CURRENT_USER_ENDPOINT, USERS_ENDPOINT])(
    '401 from %s discards session, profile, list and detail',
    async (endpoint) => {
      await signedIn();
      await loaded();
      fixture.componentInstance.viewUser(regular.id);
      detail().flush(regular, { headers });
      if (endpoint === CURRENT_USER_ENDPOINT) {
        fixture.componentInstance.loadProfile();
        current().flush({}, { status: HttpStatusCode.Unauthorized, statusText: 'Unauthorized' });
      } else {
        fixture.componentInstance.viewUser(regular.id);
        detail().flush({}, { status: HttpStatusCode.Unauthorized, statusText: 'Unauthorized' });
      }
      await fixture.whenStable();
      expect(session.authenticated()).toBe(false);
      expect(fixture.componentInstance.currentUser()).toBeNull();
      expect(fixture.componentInstance.users()).toBeNull();
      expect(fixture.componentInstance.detailUser()).toBeNull();
      expect(page.textContent).toContain('Sign in again');
    },
  );

  it.each([
    [HttpStatusCode.Forbidden, UserReadState.Forbidden, 'requires an administrator'],
    [HttpStatusCode.NotFound, UserReadState.NotFound, 'User not found'],
    [HttpStatusCode.ServiceUnavailable, UserReadState.Unavailable, 'detail is unavailable'],
  ])('detail HTTP %s clears stale detail and retains session', async (status, state, message) => {
    await signedIn();
    await loaded();
    fixture.componentInstance.viewUser(regular.id);
    detail().flush(regular, { headers });
    fixture.componentInstance.viewUser(admin.id);
    expect(fixture.componentInstance.detailUser()).toBeNull();
    expect(fixture.componentInstance.detailState()).toBe(UserReadState.Loading);
    detail(admin.id).flush(
      { code: 'private-detail' },
      { status: status as number, statusText: 'Failure' },
    );
    await fixture.whenStable();
    expect(fixture.componentInstance.detailState()).toBe(state);
    expect(page.querySelector('#user-detail')!.textContent).toContain(message);
    expect(session.authenticated()).toBe(true);
    expect(page.textContent).not.toContain('private-detail');
  });

  it('malformed detail and transport failure never retain partial/old detail', async () => {
    await signedIn();
    await loaded();
    fixture.componentInstance.viewUser(regular.id);
    detail().flush({ ...regular, extra: true }, { headers });
    expect(fixture.componentInstance.detailState()).toBe(UserReadState.InvalidResponse);
    fixture.componentInstance.viewUser(regular.id);
    detail().error(new ProgressEvent('error'));
    expect(fixture.componentInstance.detailState()).toBe(UserReadState.Unavailable);
    expect(fixture.componentInstance.detailUser()).toBeNull();
    expect(session.authenticated()).toBe(true);
  });

  it('a new detail selection cancels the prior request and refuses its late response', async () => {
    await signedIn();
    await loaded();
    fixture.componentInstance.viewUser(regular.id);
    const old = detail();
    fixture.componentInstance.viewUser(admin.id);
    const next = detail(admin.id);
    expect(old.cancelled).toBe(true);
    expect(() => old.flush(regular, { headers })).toThrow('cancelled');
    expect(fixture.componentInstance.detailUser()).toBeNull();
    next.flush(admin, { headers });
    expect(fixture.componentInstance.detailUser()).toEqual(admin);
  });

  for (const operation of ['profile', 'detail'] as const) {
    it.each([
      ['switch', 'java'],
      ['clear', 'java'],
      ['destroy', 'java'],
      ['switch', 'dotnet'],
      ['clear', 'dotnet'],
      ['destroy', 'dotnet'],
    ])(
      `${operation} cancellation on %s from %s discards late responses`,
      async (action, backend) => {
        if (backend === 'dotnet') await switchBackend();
        let pending;
        if (operation === 'profile') pending = login();
        else {
          await signedIn();
          await loaded();
          fixture.componentInstance.viewUser(regular.id);
          pending = detail(regular.id, fixture.componentInstance.selection.selected().id);
        }
        if (action === 'switch') await switchBackend();
        else if (action === 'clear') fixture.componentInstance.clearSession();
        else fixture.destroy();
        expect(pending.cancelled).toBe(true);
        expect(() => pending.flush(regular, { headers })).toThrow('cancelled');
        if (action !== 'destroy') {
          expect(session.authenticated()).toBe(false);
          expect(fixture.componentInstance.currentUser()).toBeNull();
          expect(fixture.componentInstance.users()).toBeNull();
          expect(fixture.componentInstance.detailUser()).toBeNull();
        }
      },
    );
  }
  it('Clear session discards a loaded profile, collection and selected detail', async () => {
    await signedIn();
    await loaded();
    fixture.componentInstance.viewUser(regular.id);
    detail().flush(regular, { headers });
    await fixture.whenStable();
    fixture.componentInstance.clearSession();
    await fixture.whenStable();
    expect(session.authenticated()).toBe(false);
    expect(fixture.componentInstance.currentUser()).toBeNull();
    expect(fixture.componentInstance.users()).toBeNull();
    expect(fixture.componentInstance.detailUser()).toBeNull();
    expect(fixture.componentInstance.selectedUserId()).toBeNull();
    expect(page.textContent).not.toContain(regular.email);
    expect(page.textContent).not.toContain(admin.email);
  });

  it('detail 401 also cancels an outstanding collection request', async () => {
    await signedIn();
    fixture.componentInstance.loadUsers();
    const collection = http.expectOne(
      `/backends/java${USERS_ENDPOINT}?offset=0&limit=${USERS_PAGE_SIZE}`,
    );
    fixture.componentInstance.viewUser(regular.id);
    detail().flush({}, { status: HttpStatusCode.Unauthorized, statusText: 'Unauthorized' });
    expect(collection.cancelled).toBe(true);
    expect(session.authenticated()).toBe(false);
    expect(fixture.componentInstance.currentUser()).toBeNull();
    expect(fixture.componentInstance.users()).toBeNull();
  });
  it('a generic API 401 clears existing protected feature data through the shared session boundary', async () => {
    await signedIn();
    await loaded();
    expect(fixture.componentInstance.users()?.items.length).toBe(1);
    TestBed.inject(RuntimeClient)
      .get('catalogue', 'one')
      .subscribe({ error: () => {} });
    http
      .expectOne('/backends/java' + RESOURCE_PROTOCOL.records + '/catalogue/one')
      .flush('{"code":"unauthorized","errors":[{"code":"unauthorized"}]}', {
        status: HttpStatusCode.Unauthorized,
        statusText: 'Unauthorized',
        headers,
      });
    await fixture.whenStable();
    expect(session.authenticated()).toBe(false);
    expect(fixture.componentInstance.currentUser()).toBe(null);
    expect(fixture.componentInstance.users()).toBe(null);
    expect(page.querySelector('table')).toBe(null);
  });
});
