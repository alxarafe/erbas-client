import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsersClient, InvalidUsersResponseError } from './users-client';

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
