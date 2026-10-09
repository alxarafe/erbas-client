import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthSession } from './auth-session';

describe('Application login', () => {
  let fixture: ComponentFixture<App>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: AuthSession;
  let email: HTMLInputElement;
  let password: HTMLInputElement;
  const token = 'opaque-test-token';
  const secret = ' fictitious-password\t ';

  const health = (backend: string) => {
    const request = http.expectOne(`/backends/${backend}/health`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ status: 'ok' }, { headers: { 'Content-Type': 'application/json' } });
  };
  const submit = () => {
    email.value = 'User@example.test';
    password.value = secret;
    const event = new Event('submit', { bubbles: true, cancelable: true });
    page.querySelector('form')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  };
  const changeBackend = async (backend: string) => {
    const select = page.querySelector('select')!;
    select.value = backend;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    health(backend);
    await fixture.whenStable();
  };
  const succeed = (backend = 'java') => {
    http
      .expectOne(`/backends/${backend}/api/auth/login`)
      .flush({ accessToken: token }, { headers: { 'Content-Type': 'application/json' } });
  };

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    page = fixture.nativeElement as HTMLElement;
    email = page.querySelector('#email')!;
    password = page.querySelector('#password')!;
    health('java');
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  it('signs in to Java, renders its authenticated state and clears the password', async () => {
    submit();
    const request = http.expectOne('/backends/java/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'User@example.test', password: secret });
    request.flush({ accessToken: token }, { headers: { 'Content-Type': 'application/json' } });
    await fixture.whenStable();
    expect(session.tokenFor('java')).toBe(token);
    expect(session.tokenFor('dotnet')).toBeNull();
    expect(page.textContent).toContain('Authenticated · ERBAS Java / Spring Boot');
    expect(page.textContent).not.toContain(token);
    expect(page.textContent).not.toContain(secret);
    expect(password.value).toBe('');
    expect(email.value).toBe('User@example.test');
    expect(page.textContent).toContain('ONLINE');
    fixture.componentInstance.check();
    health('java');
  });

  it('uses the selected .NET route and binds the token to .NET', async () => {
    await changeBackend('dotnet');
    submit();
    succeed('dotnet');
    await fixture.whenStable();
    expect(session.tokenFor('dotnet')).toBe(token);
    expect(session.tokenFor('java')).toBeNull();
    expect(page.textContent).toContain('Authenticated · Alxarafe.NET / ASP.NET Core');
  });

  it.each([
    [400, 'invalid_request', 'The login request is invalid.'],
    [401, 'invalid_credentials', 'Invalid email or password.'],
    [503, 'private-server-detail', 'Authentication service unavailable.'],
  ])(
    'shows safe feedback for HTTP %s without creating a session',
    async (status, code, message) => {
      submit();
      http
        .expectOne('/backends/java/api/auth/login')
        .flush({ code }, { status, statusText: 'Failure' });
      await fixture.whenStable();
      expect(page.textContent).toContain(message);
      expect(page.textContent).not.toContain(code);
      expect(session.authenticated()).toBe(false);
      if (status === 401) expect(password.value).toBe('');
      expect(email.value).toBe('User@example.test');
    },
  );

  it('reports network failure as unavailable and permits retry', async () => {
    submit();
    http.expectOne('/backends/java/api/auth/login').error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(page.textContent).toContain('Authentication service unavailable.');
    expect(session.authenticated()).toBe(false);
    submit();
    succeed();
    await fixture.whenStable();
    expect(session.tokenFor('java')).toBe(token);
  });

  it('reports invalid success responses without revealing their contents', async () => {
    submit();
    http
      .expectOne('/backends/java/api/auth/login')
      .flush(
        { accessToken: token, refreshToken: 'private-response-detail' },
        { headers: { 'Content-Type': 'application/json' } },
      );
    await fixture.whenStable();
    expect(page.textContent).toContain('The backend returned an invalid login response.');
    expect(page.textContent).not.toContain(token);
    expect(page.textContent).not.toContain('private-response-detail');
    expect(session.authenticated()).toBe(false);
  });

  it('clears an authenticated session on backend change, including when returning to Java', async () => {
    submit();
    succeed();
    await fixture.whenStable();
    await changeBackend('dotnet');
    expect(session.tokenFor('java')).toBeNull();
    expect(session.tokenFor('dotnet')).toBeNull();
    expect(page.textContent).toContain('Enter your credentials to sign in.');
    expect(page.textContent).not.toContain('Authenticated');
    await changeBackend('java');
    expect(session.authenticated()).toBe(false);
  });

  it('cancels pending Java login before a late response can authenticate .NET', async () => {
    submit();
    const pending = http.expectOne('/backends/java/api/auth/login');
    await changeBackend('dotnet');
    expect(pending.cancelled).toBe(true);
    expect(() => pending.flush({ accessToken: token })).toThrow('cancelled');
    expect(session.authenticated()).toBe(false);
    expect(session.tokenFor('java')).toBeNull();
    expect(session.tokenFor('dotnet')).toBeNull();
    expect(page.textContent).toContain('Enter your credentials to sign in.');
    submit();
    succeed('dotnet');
    await fixture.whenStable();
    expect(session.tokenFor('dotnet')).toBe(token);
  });

  it('clears the session locally without making an HTTP request', async () => {
    submit();
    succeed();
    await fixture.whenStable();
    const clear = [...page.querySelectorAll('button')].find(
      (button) => button.textContent === 'Clear session',
    )!;
    clear.click();
    await fixture.whenStable();
    expect(session.authenticated()).toBe(false);
    expect(session.tokenFor('java')).toBeNull();
    expect(page.textContent).toContain('Enter your credentials to sign in.');
    http.expectNone(() => true);
  });

  it('labels the inputs, announces feedback and disables submit while pending', async () => {
    expect(page.querySelector('label[for="email"]')?.textContent).toBe('Email');
    expect(page.querySelector('label[for="password"]')?.textContent).toBe('Password');
    expect(password.type).toBe('password');
    expect(email.autocomplete).toBe('username');
    expect(password.autocomplete).toBe('current-password');
    submit();
    await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
    expect(page.querySelector('.authentication [aria-live="polite"]')?.textContent).toContain(
      'Signing in',
    );
    succeed();
    await fixture.whenStable();
    expect(page.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
  });

  it('cancels a previous pending login when another submit occurs', () => {
    submit();
    const previous = http.expectOne('/backends/java/api/auth/login');
    submit();
    expect(previous.cancelled).toBe(true);
    succeed();
    expect(session.tokenFor('java')).toBe(token);
  });

  it('cancels pending login when the application is destroyed', () => {
    submit();
    const pending = http.expectOne('/backends/java/api/auth/login');
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
    expect(session.authenticated()).toBe(false);
  });

  it('sends input values without adding email-format or normalization rules', () => {
    email.value = 'not-an-email';
    password.value = secret;
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    const request = http.expectOne('/backends/java/api/auth/login');
    expect(request.request.body).toEqual({ email: 'not-an-email', password: secret });
    request.flush({ code: 'invalid_credentials' }, { status: 401, statusText: 'Unauthorized' });
  });
});
