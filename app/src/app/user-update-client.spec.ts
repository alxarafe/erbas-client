import { TestBed } from '@angular/core/testing';
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
  USER_UPDATE_ERRORS,
  UpdateUserRequest,
  isUpdateUserRequest,
} from './users-client';
import { throwError } from 'rxjs';

describe('User PATCH contract', () => {
  let client: UsersClient, http: HttpTestingController;
  const base = '/backends/any',
    bearer = 'opaque-bearer';
  const user = {
    id: 'opaque /?#% user',
    email: 'fixture',
    enabled: true,
    admin: false,
  };
  const url = base + USERS_ENDPOINT + '/' + encodeURIComponent(user.id);
  const headers = {
    [USER_HTTP.contentType]: USER_HTTP.json,
    [USER_HTTP.cacheControl]: USER_HTTP.noStore,
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(UsersClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });
  it.each([{ enabled: false }, { admin: true }, { enabled: false, admin: true }])(
    'sends exactly present boolean fields %#',
    (body) => {
      const next = vi.fn();
      client.update(base, bearer, user.id, body).subscribe(next);
      const req = http.expectOne(url);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(body);
      expect(req.request.headers.get(USER_HTTP.accept)).toBe(USER_HTTP.json);
      expect(req.request.headers.get(USER_HTTP.contentType)).toBe(USER_HTTP.json);
      expect(req.request.headers.get(USER_HTTP.authorization)).toBe(
        `${USER_HTTP.bearer} ${bearer}`,
      );
      const updated = { ...user, ...body };
      req.flush(updated, { headers });
      expect(next).toHaveBeenCalledExactlyOnceWith(updated);
    },
  );
  it.each([
    {},
    null,
    [],
    'invalid',
    { enabled: 1 },
    { admin: undefined },
    { enabled: false, email: 'extra' },
    { id: 'extra' },
    { password: 'extra' },
  ])('rejects invalid request locally %#', (body) => {
    expect(isUpdateUserRequest(body)).toBe(false);
    expect(() => client.update(base, bearer, user.id, body as UpdateUserRequest)).toThrow(
      RangeError,
    );
    http.expectNone(() => true);
  });
  it('rejects empty ID locally', () => {
    expect(() => client.update(base, bearer, '', { enabled: false })).toThrow(RangeError);
    http.expectNone(() => true);
  });
  it('does not constrain a field absent from PATCH', () => {
    const next = vi.fn();
    client.update(base, bearer, user.id, { enabled: false }).subscribe(next);
    const updated = { ...user, enabled: false, admin: true };
    http.expectOne(url).flush(updated, { headers });
    expect(next).toHaveBeenCalledWith(updated);
  });
  it.each([
    null,
    {},
    [],
    { ...user, id: 'other', enabled: false },
    user,
    { ...user, enabled: false, password: 'extra' },
    { ...user, enabled: 'false' },
    { ...user, enabled: false, email: '' },
  ])('rejects malformed or inconsistent success %#', (body) => {
    const error = vi.fn();
    client.update(base, bearer, user.id, { enabled: false }).subscribe({ error });
    http.expectOne(url).flush(body, { headers });
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
  });
  it.each([
    {},
    { [USER_HTTP.contentType]: USER_HTTP.json },
    { ...headers, [USER_HTTP.contentType]: 'text/plain' },
    { ...headers, [USER_HTTP.cacheControl]: 'public' },
  ])('rejects HTTP metadata %#', (responseHeaders) => {
    const error = vi.fn();
    client.update(base, bearer, user.id, { admin: false }).subscribe({ error });
    http.expectOne(url).flush(user, { headers: responseHeaders as Record<string, string> });
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
  });
  it.each([{ admin: true }, { enabled: false, admin: true }])(
    'rejects mismatched admin expectation %#',
    (body) => {
      const error = vi.fn();
      client.update(base, bearer, user.id, body).subscribe({ error });
      http.expectOne(url).flush({ ...user, ...body, admin: false }, { headers });
      expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
    },
  );
  it('rejects 201 success', () => {
    const error = vi.fn();
    client.update(base, bearer, user.id, { admin: false }).subscribe({ error });
    http.expectOne(url).flush(user, {
      headers,
      status: HttpStatusCode.Created,
      statusText: 'Created',
    });
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
  });
  for (const [statusValue, code] of Object.entries(USER_UPDATE_ERRORS)) {
    const status = Number(statusValue);
    const errorHeaders =
      status === HttpStatusCode.Unauthorized
        ? { ...headers, [USER_HTTP.challenge]: USER_HTTP.bearer }
        : headers;
    it(`validates contractual ${status} ${code}`, () => {
      const error = vi.fn();
      client.update(base, bearer, user.id, { admin: false }).subscribe({ error });
      http.expectOne(url).flush({ code }, { headers: errorHeaders, status, statusText: 'Denied' });
      expect(error.mock.calls[0][0]).toBeInstanceOf(HttpErrorResponse);
      expect(error.mock.calls[0][0].status).toBe(status);
    });
    it.each(['code', 'extra', 'type', 'cache', 'challenge'])(
      `${status} malformed error %s is invalid response`,
      (fault) => {
        const error = vi.fn();
        client.update(base, bearer, user.id, { admin: false }).subscribe({ error });
        let body: object = { code };
        let responseHeaders: Record<string, string> = { ...errorHeaders };
        if (fault === 'code') body = { code: 'wrong' };
        if (fault === 'extra') body = { code, extra: true };
        if (fault === 'type') responseHeaders[USER_HTTP.contentType] = 'text/plain';
        if (fault === 'cache') delete responseHeaders[USER_HTTP.cacheControl];
        if (fault === 'challenge') {
          if (status === HttpStatusCode.Unauthorized) delete responseHeaders[USER_HTTP.challenge];
          else if (status === HttpStatusCode.Forbidden)
            responseHeaders[USER_HTTP.challenge] = USER_HTTP.bearer;
          else body = [];
        }
        http.expectOne(url).flush(body, {
          headers: responseHeaders,
          status,
          statusText: 'Denied',
        });
        expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
      },
    );
  }
  it('classifies Angular JSON parse error with 200 as invalid response', () => {
    const angularHttp = TestBed.inject(HttpClient);
    vi.spyOn(angularHttp, 'patch').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: HttpStatusCode.Ok,
            headers: new HttpHeaders(headers),
            error: { error: new SyntaxError(), text: '{invalid' },
          }),
      ),
    );
    const error = vi.fn();
    client.update(base, bearer, user.id, { admin: false }).subscribe({ error });
    expect(error).toHaveBeenCalledExactlyOnceWith(new InvalidUsersResponseError());
  });
});
