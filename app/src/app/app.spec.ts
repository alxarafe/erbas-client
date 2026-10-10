import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';

describe('Application', () => {
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
  it('loads, checks Health automatically and renders online', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    http.expectOne('/demo/defaults.env').flush('', { status: 404, statusText: 'Not Found' });
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('h1')?.textContent).toBe('ERBAS');
    expect(page.querySelectorAll('option').length).toBe(2);
    expect(page.textContent).toContain('CHECKING');
    http
      .expectOne('/backends/java/health')
      .flush({ status: 'ok' }, { headers: { 'Content-Type': 'application/json' } });
    await fixture.whenStable();
    expect(page.textContent).toContain('ONLINE');
    expect(page.textContent).toContain('{"status":"ok"}');
  });
  it('changes backend, cancels the old probe and supports retry after failure', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const old = http.expectOne('/backends/java/health');
    http.expectOne('/demo/defaults.env').flush('', { status: 404, statusText: 'Not Found' });
    const page = fixture.nativeElement as HTMLElement;
    const select = page.querySelector('select')!;
    select.value = 'dotnet';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(old.cancelled).toBe(true);
    expect(localStorage.getItem('erbas.backend')).toBe('dotnet');
    http
      .expectOne('/backends/dotnet/health')
      .flush({ status: 'wrong' }, { headers: { 'Content-Type': 'application/json' } });
    await fixture.whenStable();
    expect(page.textContent).toContain('OFFLINE / ERROR');
    expect(page.textContent).not.toContain('Invalid health response');
    page.querySelector('button')!.click();
    http
      .expectOne('/backends/dotnet/health')
      .flush({ status: 'ok' }, { headers: { 'Content-Type': 'application/json' } });
    await fixture.whenStable();
    expect(page.textContent).toContain('ONLINE');
    expect(page.textContent).toContain('Alxarafe.NET / ASP.NET Core');
  });
});
