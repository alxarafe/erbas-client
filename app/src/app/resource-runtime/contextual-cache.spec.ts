import { TestBed } from '@angular/core/testing';
import { provideHttpClient, HttpStatusCode } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import { RuntimeClient, RuntimeFailure } from './runtime-client';
import { Metadata, PresentationDocument, RESOURCE_PROTOCOL as P } from './models';
import {
  fixtureMetadata,
  fixtureNavigation,
  TEST_ETAG,
  TEST_RESOURCE as R,
} from './runtime-fixtures';
const headers = {
  'Content-Type': 'application/json',
  ETag: TEST_ETAG,
  'Cache-Control': 'private, no-cache',
  Vary: 'Authorization',
};
describe('Contextual presentation identity, effective context and private ETag cache', () => {
  let http: HttpTestingController,
    client: RuntimeClient,
    session: AuthSession,
    backend: BackendSelection,
    base: string;
  const path = () => base + P.metadata + '/' + R + P.presentation;
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(RuntimeClient);
    session = TestBed.inject(AuthSession);
    backend = TestBed.inject(BackendSelection);
    base = backend.selected().proxyBaseUrl;
    TestBed.tick();
    session.establish('java', 'opaque');
    session.markContextReady();
    TestBed.tick();
    nav();
  });
  afterEach(() => http.verify());
  function nav() {
    http.expectOne(base + P.navigation).flush(JSON.stringify(fixtureNavigation), { headers });
  }
  function load(meta = fixtureMetadata()) {
    let loaded!: Metadata;
    client.metadata(R).subscribe((v) => (loaded = v));
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(meta), { headers });
    return loaded;
  }
  function body(meta: Metadata) {
    return { id: meta.id, definitionHash: meta.definitionHash, presentation: {} };
  }
  it('caches by resource/context, sends conditional ETag and preserves a valid document on 304', () => {
    const meta = load();
    let value: PresentationDocument | null | undefined;
    client.presentation(meta).subscribe((v) => (value = v));
    const first = http.expectOne(path());
    expect(first.request.headers.get(P.conditional)).toBeNull();
    first.flush(JSON.stringify(body(meta)), { headers });
    client.presentation(meta).subscribe((v) => expect(v).toBe(value));
    http.expectNone(path());
    client.presentation(meta, true).subscribe((v) => expect(v).toBe(value));
    const req = http.expectOne(path());
    expect(req.request.headers.get(P.conditional)).toBe(TEST_ETAG);
    req.flush('', { status: HttpStatusCode.NotModified, statusText: 'Not Modified', headers });
  });
  it('only requests presentation after valid current metadata; uncached metadata cannot manufacture fallback', () => {
    let error: RuntimeFailure | undefined;
    client.presentation(fixtureMetadata()).subscribe({ error: (e) => (error = e) });
    expect(error?.code).toBe('invalid_response');
    http.expectNone(path());
  });
  it('accepts endpoint 404 after valid metadata and caches only that legacy absence', () => {
    const meta = load();
    client.presentation(meta).subscribe((v) => expect(v).toBeNull());
    http.expectOne(path()).flush('', { status: HttpStatusCode.NotFound, statusText: 'Not Found' });
    client.presentation(meta).subscribe((v) => expect(v).toBeNull());
    http.expectNone(path());
  });
  it.each([
    HttpStatusCode.BadRequest,
    HttpStatusCode.Unauthorized,
    HttpStatusCode.Forbidden,
    HttpStatusCode.InternalServerError,
  ])('never treats HTTP %s as legacy absence', (status) => {
    const meta = load();
    let fallback = false,
      error: RuntimeFailure | undefined;
    client
      .presentation(meta)
      .subscribe({ next: () => (fallback = true), error: (e) => (error = e) });
    http.expectOne(path()).flush('{"code":"failure","errors":[{"code":"failure"}]}', {
      status,
      statusText: 'Failure',
      headers,
    });
    expect(fallback).toBe(false);
    expect(error?.status).toBe(status);
    expect(session.authenticated()).toBe(status !== HttpStatusCode.Unauthorized);
    TestBed.tick();
  });
  it.each(['id', 'hash', 'unknown-property', 'invalid-json', 'missing-etag', 'uncached-304'])(
    'rejects %s and invalidates metadata instead of combining or falling back',
    (fault) => {
      const meta = load(),
        value: any = body(meta);
      let fallback = false,
        error: RuntimeFailure | undefined;
      client
        .presentation(meta)
        .subscribe({ next: () => (fallback = true), error: (e) => (error = e) });
      const request = http.expectOne(path());
      if (fault === 'id') value.id = 'other';
      if (fault === 'hash') value.definitionHash = 'other';
      if (fault === 'unknown-property') value.presentation.css = 'x';
      if (fault === 'uncached-304')
        request.flush('', { status: 304, statusText: 'Not Modified', headers });
      else
        request.flush(fault === 'invalid-json' ? 'bad-json' : JSON.stringify(value), {
          headers: fault === 'missing-etag' ? { 'Content-Type': 'application/json' } : headers,
        });
      expect(fallback).toBe(false);
      expect(error?.code).toBe('invalid_response');
      client.metadata(R).subscribe();
      expect(http.expectOne(base + P.metadata + '/' + R).request.headers.has(P.conditional)).toBe(
        false,
      );
    },
  );
  it.each(['logout', 'epoch', 'backend'])(
    'never reuses cached documents/ETags after %s',
    (change) => {
      const meta = load();
      client.presentation(meta).subscribe();
      http.expectOne(path()).flush(JSON.stringify(body(meta)), { headers });
      if (change === 'epoch') session.contextChanged();
      else {
        session.clear();
        if (change === 'backend') {
          backend.select('dotnet');
          base = backend.selected().proxyBaseUrl;
        }
        session.establish(backend.selected().id, 'second');
        session.markContextReady();
      }
      TestBed.tick();
      nav();
      const next = load();
      client.presentation(next).subscribe();
      const req = http.expectOne(path());
      expect(req.request.headers.has(P.conditional)).toBe(false);
      req.flush(JSON.stringify(body(next)), { headers });
    },
  );
  it('cancels an in-flight presentation on epoch change and does not accept its old document', () => {
    const meta = load();
    client.presentation(meta).subscribe();
    const pending = http.expectOne(path());
    session.contextChanged();
    TestBed.tick();
    expect(pending.cancelled).toBe(true);
    nav();
  });
  it('invalidates both caches explicitly, including an in-flight presentation', () => {
    const meta = load();
    let error: RuntimeFailure | undefined;
    client.presentation(meta).subscribe({ error: (e) => (error = e) });
    const pending = http.expectOne(path());
    client.invalidateMetadata(R);
    pending.flush(JSON.stringify(body(meta)), { headers });
    expect(error?.code).toBe('invalid_response');
    const next = load();
    client.presentation(next).subscribe();
    const req = http.expectOne(path());
    expect(req.request.headers.has(P.conditional)).toBe(false);
    req.flush(JSON.stringify(body(next)), { headers });
  });
  it('new metadata identity drops the old presentation ETag and requires new matching identity', () => {
    const meta = load();
    client.presentation(meta).subscribe();
    http.expectOne(path()).flush(JSON.stringify(body(meta)), { headers });
    const changed = { ...meta, definitionHash: 'new-hash' };
    let next!: Metadata;
    client.metadata(R, true).subscribe((v) => (next = v));
    http.expectOne(base + P.metadata + '/' + R).flush(JSON.stringify(changed), { headers });
    client.presentation(next).subscribe();
    const req = http.expectOne(path());
    expect(req.request.headers.has(P.conditional)).toBe(false);
    req.flush(JSON.stringify(body(changed)), { headers });
  });
  it('does not restore invalidated metadata from an already pending response', () => {
    let accepted = false;
    client.metadata(R).subscribe({ next: () => (accepted = true), error: () => {} });
    const pending = http.expectOne(base + P.metadata + '/' + R);
    client.invalidateMetadata(R);
    pending.flush(JSON.stringify(fixtureMetadata()), { headers });
    expect(accepted).toBe(false);
  });
  it('uses existing COLLECTION/SELECTION transport scopes and omits collection targets on execution', () => {
    client.actionAvailability(R, { scope: 'COLLECTION' }).subscribe();
    let request = http.expectOne(base + P.actions + '/' + R + '/availability');
    expect(JSON.parse(request.request.body)).toEqual({ scope: 'COLLECTION' });
    request.flush('[]', { headers });
    client.executeAction(R, 'bulk', { scope: 'SELECTION', ids: ['a', 'b'] }, {}).subscribe();
    request = http.expectOne(base + P.actions + '/' + R + '/bulk/execute');
    expect(JSON.parse(request.request.body)).toEqual({
      target: { ids: ['a', 'b'] },
      parameters: {},
    });
    request.flush(null, { status: 204, statusText: 'No Content' });
    client.executeAction(R, 'start', { scope: 'COLLECTION' }, {}).subscribe();
    request = http.expectOne(base + P.actions + '/' + R + '/start/execute');
    expect(JSON.parse(request.request.body)).toEqual({ parameters: {} });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
