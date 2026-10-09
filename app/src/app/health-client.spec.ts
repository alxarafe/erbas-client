import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HealthClient } from './health-client';

describe('Health client', () => {
  let client: HealthClient;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(HealthClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('uses the supplied destination and JSON Accept header', () => {
    const result = vi.fn();
    client.check('/backends/any-implementation').subscribe(result);
    const request = http.expectOne('/backends/any-implementation/health');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush(
      { status: 'ok' },
      { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
    );
    expect(result).toHaveBeenCalledWith({ status: 'ok' });
  });
  for (const body of [null, [], {}, { status: 'down' }, { status: 'ok', extra: true }, 'ok']) {
    it(`rejects invalid body ${JSON.stringify(body)}`, () => {
      const error = vi.fn();
      client.check('/backend').subscribe({ error });
      http
        .expectOne('/backend/health')
        .flush(body, { headers: { 'Content-Type': 'application/json' } });
      expect(error).toHaveBeenCalledOnce();
    });
  }
  it('rejects HTTP failures', () => {
    const error = vi.fn();
    client.check('/backend').subscribe({ error });
    http
      .expectOne('/backend/health')
      .flush('unavailable', { status: 503, statusText: 'Unavailable' });
    expect(error).toHaveBeenCalledOnce();
  });
  it('bounds a stalled request to seven seconds', () => {
    vi.useFakeTimers();
    try {
      const error = vi.fn();
      client.check('/backend').subscribe({ error });
      const request = http.expectOne('/backend/health');
      vi.advanceTimersByTime(7000);
      expect(error).toHaveBeenCalledOnce();
      expect(request.cancelled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('rejects network failures', () => {
    const error = vi.fn();
    client.check('/backend').subscribe({ error });
    http.expectOne('/backend/health').error(new ProgressEvent('error'));
    expect(error).toHaveBeenCalledOnce();
  });
  it('rejects non-JSON media types', () => {
    const error = vi.fn();
    client.check('/backend').subscribe({ error });
    http
      .expectOne('/backend/health')
      .flush({ status: 'ok' }, { headers: { 'Content-Type': 'text/plain' } });
    expect(error).toHaveBeenCalledOnce();
  });
  it('rejects successful statuses other than 200', () => {
    const error = vi.fn();
    client.check('/backend').subscribe({ error });
    http
      .expectOne('/backend/health')
      .flush(
        { status: 'ok' },
        { status: 201, statusText: 'Created', headers: { 'Content-Type': 'application/json' } },
      );
    expect(error).toHaveBeenCalledOnce();
  });
});
