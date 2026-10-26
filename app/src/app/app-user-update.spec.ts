import { finishLegacyNavigation, isNavigationRequest } from './resource-runtime/runtime-fixtures';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './resource-runtime/resource-routing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import {
  CURRENT_USER_ENDPOINT,
  USERS_ENDPOINT,
  USERS_PAGE_SIZE,
  USER_HTTP,
  USER_UPDATE_ERRORS,
} from './users-client';
import { UserUpdateState } from './user-update-state';

describe('Administrator user update UI', () => {
  let fixture: ComponentFixture<App>, page: HTMLElement, http: HttpTestingController;
  const admin = {
    id: 'admin',
    email: 'admin-fixture',
    enabled: true,
    admin: true,
  };
  const target = {
    id: 'opaque /?#% user',
    email: 'target-fixture',
    enabled: true,
    admin: false,
  };
  const headers = {
    [USER_HTTP.contentType]: USER_HTTP.json,
    [USER_HTTP.cacheControl]: USER_HTTP.noStore,
  };
  const app = () => fixture.componentInstance;
  const base = () => app().selection.selected().proxyBaseUrl;
  const detail = (id = target.id) =>
    http.expectOne(base() + USERS_ENDPOINT + '/' + encodeURIComponent(id));
  const input = (name: string) => page.querySelector<HTMLInputElement>(`#update-${name}`)!;
  const change = (name: string, value: boolean) => {
    input(name).checked = value;
    input(name).dispatchEvent(new Event('change'));
  };
  const submit = () =>
    page.querySelector('#update-user')!.dispatchEvent(new Event('submit', { cancelable: true }));
  const login = () => {
    page.querySelector<HTMLInputElement>('#email')!.value = admin.email;
    page.querySelector<HTMLInputElement>('#password')!.value = 'fixture-secret';
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http
      .expectOne(base() + '/api/auth/login')
      .flush({ accessToken: 'fixture-bearer' }, { headers });
    return http.expectOne(base() + CURRENT_USER_ENDPOINT);
  };
  const load = async (user = target) => {
    login().flush(admin, { headers });
    app().loadUsers();
    http.expectOne(`${base()}${USERS_ENDPOINT}?offset=0&limit=${USERS_PAGE_SIZE}`).flush(
      {
        items: [admin, target],
        offset: 0,
        limit: USERS_PAGE_SIZE,
        total: 2,
        order: [{ field: 'id', direction: 'asc' }],
      },
      { headers },
    );
    app().viewUser(user.id);
    detail(user.id).flush(user, { headers });
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
    fixture = TestBed.createComponent(App);
    page = fixture.nativeElement;
    await fixture.whenStable();
    http
      .expectOne('/demo/defaults.env')
      .flush('', { status: HttpStatusCode.NotFound, statusText: 'Not Found' });
    http.expectOne(base() + '/health').flush({ status: 'ok' }, { headers });
    await fixture.whenStable();
  });
  afterEach(() => {
    finishLegacyNavigation(http);
    http.verify();
  });
  it('offers editing only to loaded administrators with detail; identity is informational', async () => {
    expect(page.querySelector('#update-user')).toBeNull();
    login().flush({ ...admin, admin: false }, { headers });
    await fixture.whenStable();
    expect(page.querySelector('#update-user')).toBeNull();
    await load();
    expect(input('enabled').checked).toBe(target.enabled);
    expect(input('admin').checked).toBe(target.admin);
    expect(page.querySelectorAll('#update-user input').length).toBe(2);
    expect(page.querySelector('#user-detail')!.textContent).toContain(target.email);
    expect(page.querySelector('#user-detail')!.textContent).toContain(target.id);
    expect(
      page.querySelector(
        '#user-detail input[type="text"], #user-detail input[type="email"], #user-detail input[type="password"]',
      ),
    ).toBeNull();
  });
  it('no changes sends no HTTP and reports a local state', async () => {
    await load();
    submit();
    http.expectNone((request) => !isNavigationRequest(request));
    expect(app().updateState()).toBe(UserUpdateState.NoChanges);
  });
  it.each(['enabled', 'admin', 'both'])(
    'sends only changed fields: %s and uses server response',
    async (mode) => {
      await load();
      const before = app().users()!;
      if (mode !== 'admin') change('enabled', false);
      if (mode !== 'enabled') change('admin', true);
      submit();
      const req = detail();
      const body = {
        ...(mode !== 'admin' ? { enabled: false } : {}),
        ...(mode !== 'enabled' ? { admin: true } : {}),
      };
      expect(req.request.body).toEqual(body);
      const updated = { ...target, ...body, email: 'server-returned-email' };
      req.flush(updated, { headers });
      expect(app().detailUser()).toEqual(updated);
      expect(app().users()).toEqual({ ...before, items: [admin, updated] });
      expect(app().currentUser()).toEqual(admin);
      expect(app().updateState()).toBe(UserUpdateState.Updated);
      http.expectNone((request) => !isNavigationRequest(request));
    },
  );
  it('never inserts a user outside the loaded window', async () => {
    await load({ ...target, id: 'not-in-window' });
    const before = app().users();
    change('enabled', false);
    submit();
    detail('not-in-window').flush({ ...target, id: 'not-in-window', enabled: false }, { headers });
    expect(app().users()).toEqual(before);
  });
  it.each([
    [HttpStatusCode.BadRequest, UserUpdateState.InvalidRequest],
    [HttpStatusCode.Unauthorized, UserUpdateState.Unauthorized],
    [HttpStatusCode.Forbidden, UserUpdateState.Forbidden],
    [HttpStatusCode.NotFound, UserUpdateState.NotFound],
    [HttpStatusCode.Conflict, UserUpdateState.LastAdmin],
  ] as const)('handles validated %s as %s', async (status, state) => {
    await load();
    const before = app().users();
    change('enabled', false);
    submit();
    detail().flush(
      { code: USER_UPDATE_ERRORS[status] },
      {
        status,
        statusText: 'Denied',
        headers:
          status === HttpStatusCode.Unauthorized
            ? { ...headers, [USER_HTTP.challenge]: USER_HTTP.bearer }
            : headers,
      },
    );
    await fixture.whenStable();
    expect(app().updateState()).toBe(state);
    expect(app().authenticated()).toBe(status !== HttpStatusCode.Unauthorized);
    if (status === HttpStatusCode.Unauthorized) {
      expect(app().users()).toBeNull();
      expect(app().currentUser()).toBeNull();
      expect(app().detailUser()).toBeNull();
    } else {
      expect(app().users()).toEqual(before);
      expect(app().detailUser()).toEqual(status === HttpStatusCode.NotFound ? null : target);
      if (status !== HttpStatusCode.NotFound) expect(input('enabled').checked).toBe(false);
    }
    if (status === HttpStatusCode.Conflict)
      expect(page.textContent).toContain('without an enabled administrator');
  });
  it.each(['success', 'error', 'transport', 'unexpected'])(
    'handles %s failure without mutating existing data',
    async (fault) => {
      await load();
      change('enabled', false);
      submit();
      const req = detail();
      if (fault === 'success') req.flush(target, { headers });
      else if (fault === 'error')
        req.flush(
          { code: 'wrong' },
          {
            headers,
            status: HttpStatusCode.Unauthorized,
            statusText: 'Denied',
          },
        );
      else if (fault === 'transport') req.error(new ProgressEvent('error'));
      else
        req.flush(
          {},
          {
            status: HttpStatusCode.ServiceUnavailable,
            statusText: 'Unavailable',
          },
        );
      expect(app().updateState()).toBe(
        fault === 'success' || fault === 'error'
          ? UserUpdateState.InvalidResponse
          : UserUpdateState.Unavailable,
      );
      expect(app().detailUser()).toEqual(target);
      expect(app().authenticated()).toBe(true);
    },
  );
  it.each(['disable', 'demote'])('self-update %s accepts backend authority', async (mode) => {
    await load(admin);
    const bearer = app().session.tokenFor(app().selection.selected().id);
    if (mode === 'disable') change('enabled', false);
    else change('admin', false);
    submit();
    const updated = {
      ...admin,
      enabled: mode !== 'disable',
      admin: mode !== 'demote',
    };
    detail(admin.id).flush(updated, { headers });
    await fixture.whenStable();
    expect(app().authenticated()).toBe(mode !== 'disable');
    expect(app().users()).toBeNull();
    expect(app().detailUser()).toBeNull();
    expect(app().createdUser()).toBeNull();
    expect(page.querySelector('#update-user')).toBeNull();
    expect(page.querySelector('#create-user')).toBeNull();
    if (mode === 'demote') {
      expect(app().currentUser()).toEqual(updated);
      expect(app().session.tokenFor(app().selection.selected().id)).toBe(bearer);
    } else expect(app().currentUser()).toBeNull();
  });
  it('updates current profile when a self response remains an enabled admin', async () => {
    await load({ ...admin, admin: false });
    change('admin', true);
    submit();
    const updated = { ...admin, email: 'server-current-email' };
    detail(admin.id).flush(updated, { headers });
    expect(app().currentUser()).toEqual(updated);
    expect(app().authenticated()).toBe(true);
    expect(app().detailUser()).toEqual(updated);
    expect(app().updateState()).toBe(UserUpdateState.Updated);
  });
  it.each(['switch', 'clear', 'login', 'profile', 'list', 'selection', 'replacement', 'destroy'])(
    '%s cancels observation and rejects stale response',
    async (action) => {
      await load();
      change('enabled', false);
      submit();
      const pending = detail();
      if (action === 'switch') {
        const select = page.querySelector<HTMLSelectElement>('#backend')!;
        select.value = 'dotnet';
        select.dispatchEvent(new Event('change'));
        await fixture.whenStable();
        http.expectOne(base() + '/health').flush({ status: 'ok' }, { headers });
      } else if (action === 'clear') app().clearSession();
      else if (action === 'login') login().flush(admin, { headers });
      else if (action === 'profile') {
        app().loadProfile();
        http.expectOne(base() + CURRENT_USER_ENDPOINT).flush(admin, { headers });
      } else if (action === 'list') {
        app().loadUsers();
        http.expectOne(`${base()}${USERS_ENDPOINT}?offset=0&limit=${USERS_PAGE_SIZE}`).flush(
          {
            items: [],
            offset: 0,
            limit: USERS_PAGE_SIZE,
            total: 0,
            order: [{ field: 'id', direction: 'asc' }],
          },
          { headers },
        );
      } else if (action === 'selection') {
        app().viewUser(admin.id);
        detail(admin.id).flush(admin, { headers });
      } else if (action === 'replacement') {
        change('admin', true);
        submit();
        detail().flush({ ...target, enabled: false, admin: true }, { headers });
      } else fixture.destroy();
      expect(pending.cancelled).toBe(true);
      expect(() => pending.flush({ ...target, enabled: false }, { headers })).toThrow('cancelled');
      if (action === 'selection') expect(app().detailUser()).toEqual(admin);
      if (action === 'replacement') expect(app().detailUser()?.admin).toBe(true);
    },
  );
});
