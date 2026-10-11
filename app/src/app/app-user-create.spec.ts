import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthSession } from './auth-session';
import {
  CURRENT_USER_ENDPOINT,
  USERS_ENDPOINT,
  USERS_PAGE_SIZE,
  USER_HTTP,
  USER_CREATE_ERRORS,
  USER_PASSWORD_LENGTH,
} from './users-client';
import { UserCreateState } from './user-create-state';

describe('Administrator user creation UI', () => {
  let fixture: ComponentFixture<App>,
    page: HTMLElement,
    http: HttpTestingController,
    session: AuthSession;
  const bearer = 'fixture-bearer';
  const admin = { id: 'opaque-admin', email: 'fixture-admin', enabled: true, admin: true };
  const newUser = {
    id: 'opaque-created',
    email: ' Unmodified@Example.test ',
    enabled: true,
    admin: false,
  };
  const password = ' 😀e\u0301 whitespace password ';
  const headers = {
    [USER_HTTP.contentType]: USER_HTTP.json,
    [USER_HTTP.cacheControl]: USER_HTTP.noStore,
  };
  const base = () => fixture.componentInstance.selection.selected().proxyBaseUrl;
  const input = (name: string) => page.querySelector<HTMLInputElement>(`#create-${name}`)!;
  const post = () => http.expectOne(base() + USERS_ENDPOINT);
  const login = () => {
    page.querySelector<HTMLInputElement>('#email')!.value = admin.email;
    page.querySelector<HTMLInputElement>('#password')!.value = 'fixture-login-password';
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectOne(base() + '/api/auth/login').flush({ accessToken: bearer }, { headers });
    return http.expectOne(base() + CURRENT_USER_ENDPOINT);
  };
  const signedIn = async (isAdmin = true) => {
    login().flush({ ...admin, admin: isAdmin }, { headers });
    await fixture.whenStable();
  };
  const submit = (secret = password, isAdmin = false) => {
    input('email').value = newUser.email;
    input('password').value = secret;
    input('admin').checked = isAdmin;
    page.querySelector('#create-user')!.dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const success = (request: ReturnType<typeof post>, isAdmin = false) =>
    request.flush(
      { ...newUser, admin: isAdmin },
      { status: HttpStatusCode.Created, statusText: 'Created', headers },
    );
  const switchBackend = async () => {
    const select = page.querySelector<HTMLSelectElement>('#backend')!;
    select.value = fixture.componentInstance.selection.selected().id === 'java' ? 'dotnet' : 'java';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    http.expectOne(base() + '/health').flush({ status: 'ok' }, { headers });
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
    http
      .expectOne('/demo/defaults.env')
      .flush('', { status: HttpStatusCode.NotFound, statusText: 'Not Found' });
    http.expectOne(base() + '/health').flush({ status: 'ok' }, { headers });
    await fixture.whenStable();
  });
  afterEach(() => http.verify());
  it('hides creation without session, while profile loads and for a regular user', async () => {
    expect(page.querySelector('#create-user')).toBeNull();
    const profile = login();
    await fixture.whenStable();
    expect(page.querySelector('#create-user')).toBeNull();
    profile.flush({ ...admin, admin: false }, { headers });
    await fixture.whenStable();
    expect(session.authenticated()).toBe(true);
    expect(page.querySelector('#create-user')).toBeNull();
  });
  it.each(['java', 'dotnet'])(
    'creates against %s with unchanged input and no persistence',
    async (backend) => {
      if (backend === 'dotnet') await switchBackend();
      await signedIn();
      expect(input('admin').checked).toBe(false);
      expect(input('password').autocomplete).toBe('new-password');
      expect(page.querySelector<HTMLFormElement>('#create-user')!.noValidate).toBe(true);
      submit();
      const req = post();
      expect(req.request.body).toEqual({ email: newUser.email, password, admin: false });
      expect(req.request.headers.get(USER_HTTP.authorization)).toBe(
        `${USER_HTTP.bearer} ${bearer}`,
      );
      await fixture.whenStable();
      expect(page.querySelector<HTMLButtonElement>('#create-user button')!.disabled).toBe(true);
      expect(page.querySelector('#create-user')!.getAttribute('aria-busy')).toBe('true');
      success(req);
      await fixture.whenStable();
      expect(page.querySelector('#created-user')!.textContent).toContain(newUser.email);
      expect(fixture.componentInstance.createdUser()).toEqual(newUser);
      expect(input('email').value).toBe('');
      expect(input('password').value).toBe('');
      expect(input('admin').checked).toBe(false);
      expect(page.textContent).not.toContain(password);
      expect(page.textContent).not.toContain(bearer);
      expect(Object.values(localStorage)).not.toContain(bearer);
      expect(Object.values(localStorage)).not.toContain(password);
      expect(sessionStorage.length).toBe(0);
      expect(document.cookie).not.toContain(bearer);
      http.expectNone((req) => req.url.includes(USERS_ENDPOINT));
    },
  );
  it('preserves arbitrary nonempty email syntax and sends admin=true', async () => {
    await signedIn();
    submit(password, true);
    input('email').value = 'not-an-email';
    page.querySelector('#create-user')!.dispatchEvent(new Event('submit', { cancelable: true }));
    // Replacement cancels the first observation; the new request has the current input.
    const requests = http.match(base() + USERS_ENDPOINT);
    expect(requests[0].cancelled).toBe(true);
    expect(requests[1].request.body).toEqual({ email: 'not-an-email', password, admin: true });
    requests[1].flush(
      { ...newUser, email: 'not-an-email', admin: true },
      { status: HttpStatusCode.Created, statusText: 'Created', headers },
    );
    expect(input('admin').checked).toBe(false);
  });
  it.each([
    [USER_PASSWORD_LENGTH.minimum - 1, false],
    [USER_PASSWORD_LENGTH.minimum, true],
    [USER_PASSWORD_LENGTH.maximum, true],
    [USER_PASSWORD_LENGTH.maximum + 1, false],
  ])('Unicode password boundary %s is valid=%s', async (length, valid) => {
    await signedIn();
    const secret = '😀'.repeat(length as number);
    submit(secret);
    if (valid) {
      success(post());
      expect(input('password').value).toBe('');
    } else {
      http.expectNone(base() + USERS_ENDPOINT);
      expect(fixture.componentInstance.createState()).toBe(UserCreateState.InvalidRequest);
      expect(input('password').value).toBe(secret);
    }
  });
  it('rejects empty email locally without discarding the editable password', async () => {
    await signedIn();
    input('password').value = password;
    page.querySelector('#create-user')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http.expectNone(base() + USERS_ENDPOINT);
    expect(input('password').value).toBe(password);
    expect(fixture.componentInstance.createState()).toBe(UserCreateState.InvalidRequest);
  });
  it.each([
    [HttpStatusCode.BadRequest, UserCreateState.InvalidRequest],
    [HttpStatusCode.Forbidden, UserCreateState.Forbidden],
    [HttpStatusCode.Conflict, UserCreateState.EmailConflict],
  ] as const)(
    'contractual %s clears password and preserves identity/email/admin',
    async (status, state) => {
      await signedIn();
      submit(password, true);
      post().flush({ code: USER_CREATE_ERRORS[status] }, { status, statusText: 'Denied', headers });
      await fixture.whenStable();
      expect(fixture.componentInstance.createState()).toBe(state);
      expect(session.authenticated()).toBe(true);
      expect(fixture.componentInstance.currentUser()).toEqual(admin);
      expect(input('password').value).toBe('');
      expect(input('email').value).toBe(newUser.email);
      expect(input('admin').checked).toBe(true);
      expect(fixture.componentInstance.createdUser()).toBeNull();
      if (status === HttpStatusCode.Conflict)
        expect(page.textContent).toContain('email already exists');
      if (status === HttpStatusCode.Forbidden)
        expect(page.textContent).toContain('requires an administrator');
    },
  );
  it('validated 401 clears session/profile/list/detail/create and hides the form', async () => {
    await signedIn();
    fixture.componentInstance.loadUsers();
    http.expectOne(`${base()}${USERS_ENDPOINT}?offset=0&limit=${USERS_PAGE_SIZE}`).flush(
      {
        items: [admin],
        offset: 0,
        limit: USERS_PAGE_SIZE,
        total: 1,
        order: [{ field: 'id', direction: 'asc' }],
      },
      { headers },
    );
    fixture.componentInstance.viewUser(admin.id);
    http.expectOne(base() + USERS_ENDPOINT + '/' + admin.id).flush(admin, { headers });
    submit();
    post().flush(
      { code: USER_CREATE_ERRORS[HttpStatusCode.Unauthorized] },
      {
        status: HttpStatusCode.Unauthorized,
        statusText: 'Unauthorized',
        headers: { ...headers, [USER_HTTP.challenge]: USER_HTTP.bearer },
      },
    );
    await fixture.whenStable();
    expect(session.authenticated()).toBe(false);
    expect(fixture.componentInstance.currentUser()).toBeNull();
    expect(fixture.componentInstance.users()).toBeNull();
    expect(fixture.componentInstance.detailUser()).toBeNull();
    expect(fixture.componentInstance.createdUser()).toBeNull();
    expect(page.querySelector('#create-user')).toBeNull();
    expect(page.textContent).toContain('session is no longer usable');
  });
  it.each(['network', 'unexpected', 'malformed-success', 'malformed-error'])(
    'handles %s without discarding the session',
    async (fault) => {
      await signedIn();
      submit();
      const req = post();
      if (fault === 'network') req.error(new ProgressEvent('error'));
      else if (fault === 'unexpected')
        req.flush({}, { status: HttpStatusCode.NotFound, statusText: 'Not Found', headers });
      else if (fault === 'malformed-success')
        req.flush(
          { ...newUser, password },
          { status: HttpStatusCode.Created, statusText: 'Created', headers },
        );
      else
        req.flush(
          { code: 'unexpected' },
          { status: HttpStatusCode.Unauthorized, statusText: 'Unauthorized', headers },
        );
      expect(input('password').value).toBe('');
      expect(session.authenticated()).toBe(true);
      expect(fixture.componentInstance.createState()).toBe(
        fault.startsWith('malformed')
          ? UserCreateState.InvalidResponse
          : UserCreateState.Unavailable,
      );
      expect(fixture.componentInstance.createdUser()).toBeNull();
    },
  );
  it('new creation clears the prior result while submitting', async () => {
    await signedIn();
    submit();
    success(post());
    await fixture.whenStable();
    submit();
    expect(fixture.componentInstance.createdUser()).toBeNull();
    expect(fixture.componentInstance.createState()).toBe(UserCreateState.Submitting);
    success(post());
  });
  it.each(['switch', 'clear', 'replacement-login', 'profile-reload', 'destroy'])(
    '%s cancels creation and prevents stale response acceptance',
    async (action) => {
      await signedIn();
      submit();
      const pending = post();
      const pendingPassword = input('password');
      if (action === 'switch') await switchBackend();
      else if (action === 'clear') fixture.componentInstance.clearSession();
      else if (action === 'replacement-login') login().flush(admin, { headers });
      else if (action === 'profile-reload') {
        fixture.componentInstance.loadProfile();
        http.expectOne(base() + CURRENT_USER_ENDPOINT).flush(admin, { headers });
      } else fixture.destroy();
      expect(pending.cancelled).toBe(true);
      expect(pendingPassword.value).toBe('');
      expect(() => success(pending)).toThrow('cancelled');
      expect(fixture.componentInstance.createdUser()).toBeNull();
      if (action !== 'destroy')
        expect(fixture.componentInstance.createState()).toBe(UserCreateState.Idle);
    },
  );
  it('reloads the previously loaded offset from the server without optimistic insertion', async () => {
    await signedIn();
    const offset = USERS_PAGE_SIZE;
    fixture.componentInstance.loadUsers(offset);
    const collection = {
      items: [admin],
      offset,
      limit: USERS_PAGE_SIZE,
      total: offset + 1,
      order: [{ field: 'id', direction: 'asc' }],
    };
    http
      .expectOne(`${base()}${USERS_ENDPOINT}?offset=${offset}&limit=${USERS_PAGE_SIZE}`)
      .flush(collection, { headers });
    submit();
    success(post());
    const reload = http.expectOne(
      `${base()}${USERS_ENDPOINT}?offset=${offset}&limit=${USERS_PAGE_SIZE}`,
    );
    expect(fixture.componentInstance.users()).toBeNull();
    expect(fixture.componentInstance.createdUser()).toEqual(newUser);
    reload.flush({ ...collection, items: [admin, newUser], total: offset + 2 }, { headers });
    expect(fixture.componentInstance.users()!.total).toBe(offset + 2);
  });
  it('409 leaves loaded collection/detail unchanged and does not reload', async () => {
    await signedIn();
    fixture.componentInstance.loadUsers();
    const collection = {
      items: [admin],
      offset: 0,
      limit: USERS_PAGE_SIZE,
      total: 1,
      order: [{ field: 'id', direction: 'asc' }],
    };
    http
      .expectOne(`${base()}${USERS_ENDPOINT}?offset=0&limit=${USERS_PAGE_SIZE}`)
      .flush(collection, { headers });
    fixture.componentInstance.viewUser(admin.id);
    http.expectOne(base() + USERS_ENDPOINT + '/' + admin.id).flush(admin, { headers });
    submit();
    post().flush(
      { code: USER_CREATE_ERRORS[HttpStatusCode.Conflict] },
      { status: HttpStatusCode.Conflict, statusText: 'Conflict', headers },
    );
    expect(fixture.componentInstance.users()).toEqual(collection);
    expect(fixture.componentInstance.detailUser()).toEqual(admin);
    http.expectNone((req) => req.url.includes(USERS_ENDPOINT));
  });
});
