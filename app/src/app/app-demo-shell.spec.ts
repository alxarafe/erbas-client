import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { APP_ROUTES } from './resource-runtime/resource-routing';
import { fixtureNavigation, TEST_ETAG } from './resource-runtime/runtime-fixtures';
import { RESOURCE_PROTOCOL as P } from './resource-runtime/models';
import { CURRENT_USER_ENDPOINT, USER_HTTP } from './users-client';
import { AI_ASSISTANT_ENDPOINT } from './ai-assistant-client';
import { AiAssistantState } from './ai-assistant-state';
const headers = {
  [USER_HTTP.contentType]: USER_HTTP.json,
  [USER_HTTP.cacheControl]: USER_HTTP.noStore,
};
const profile = { id: 'demo-user', email: 'demo@example.test', enabled: true, admin: false };
describe('CLIENT-DEMO-001 application composition', () => {
  let fixture: ComponentFixture<App>, page: HTMLElement, http: HttpTestingController;
  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(APP_ROUTES), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(App);
    page = fixture.nativeElement;
    await fixture.whenStable();
    http.expectOne('/demo/defaults.env').flush('', { status: 404, statusText: 'Not Found' });
    http.expectOne('/backends/java/health').flush({ status: 'ok' }, { headers });
    await fixture.whenStable();
  });
  afterEach(() => http.verify());
  async function login() {
    page.querySelector<HTMLInputElement>('#email')!.value = profile.email;
    page.querySelector<HTMLInputElement>('#password')!.value = 'test-password';
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http
      .expectOne('/backends/java/api/auth/login')
      .flush({ accessToken: 'demo-token' }, { headers });
    http.expectOne('/backends/java' + CURRENT_USER_ENDPOINT).flush(profile, { headers });
    await fixture.whenStable();
    http
      .expectOne('/backends/java' + P.navigation)
      .flush(JSON.stringify(fixtureNavigation), { headers: { ...headers, ETag: TEST_ETAG } });
    await fixture.whenStable();
  }
  it('presents login alone and keeps backend diagnostics inside closed connection options', () => {
    expect(page.querySelector('.login-shell .shell-heading h1')?.textContent).toBe('ERBAS');
    expect(page.querySelector('.login-shell main .authentication')).not.toBeNull();
    expect(page.querySelector('#email')).not.toBeNull();
    expect(page.querySelector('#workspace')).toBeNull();
    expect(page.querySelector('#open-assistant')).toBeNull();
    expect(page.querySelector('.users')).toBeNull();
    const options = page.querySelector<HTMLDetailsElement>('.technical-tools')!;
    expect(options.open).toBe(false);
    expect(options.querySelector('#backend')).not.toBeNull();
    expect(options.querySelector('.health')).not.toBeNull();
    http.expectNone((request) => request.url.includes('/api/'));
  });
  it('renders the real effective navigation, identity and restricted shell with secondary tools', async () => {
    await login();
    expect(page.querySelector('.application-shell .shell-heading .identity')).not.toBeNull();
    expect(page.querySelector('.application-shell main #workspace')).not.toBeNull();
    expect(page.querySelector('#email')).toBeNull();
    expect(page.querySelector('.identity')?.textContent).toBe(profile.email);
    expect(page.querySelector('.shell-navigation')?.textContent).toContain('Register');
    expect(page.querySelector('.shell-navigation a')?.getAttribute('href')).toContain(
      '/resources/',
    );
    expect(page.querySelector('#create-user')).toBeNull();
    expect(page.querySelector<HTMLDetailsElement>('.administration-tools')!.open).toBe(false);
    expect(page.querySelector<HTMLDetailsElement>('.technical-tools')!.open).toBe(false);
    expect(page.querySelector('#workspace .health')).toBeNull();
  });
  it('opens and closes the nonmodal assistant with announced errors and retains the draft', async () => {
    await login();
    const button = page.querySelector<HTMLButtonElement>('#open-assistant')!;
    button.click();
    await fixture.whenStable();
    const panel = page.querySelector<HTMLElement>('#assistant-panel')!;
    expect(panel.hidden).toBe(false);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const message = page.querySelector<HTMLTextAreaElement>('#assistant-message')!;
    message.value = 'A real request';
    page.querySelector('#assistant-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(page.querySelector('#assistant-result')?.getAttribute('aria-busy')).toBe('true');
    http
      .expectOne('/backends/java' + AI_ASSISTANT_ENDPOINT)
      .flush(
        { code: 'module_disabled', errors: [{ code: 'module_disabled' }] },
        { status: 503, statusText: 'Unavailable', headers },
      );
    await fixture.whenStable();
    expect(page.querySelector('#assistant-result')?.textContent).toContain('disabled');
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();
    expect(panel.hidden).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    button.click();
    await fixture.whenStable();
    expect(message.value).toBe('A real request');
    expect(panel.hidden).toBe(false);
  });
  it('signs out to login, cancels assistant work and clears contextual navigation', async () => {
    await login();
    page.querySelector<HTMLButtonElement>('#open-assistant')!.click();
    await fixture.whenStable();
    page.querySelector<HTMLTextAreaElement>('#assistant-message')!.value = 'Pending';
    page.querySelector('#assistant-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    const pending = http.expectOne('/backends/java' + AI_ASSISTANT_ENDPOINT);
    page.querySelector<HTMLButtonElement>('#logout')!.click();
    await fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    expect(fixture.componentInstance.runtime.navigation()).toBeNull();
    expect(fixture.componentInstance.assistantState()).toBe(AiAssistantState.Idle);
    expect(fixture.componentInstance.assistantOpen()).toBe(false);
    expect(page.querySelector('#workspace')).toBeNull();
    expect(page.querySelector('#assistant-panel')).toBeNull();
    expect(page.querySelector('#email')).not.toBeNull();
  });
  it('retains backend switching in the secondary settings and discards the previous workspace', async () => {
    await login();
    const backend = page.querySelector<HTMLSelectElement>('#backend')!;
    backend.value = 'dotnet';
    backend.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    http.expectOne('/backends/dotnet/health').flush({ status: 'ok' }, { headers });
    await fixture.whenStable();
    expect(page.querySelector('#email')).not.toBeNull();
    expect(page.querySelector('#workspace')).toBeNull();
    expect(fixture.componentInstance.runtime.navigation()).toBeNull();
  });
});
