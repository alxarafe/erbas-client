import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { parseDemoDefaults } from './demo-defaults';

const defaults = [
  'ERBAS_DEMO_ADMIN_EMAIL=runtime-admin@example.test',
  'ERBAS_DEMO_ADMIN_PASSWORD=Runtime_admin_123=\"$',
  'ERBAS_DEMO_USER_EMAIL=runtime-user@example.test',
  'ERBAS_DEMO_USER_PASSWORD=Runtime_user_123',
].join('\n');

describe('Optional runtime demo defaults', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('displays supplied runtime values without filling inputs or logging in', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    http.expectOne('/demo/defaults.env').flush(defaults);
    http.expectOne('/backends/java/health').flush({ status: 'ok' });
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Default demo values');
    expect(page.textContent).toContain('runtime-admin@example.test');
    expect(page.textContent).toContain('Runtime_admin_123=\"$');
    expect(page.textContent).toContain('runtime-user@example.test');
    expect(page.textContent).toContain('Runtime_user_123');
    expect(page.textContent).toContain('persisted demo accounts are modified');
    expect(page.querySelector<HTMLInputElement>('#email')!.value).toBe('');
    expect(page.querySelector<HTMLInputElement>('#password')!.value).toBe('');
    http.expectNone((request) => request.method === 'POST');
  });

  it('ignores malformed runtime data while Health and login remain available', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    http.expectOne('/demo/defaults.env').flush('<html>not demo data</html>');
    http.expectOne('/backends/java/health').flush({ status: 'ok' });
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).not.toContain('Default demo values');
    expect(page.querySelector('form')).not.toBeNull();
    expect(page.querySelectorAll('option').length).toBe(2);
  });

  it('rejects missing, duplicate, extra, empty, CR/NUL and identical-email values', () => {
    for (const text of [
      '',
      defaults + '\n' + defaults,
      defaults + '\nOTHER=x',
      defaults.replace('Runtime_user_123', ''),
      defaults + '\r',
      defaults + '\0',
      defaults.replace('runtime-user@example.test', 'runtime-admin@example.test'),
    ]) {
      expect(parseDemoDefaults(text)).toBeNull();
    }
    expect(parseDemoDefaults(defaults)?.adminPassword).toBe('Runtime_admin_123=\"$');
  });
});
