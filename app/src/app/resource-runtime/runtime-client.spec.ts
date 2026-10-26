import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpStatusCode } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RuntimeClient, RuntimeFailure, failureMessage } from './runtime-client';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import { ExactNumber, parseExact, stringifyExact } from './exact-json';
import { RESOURCE_PROTOCOL as P, Query } from './models';
import {
  fixtureMetadata,
  fixtureNavigation,
  TEST_ETAG,
  TEST_RESOURCE as R,
} from './runtime-fixtures';
const headers = { 'Content-Type': 'application/json', ETag: TEST_ETAG };
describe('External generic protocol transport and context cache', () => {
  let http: HttpTestingController, client: RuntimeClient, session: AuthSession, base: string;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    client = TestBed.inject(RuntimeClient);
    base = TestBed.inject(BackendSelection).selected().proxyBaseUrl;
    TestBed.tick();
  });
  afterEach(() => http.verify());
  function ready() {
    session.establish('java', 'opaque-token');
    session.markContextReady();
    TestBed.tick();
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
    TestBed.tick();
  }
  it('waits for authenticated profile/context, then loads navigation only once', () => {
    session.establish('java', 'token');
    TestBed.tick();
    http.expectNone(base + P.navigation);
    session.markContextReady();
    TestBed.tick();
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
    TestBed.tick();
    expect(client.navigation()?.items[0]?.children.length).toBe(2);
    http.expectNone(base + P.navigation);
  });
  it('reuses ETag and preserves cached tree on HTTP 304', () => {
    ready();
    const previous = client.navigation();
    client.revalidateNavigation();
    const request = http.expectOne(base + P.navigation);
    expect(request.request.headers.get(P.conditional)).toBe(TEST_ETAG);
    request.flush('', { status: HttpStatusCode.NotModified, statusText: 'Not Modified', headers });
    TestBed.tick();
    expect(client.navigation()).toBe(previous);
  });
  it('discards on logout and reloads after new context without reusing the old ETag', () => {
    ready();
    session.clear();
    expect(client.navigation()).toBe(null);
    TestBed.tick();
    session.establish('java', 'second-token');
    session.markContextReady();
    TestBed.tick();
    const request = http.expectOne(base + P.navigation);
    expect(request.request.headers.has(P.conditional)).toBe(false);
    request.flush(JSON.stringify(fixtureNavigation), { headers });
    session.contextChanged();
    expect(client.navigation()).toBe(null);
    TestBed.tick();
    const changed = http.expectOne(base + P.navigation);
    expect(changed.request.headers.has(P.conditional)).toBe(false);
    changed.flush(JSON.stringify(fixtureNavigation), { headers });
  });
  it('cancels old protected requests and clears metadata when context changes', () => {
    ready();
    client.metadata(R).subscribe();
    const pending = http.expectOne(base + P.metadata + '/' + R);
    session.contextChanged();
    TestBed.tick();
    expect(pending.cancelled).toBe(true);
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
    client.metadata(R).subscribe();
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
  });
  it('caches metadata and explicitly validates its ETag', () => {
    ready();
    let value: unknown;
    client.metadata(R).subscribe((v) => (value = v));
    http
      .expectOne(base + P.metadata + '/' + R)
      .flush(JSON.stringify(fixtureMetadata()), { headers });
    client.metadata(R).subscribe((v) => expect(v).toBe(value));
    http.expectNone(base + P.metadata + '/' + R);
    client.metadata(R, true).subscribe((v) => expect(v).toBe(value));
    const req = http.expectOne(base + P.metadata + '/' + R);
    expect(req.request.headers.get(P.conditional)).toBe(TEST_ETAG);
    req.flush('', { status: 304, statusText: 'Not Modified' });
  });
  it('encodes repeated sort/filter, exact decimal, date, offset and search without joins', () => {
    ready();
    const exact = '9007199254740993.123456789012345678';
    const query: Query = {
      offset: 50,
      limit: 25,
      search: 'Case sensitive',
      sort: ['name', '-id'],
      filters: [
        { field: 'amount', operator: 'gte', value: new ExactNumber(exact) },
        { field: 'day', operator: 'lt', value: '2026-10-27' },
      ],
    };
    client.list(R, query).subscribe((page) => {
      expect(page.offset).toBe(50);
      expect(page.total).toBe(75);
      expect((page.items[0]!['amount'] as ExactNumber).text).toBe(exact);
    });
    const req = http.expectOne((r) => r.url === base + P.records + '/' + R);
    expect(req.request.params.getAll('sort')).toEqual(query.sort);
    expect(req.request.params.getAll('filter')?.[0]).toContain('"value":' + exact);
    expect(req.request.params.get('offset')).toBe('50');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('search')).toBe(query.search);
    req.flush(
      '{"items":[{"amount":' + exact + ',"day":"2026-10-26"}],"offset":50,"limit":25,"total":75}',
      { headers },
    );
  });
  it('round-trips exact decimal and date-only through POST/PATCH/get without Number or Date', () => {
    ready();
    const exact = '12345678901234567890.123456789012345678';
    const body = { amount: new ExactNumber(exact), day: '2026-10-26' };
    client
      .save(R, body, 'opaque /?#')
      .subscribe((row) => expect(stringifyExact(row)).toBe(stringifyExact(body)));
    const req = http.expectOne(base + P.records + '/' + R + '/opaque%20%2F%3F%23');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toBe('{"amount":' + exact + ',"day":"2026-10-26"}');
    req.flush(req.request.body, { headers });
  });
  it('discovers contextual entity availability and executes a typed target with parameters', () => {
    ready();
    client.availability(R, 'abc').subscribe((states) => expect(states[0]?.available).toBe(true));
    let req = http.expectOne(base + P.actions + '/' + R + '/availability');
    expect(JSON.parse(req.request.body)).toEqual({ scope: 'ENTITY', id: 'abc' });
    req.flush('[{"name":"finish","authorized":true,"available":true}]', { headers });
    client.execute(R, 'finish', 'abc', { reason: 'Done' }).subscribe();
    req = http.expectOne(base + P.actions + '/' + R + '/finish/execute');
    expect(JSON.parse(req.request.body)).toEqual({
      target: { id: 'abc' },
      parameters: { reason: 'Done' },
    });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
  it.each([
    HttpStatusCode.BadRequest,
    HttpStatusCode.Forbidden,
    HttpStatusCode.NotFound,
    HttpStatusCode.Conflict,
    HttpStatusCode.Unauthorized,
  ])('centralizes common error %s without business reason knowledge', (status) => {
    ready();
    client.get(R, 'missing').subscribe({
      error: (error) => {
        expect(error).toBeInstanceOf(RuntimeFailure);
        expect(error.status).toBe(status);
        expect(error.details[0].path).toBe('name');
        expect(failureMessage(error)).toBeTruthy();
      },
    });
    http
      .expectOne(base + P.records + '/' + R + '/missing')
      .flush('{"code":"example_failure","errors":[{"code":"example_detail","path":"name"}]}', {
        status,
        statusText: 'Failure',
        headers,
      });
    expect(session.authenticated()).toBe(status !== HttpStatusCode.Unauthorized);
    TestBed.tick();
  });
  it('rejects malformed navigation inside the stream instead of an unhandled subscriber error', () => {
    session.establish('java', 'token');
    session.markContextReady();
    TestBed.tick();
    http.expectOne(base + P.navigation).flush('{"version":1}', { headers });
    expect(client.navigation()).toBe(null);
    expect(client.error()?.code).toBe('invalid_response');
  });
});
describe('Lossless JSON boundaries', () => {
  it.each(['0', '-0', '123456789012345678901234567890.123456789', '1e-4096'])(
    'preserves numeric lexeme %s',
    (token) => {
      expect(stringifyExact(parseExact('{"n":' + token + ',"s":"digits 123"}'))).toBe(
        '{"n":' + token + ',"s":"digits 123"}',
      );
    },
  );
  it.each(['{"n":01}', '{"n":1,"n":2}', '[1,]', 'NaN', '{"x":"unterminated}'])(
    'rejects invalid/ambiguous JSON %s',
    (text) => expect(() => parseExact(text)).toThrow(),
  );
  it('does not confuse ordinary object properties with numeric wrappers', () =>
    expect(parseExact('{"__exact_token__":"0","n":12}')).toEqual({
      __exact_token__: '0',
      n: new ExactNumber('12'),
    }));
});
