import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpStatusCode,
  provideHttpClient,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  UsersClient,
  InvalidUsersResponseError,
  USERS_ENDPOINT,
  USER_HTTP,
  USER_CREATE_ERRORS,
  USER_PASSWORD_LENGTH,
} from './users-client';

describe('Users client', () => {
  let client: UsersClient;
  let http: HttpTestingController;
  const user = { id: 'opaque-id', email: 'User@example.test', enabled: true, admin: false };
  const page = {
    items: [user],
    offset: 0,
    limit: 50,
    total: 1,
    order: [{ field: 'id', direction: 'asc' }],
  };
  const headers = {
    'Content-Type': 'Application/JSON; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  const url = '/backends/any/api/users?offset=0&limit=50';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(UsersClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('uses the supplied backend, pagination and opaque bearer with JSON Accept', () => {
    const next = vi.fn();
    client.list('/backends/any', 'opaque.test/token==', 10, 25).subscribe(next);
    const request = http.expectOne('/backends/any/api/users?offset=10&limit=25');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('offset')).toBe('10');
    expect(request.request.params.get('limit')).toBe('25');
    expect(request.request.headers.get('Authorization')).toBe('Bearer opaque.test/token==');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    expect(request.request.urlWithParams).not.toContain('token');
    const body = { ...page, offset: 10, limit: 25, total: 11 };
    request.flush(body, { headers });
    expect(next).toHaveBeenCalledExactlyOnceWith(body);
  });

  it.each([
    { ...page, items: [], total: 0 },
    {
      ...page,
      items: [user, { ...user, id: 'another-opaque-id', admin: true, enabled: false }],
      total: 2,
    },
    { ...page, items: [], offset: 100, total: 7 },
  ])('accepts empty, multiple and beyond-total windows %# without interpreting IDs', (body) => {
    const next = vi.fn();
    client.list('/backends/any', 'token', body.offset, body.limit).subscribe(next);
    http
      .expectOne(`/backends/any/api/users?offset=${body.offset}&limit=50`)
      .flush(body, { headers });
    expect(next).toHaveBeenCalledExactlyOnceWith(body);
  });

  it.each([
    null,
    [],
    'private-detail',
    {},
    { ...page, total: undefined },
    { ...page, extra: 'private-detail' },
    { ...page, items: null },
    ...[
      null,
      [],
      {},
      { ...user, id: '' },
      { ...user, email: '' },
      { ...user, enabled: 1 },
      { ...user, admin: 'true' },
      { ...user, email: 1 },
      { ...user, id: 1 },
      { ...user, password: 'private-detail' },
    ].map((item) => ({ ...page, items: [item] })),
    ...[-1, 1.5, '1', null].map((total) => ({ ...page, total })),
    ...[-1, 0.5, '0', 1].map((offset) => ({ ...page, offset })),
    ...[0, 101, 1.5, '50', 25].map((limit) => ({ ...page, limit })),
    { ...page, items: [], total: 1 },
    { ...page, total: 0 },
    ...[
      null,
      [],
      [{ field: 'email', direction: 'asc' }],
      [{ field: 'id', direction: 'desc' }],
      [{ field: 'id', direction: 'asc', extra: true }],
      [null],
      [
        { field: 'id', direction: 'asc' },
        { field: 'id', direction: 'asc' },
      ],
    ].map((order) => ({ ...page, order })),
  ])('rejects non-contractual success body %# without partial data or error details', (body) => {
    const next = vi.fn();
    const error = vi.fn();
    client.list('/backends/any', 'token', 0, 50).subscribe({ next, error });
    http.expectOne(url).flush(body, { headers });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
  });

  it.each([
    {},
    { ...headers, 'Content-Type': 'text/plain' },
    { ...headers, 'Cache-Control': 'public' },
  ])('rejects missing/incorrect JSON or no-store HTTP metadata %#', (responseHeaders) => {
    const error = vi.fn();
    client.list('/backends/any', 'token', 0, 50).subscribe({ error });
    http.expectOne(url).flush(page, { headers: responseHeaders });
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
  });

  it('rejects a successful status other than 200', () => {
    const error = vi.fn();
    client.list('/backends/any', 'token', 0, 50).subscribe({ error });
    http.expectOne(url).flush(page, { status: 201, statusText: 'Created', headers });
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
  });

  it.each([
    [-1, 50],
    [0.5, 50],
    [NaN, 50],
    [Infinity, 50],
    [0, 0],
    [0, 101],
    [0, 1.5],
    [0, NaN],
  ])('rejects offset %s / limit %s before issuing HTTP', (offset, limit) => {
    expect(() => client.list('/backends/any', 'token', offset, limit)).toThrow(RangeError);
    http.expectNone(() => true);
  });
});

describe('User creation client', () => {
  let client: UsersClient, http: HttpTestingController;
  const base = '/backends/any';
  const bearer = 'opaque-fixture-token';
  const request = {
    email: ' untouched-not-an-email ',
    password: ' 😀e\u0301 unchanged password ',
    admin: false,
  };
  const user = { id: 'opaque-created', email: request.email, enabled: true, admin: request.admin };
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
  const send = () => {
    const next = vi.fn(),
      error = vi.fn();
    client.create(base, bearer, request).subscribe({ next, error });
    return { next, error, req: http.expectOne(base + USERS_ENDPOINT) };
  };
  it('posts exact unchanged fields and explicit JSON/bearer headers', () => {
    const { req, next } = send();
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    expect(Object.keys(req.request.body).sort()).toEqual(['admin', 'email', 'password']);
    expect(req.request.headers.get(USER_HTTP.accept)).toBe(USER_HTTP.json);
    expect(req.request.headers.get(USER_HTTP.contentType)).toBe(USER_HTTP.json);
    expect(req.request.headers.get(USER_HTTP.authorization)).toBe(`${USER_HTTP.bearer} ${bearer}`);
    expect(req.request.urlWithParams).not.toContain(bearer);
    expect(req.request.urlWithParams).not.toContain(request.password);
    req.flush(user, { status: HttpStatusCode.Created, statusText: 'Created', headers });
    expect(next).toHaveBeenCalledExactlyOnceWith(user);
  });
  it.each([
    null,
    [],
    {},
    { ...user, password: 'private-value' },
    { ...user, id: '' },
    { ...user, email: '' },
    { ...user, enabled: false },
    { ...user, email: 'transformed' },
    { ...user, admin: true },
    { ...user, enabled: 1 },
    { ...user, admin: 'false' },
  ])('rejects malformed or semantically incorrect created User %#', (body) => {
    const { req, error, next } = send();
    req.flush(body, { status: HttpStatusCode.Created, statusText: 'Created', headers });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidUsersResponseError));
    expect(next).not.toHaveBeenCalled();
  });
  it('does not accept HTTP 200', () => {
    const { req, error } = send();
    req.flush(user, { headers });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidUsersResponseError));
  });
  it.each([
    { [USER_HTTP.contentType]: 'text/plain', [USER_HTTP.cacheControl]: USER_HTTP.noStore },
    { [USER_HTTP.contentType]: USER_HTTP.json },
    { [USER_HTTP.contentType]: USER_HTTP.json, [USER_HTTP.cacheControl]: 'public' },
  ])('rejects invalid successful headers %#', (badHeaders) => {
    const { req, error } = send();
    req.flush(user, {
      status: HttpStatusCode.Created,
      statusText: 'Created',
      headers: badHeaders as Record<string, string>,
    });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidUsersResponseError));
  });
  it('classifies Angular JSON parse errors at status 201 as invalid response', () => {
    const failure = new HttpErrorResponse({
      status: HttpStatusCode.Created,
      headers: new HttpHeaders(headers),
      error: { error: new SyntaxError(), text: '{bad json' },
    });
    const httpClient = TestBed.inject(HttpClient);
    vi.spyOn(httpClient, 'post').mockReturnValue(throwError(() => failure));
    const error = vi.fn();
    client.create(base, bearer, request).subscribe({ error });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidUsersResponseError));
  });
  for (const [statusText, status] of [
    ['Bad Request', HttpStatusCode.BadRequest],
    ['Unauthorized', HttpStatusCode.Unauthorized],
    ['Forbidden', HttpStatusCode.Forbidden],
    ['Conflict', HttpStatusCode.Conflict],
  ] as const) {
    const code = USER_CREATE_ERRORS[status];
    const errorHeaders = {
      ...headers,
      ...(status === HttpStatusCode.Unauthorized
        ? { [USER_HTTP.challenge]: USER_HTTP.bearer }
        : {}),
    };
    it(`preserves validated ${status} ${code}`, () => {
      const { req, error } = send();
      req.flush({ code }, { status, statusText, headers: errorHeaders });
      expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
      expect(error.mock.calls[0][0].status).toBe(status);
    });
    it.each([null, {}, { code: 'unexpected' }, { code, extra: true }])(
      `rejects invalid ${status} error body %#`,
      (body) => {
        const { req, error } = send();
        req.flush(body, { status, statusText, headers: errorHeaders });
        expect(error).toHaveBeenCalledWith(expect.any(InvalidUsersResponseError));
      },
    );
    it.each([
      { ...errorHeaders, [USER_HTTP.contentType]: 'text/plain' },
      { ...errorHeaders, [USER_HTTP.cacheControl]: 'public' },
      { [USER_HTTP.contentType]: USER_HTTP.json },
    ])(`rejects invalid ${status} error headers %#`, (badHeaders) => {
      const { req, error } = send();
      req.flush({ code }, { status, statusText, headers: badHeaders as Record<string, string> });
      expect(error).toHaveBeenCalledWith(expect.any(InvalidUsersResponseError));
    });
  }
  it.each([
    [HttpStatusCode.Unauthorized, undefined],
    [HttpStatusCode.Unauthorized, 'Basic'],
    [HttpStatusCode.Forbidden, USER_HTTP.bearer],
    [HttpStatusCode.Forbidden, ''],
  ] as const)('rejects wrong challenge for %s', (status, challenge) => {
    const { req, error } = send();
    req.flush(
      { code: USER_CREATE_ERRORS[status] },
      {
        status,
        statusText: 'Denied',
        headers: {
          ...headers,
          ...(challenge === undefined ? {} : { [USER_HTTP.challenge]: challenge }),
        },
      },
    );
    expect(error).toHaveBeenCalledWith(expect.any(InvalidUsersResponseError));
  });
  it.each([
    HttpStatusCode.Accepted,
    HttpStatusCode.NoContent,
    HttpStatusCode.NotFound,
    HttpStatusCode.InternalServerError,
  ])('preserves unexpected status %s as HTTP failure', (status) => {
    const { req, error } = send();
    req.flush({}, { status, statusText: 'Failure', headers });
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
  });
  it.each([
    [USER_PASSWORD_LENGTH.minimum - 1, false],
    [USER_PASSWORD_LENGTH.minimum, true],
    [USER_PASSWORD_LENGTH.maximum, true],
    [USER_PASSWORD_LENGTH.maximum + 1, false],
  ])('counts %s supplementary code points with valid=%s', (count, valid) => {
    const body = { ...request, password: '😀'.repeat(count as number) };
    if (valid) {
      client.create(base, bearer, body).subscribe();
      http
        .expectOne(base + USERS_ENDPOINT)
        .flush(user, { status: HttpStatusCode.Created, statusText: 'Created', headers });
    } else {
      expect(() => client.create(base, bearer, body)).toThrow(RangeError);
      http.expectNone(base + USERS_ENDPOINT);
    }
  });
  it('rejects empty email and invalid/extra request properties before HTTP', () => {
    for (const body of [
      { ...request, email: '' },
      { ...request, admin: 'true' },
      { ...request, enabled: true },
    ])
      expect(() => client.create(base, bearer, body as never)).toThrow(RangeError);
    http.expectNone(base + USERS_ENDPOINT);
  });
});
