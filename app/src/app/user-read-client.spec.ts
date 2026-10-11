import { TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  UsersClient,
  InvalidUsersResponseError,
  CURRENT_USER_ENDPOINT,
  USERS_ENDPOINT,
  USER_HTTP,
} from './users-client';

describe('Protected User reads', () => {
  let client: UsersClient;
  let http: HttpTestingController;
  const base = '/backends/any';
  const token = 'opaque.test/token==';
  const user = {
    id: 'opaque /?#% identifier',
    email: 'fixture@example.test',
    enabled: true,
    admin: false,
  };
  const headers = {
    [USER_HTTP.contentType]: `${USER_HTTP.json}; charset=utf-8`,
    [USER_HTTP.cacheControl]: USER_HTTP.noStore,
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(UsersClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  for (const operation of ['current', 'detail'] as const) {
    const url = () =>
      base +
      (operation === 'current'
        ? CURRENT_USER_ENDPOINT
        : `${USERS_ENDPOINT}/${encodeURIComponent(user.id)}`);
    const read = () =>
      operation === 'current' ? client.current(base, token) : client.detail(base, token, user.id);
    it(`${operation}: GET with explicit bearer, JSON Accept and safely encoded opaque ID`, () => {
      const next = vi.fn();
      read().subscribe(next);
      const req = http.expectOne(url());
      expect(req.request.method).toBe('GET');
      expect(req.request.body).toBeNull();
      expect(req.request.headers.get(USER_HTTP.authorization)).toBe(`${USER_HTTP.bearer} ${token}`);
      expect(req.request.headers.get(USER_HTTP.accept)).toBe(USER_HTTP.json);
      expect(req.request.urlWithParams).not.toContain(token);
      expect(req.request.params.keys()).toEqual([]);
      req.flush(user, { headers });
      expect(next).toHaveBeenCalledExactlyOnceWith(user);
    });
    it.each([
      null,
      [],
      'private-detail',
      {},
      { ...user, id: '' },
      { ...user, email: '' },
      { ...user, id: 1 },
      { ...user, email: null },
      { ...user, enabled: 1 },
      { ...user, admin: 'true' },
      { id: user.id, email: user.email, enabled: true },
      { ...user, password: 'private-detail' },
    ])(`${operation}: rejects malformed/extra/missing User fields %#`, (body) => {
      const next = vi.fn(),
        error = vi.fn();
      read().subscribe({ next, error });
      http.expectOne(url()).flush(body, { headers });
      expect(next).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
    });
    it.each([
      {},
      { [USER_HTTP.contentType]: USER_HTTP.json },
      { ...headers, [USER_HTTP.contentType]: 'text/plain' },
      { ...headers, [USER_HTTP.cacheControl]: 'public' },
    ])(`${operation}: rejects missing/wrong media type or no-store %#`, (responseHeaders) => {
      const error = vi.fn();
      read().subscribe({ error });
      http.expectOne(url()).flush(user, { headers: responseHeaders as Record<string, string> });
      expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
    });
    it(`${operation}: rejects another successful HTTP status`, () => {
      const error = vi.fn();
      read().subscribe({ error });
      http
        .expectOne(url())
        .flush(user, { status: HttpStatusCode.Created, statusText: 'Created', headers });
      expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
    });
  }
  it('rejects an empty detail ID before HTTP', () => {
    expect(() => client.detail(base, token, '')).toThrow(RangeError);
    http.expectNone(() => true);
  });
});
