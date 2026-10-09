import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthClient, InvalidLoginResponseError } from './auth-client';

describe('Auth client', () => {
  let client: AuthClient;
  let http: HttpTestingController;
  const credentials = { email: 'user@example.test', password: ' secret\t ' };
  const url = '/backends/any-implementation/api/auth/login';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(AuthClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('posts unchanged credentials to the supplied URL and returns the opaque token', () => {
    const next = vi.fn();
    client.login('/backends/any-implementation', credentials).subscribe(next);
    const request = http.expectOne(url);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    expect(request.request.body).toEqual(credentials);
    request.flush(
      { accessToken: 'opaque.backend-specific/token==' },
      { headers: { 'Content-Type': 'Application/JSON; charset=utf-8' } },
    );
    expect(next).toHaveBeenCalledExactlyOnceWith({
      accessToken: 'opaque.backend-specific/token==',
    });
  });

  it.each([
    null,
    [],
    {},
    'token',
    { accessToken: '' },
    { accessToken: null },
    { accessToken: 42 },
    { AccessToken: 'token' },
    { accessToken: 'token', refreshToken: 'extra' },
  ])('rejects invalid success body %# without exposing its contents', (body) => {
    const error = vi.fn();
    const next = vi.fn();
    client.login('/backends/any-implementation', credentials).subscribe({ next, error });
    http.expectOne(url).flush(body, { headers: { 'Content-Type': 'application/json' } });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidLoginResponseError());
  });

  it.each([undefined, 'text/plain'])('rejects missing or non-JSON content type %s', (type) => {
    const error = vi.fn();
    client.login('/backends/any-implementation', credentials).subscribe({ error });
    http
      .expectOne(url)
      .flush({ accessToken: 'token' }, { headers: type ? { 'Content-Type': type } : {} });
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidLoginResponseError());
  });

  it('rejects successful statuses other than 200', () => {
    const error = vi.fn();
    client.login('/backends/any-implementation', credentials).subscribe({ error });
    http
      .expectOne(url)
      .flush(
        { accessToken: 'token' },
        { status: 201, statusText: 'Created', headers: { 'Content-Type': 'application/json' } },
      );
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidLoginResponseError());
  });

  it.each([
    [400, 'invalid_request'],
    [401, 'invalid_credentials'],
    [503, 'unavailable'],
  ])('preserves HTTP status %s and error body for the caller', (status, code) => {
    const error = vi.fn();
    client.login('/backends/any-implementation', credentials).subscribe({ error });
    http.expectOne(url).flush({ code }, { status, statusText: 'Failure' });
    expect(error).toHaveBeenCalledOnce();
    const failure = error.mock.calls[0]![0] as HttpErrorResponse;
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect(failure.status).toBe(status);
    expect(failure.error).toEqual({ code });
  });

  it('preserves network failures as HttpErrorResponse with status zero', () => {
    const error = vi.fn();
    client.login('/backends/any-implementation', credentials).subscribe({ error });
    http.expectOne(url).error(new ProgressEvent('error'));
    expect(error).toHaveBeenCalledOnce();
    const failure = error.mock.calls[0]![0] as HttpErrorResponse;
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect(failure.status).toBe(0);
  });
});
