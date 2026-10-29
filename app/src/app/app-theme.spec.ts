import { finishLegacyNavigation } from './resource-runtime/runtime-fixtures';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './resource-runtime/resource-routing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { ThemeService } from './core-fe/theme/theme-runtime';
import { ThemeId } from './core-fe/theme/theme-definition';
import { AuthSession } from './auth-session';
import { CURRENT_USER_ENDPOINT, USER_HTTP } from './users-client';
import { AI_ASSISTANT_ENDPOINT } from './ai-assistant-client';

const TOKEN = 'opaque-theme-regression-token';
const JSON_HEADERS = {
  [USER_HTTP.contentType]: USER_HTTP.json,
  [USER_HTTP.cacheControl]: USER_HTTP.noStore,
};
describe('App theme shell regression', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(APP_ROUTES), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    finishLegacyNavigation(http);
    http.verify();
  });
  it.each(Object.values(ThemeId))(
    'preserves backend/login/assistant/user behavior in %s',
    async (theme) => {
      const fixture = TestBed.createComponent(App);
      await fixture.whenStable();
      http.expectOne('/demo/defaults.env').flush('', { status: 404, statusText: 'Not Found' });
      http.expectOne('/backends/java/health').flush({ status: 'ok' }, { headers: JSON_HEADERS });
      fixture.debugElement.injector.get(ThemeService).activate(theme);
      await fixture.whenStable();
      const page = fixture.nativeElement as HTMLElement;
      expect(page.querySelector('#backend')).not.toBeNull();
      expect(page.querySelector('#email')).not.toBeNull();
      expect(page.querySelector('#assistant-heading')).toBeNull();
      expect(page.querySelector('#users-heading')).toBeNull();
      const email = page.querySelector<HTMLInputElement>('#email')!;
      email.value = 'theme@example.test';
      page.querySelector<HTMLInputElement>('#password')!.value = 'example-password';
      page
        .querySelector('form')!
        .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      const login = http.expectOne('/backends/java/api/auth/login');
      expect(login.request.body.email).toBe(email.value);
      login.flush({ accessToken: TOKEN }, { headers: JSON_HEADERS });
      http
        .expectOne('/backends/java' + CURRENT_USER_ENDPOINT)
        .flush(
          { id: 'theme-admin', email: email.value, enabled: true, admin: true },
          { headers: JSON_HEADERS },
        );
      await fixture.whenStable();
      expect(page.querySelector('#assistant-form')).not.toBeNull();
      expect(page.querySelector('#create-user')).not.toBeNull();
      const draft = page.querySelector<HTMLTextAreaElement>('#assistant-message')!;
      draft.value = 'Draft retained across themes';
      fixture.debugElement.injector.get(ThemeService).activate(ThemeId.Cyberpunk);
      await fixture.whenStable();
      expect(page.querySelector('#email')).toBeNull();
      expect(page.querySelector('#assistant-message')).toBe(draft);
      expect(draft.value).toBe('Draft retained across themes');
      expect(TestBed.inject(AuthSession).tokenFor('java')).toBe(TOKEN);
      page
        .querySelector<HTMLFormElement>('#assistant-form')!
        .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      const assistant = http.expectOne('/backends/java' + AI_ASSISTANT_ENDPOINT);
      expect(assistant.request.body.message).toBe(draft.value);
      assistant.flush(
        { code: 'module_disabled', errors: [{ code: 'module_disabled' }] },
        { status: 503, statusText: 'Unavailable', headers: JSON_HEADERS },
      );
      await fixture.whenStable();
      expect(TestBed.inject(AuthSession).tokenFor('java')).toBe(TOKEN);
      const select = page.querySelector<HTMLSelectElement>('#backend')!;
      select.value = 'dotnet';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();
      http.expectOne('/backends/dotnet/health').flush({ status: 'ok' }, { headers: JSON_HEADERS });
      await fixture.whenStable();
      expect(TestBed.inject(AuthSession).authenticated()).toBe(false);
      expect(page.querySelector('#assistant-form')).toBeNull();
      expect(page.querySelector('#create-user')).toBeNull();
    },
  );
});
