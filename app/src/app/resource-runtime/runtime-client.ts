import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
  HttpStatusCode,
  HttpResponse,
} from '@angular/common/http';
import { Observable, Subject, catchError, map, of, takeUntil, throwError } from 'rxjs';
import { AuthSession } from '../auth-session';
import { BackendSelection } from '../backend-selection';
import { ExactNumber, parseExact, stringifyExact } from './exact-json';
import {
  Availability,
  Metadata,
  Navigation,
  Query,
  RESOURCE_PROTOCOL as P,
  Row,
  Scalar,
  metadata,
  navigation,
  object,
  page,
  row,
} from './models';
import { USER_HTTP } from '../users-client';
export interface ErrorDetail {
  code: string;
  path?: string;
  resource?: string;
  resourceId?: string;
}
export class RuntimeFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(code);
  }
}
export function translateFailure(error: unknown): RuntimeFailure {
  if (error instanceof RuntimeFailure) return error;
  if (error instanceof HttpErrorResponse) {
    let body: unknown = error.error;
    try {
      if (typeof body === 'string') body = parseExact(body);
    } catch {
      body = null;
    }
    if (
      object(body) &&
      typeof body['code'] === 'string' &&
      Array.isArray(body['errors']) &&
      body['errors'].length &&
      Object.keys(body).every((key) => ['code', 'errors'].includes(key)) &&
      body['errors'].every(
        (e) =>
          object(e) &&
          typeof e['code'] === 'string' &&
          Object.keys(e).every(
            (key) =>
              ['code', 'path', 'resource', 'resourceId'].includes(key) &&
              typeof e[key] === 'string',
          ),
      )
    )
      return new RuntimeFailure(error.status, body['code'], body['errors'] as ErrorDetail[]);
    return new RuntimeFailure(error.status, 'invalid_response');
  }
  return new RuntimeFailure(0, 'invalid_response');
}
export function failureMessage(error: RuntimeFailure): string {
  switch (error.status) {
    case HttpStatusCode.BadRequest:
      return 'Invalid input. Review the fields or query.';
    case HttpStatusCode.Unauthorized:
      return 'Your session has ended. Sign in again.';
    case HttpStatusCode.Forbidden:
      return 'Access denied.';
    case HttpStatusCode.NotFound:
      return 'Resource or record not found.';
    case HttpStatusCode.Conflict:
      return 'The operation conflicts with the current resource state.';
    default:
      return 'The resource service is unavailable or returned an invalid response.';
  }
}
@Injectable({ providedIn: 'root' })
export class RuntimeClient {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSession);
  private readonly backend = inject(BackendSelection);
  readonly key = computed(() =>
    this.session.contextReady() && this.session.tokenFor(this.backend.selected().id)
      ? this.backend.selected().id + ':' + this.session.contextEpoch()
      : null,
  );
  private readonly reset = new Subject<void>();
  private cache = new Map<string, { key: string; etag: string | null; meta: Metadata }>();
  private readonly nav = signal<{ key: string; etag: string | null; value: Navigation } | null>(
    null,
  );
  readonly navigation = computed(() => (this.nav()?.key === this.key() ? this.nav()!.value : null));
  readonly error = signal<RuntimeFailure | null>(null);
  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.reset.next();
      this.reset.complete();
    });
    effect(() => {
      const key = this.key();
      this.reset.next();
      this.cache.clear();
      this.nav.set(null);
      this.error.set(null);
      if (key) untracked(() => this.revalidateNavigation());
    });
  }
  revalidateNavigation(): void {
    if (!this.key()) return;
    const previous = this.nav();
    this.request('GET', P.navigation, undefined, previous?.etag)
      .pipe(
        map((response) => {
          if (response.status === HttpStatusCode.NotModified) {
            if (!previous) throw new Error('Uncached 304');
            return;
          }
          const value = navigation(parseExact(response.body ?? ''));
          const etag = response.headers.get(P.etag);
          if (etag !== JSON.stringify(value.version)) throw new Error('Invalid navigation ETag');
          this.nav.set({ key: this.key()!, etag, value });
          this.error.set(null);
        }),
      )
      .subscribe({ error: (error) => this.error.set(translateFailure(error)) });
  }
  metadata(resource: string, revalidate = false): Observable<Metadata> {
    const stored = this.cache.get(resource);
    const cached = stored?.key === this.key() ? stored : undefined;
    if (cached && !revalidate) return of(cached.meta);
    return this.request(
      'GET',
      P.metadata + '/' + encodeURIComponent(resource),
      undefined,
      cached?.etag,
    ).pipe(
      map((response) => {
        if (response.status === HttpStatusCode.NotModified) {
          if (!cached) throw new Error('Uncached metadata 304');
          return cached.meta;
        }
        const meta = metadata(parseExact(response.body ?? ''), resource);
        this.cache.set(resource, { key: this.key()!, meta, etag: response.headers.get(P.etag) });
        return meta;
      }),
    );
  }
  list(resource: string, query: Query) {
    let params = new HttpParams().set('offset', query.offset).set('limit', query.limit);
    for (const sort of query.sort) params = params.append('sort', sort);
    for (const filter of query.filters) params = params.append('filter', stringifyExact(filter));
    if (query.search !== undefined && query.search !== '')
      params = params.set('search', query.search);
    return this.request('GET', this.records(resource), undefined, undefined, params).pipe(
      map((response) => page(parseExact(response.body ?? ''))),
    );
  }
  get(resource: string, id: Scalar) {
    return this.request('GET', this.records(resource, id)).pipe(
      map((r) => row(parseExact(r.body ?? ''))),
    );
  }
  save(resource: string, body: Row, id?: Scalar) {
    return this.request(id === undefined ? 'POST' : 'PATCH', this.records(resource, id), body).pipe(
      map((r) => row(parseExact(r.body ?? ''))),
    );
  }
  delete(resource: string, id: Scalar) {
    return this.request('DELETE', this.records(resource, id));
  }
  availability(resource: string, id: Scalar): Observable<Availability[]> {
    return this.request('POST', P.actions + '/' + encodeURIComponent(resource) + '/availability', {
      scope: 'ENTITY',
      id,
    }).pipe(
      map((r) => {
        const value = parseExact(r.body ?? '');
        if (
          !Array.isArray(value) ||
          !value.every(
            (v) =>
              object(v) &&
              typeof v['name'] === 'string' &&
              typeof v['authorized'] === 'boolean' &&
              typeof v['available'] === 'boolean',
          )
        )
          throw new Error('Invalid availability');
        return value as Availability[];
      }),
    );
  }
  execute(resource: string, action: string, id: Scalar, parameters: Row) {
    return this.request(
      'POST',
      P.actions +
        '/' +
        encodeURIComponent(resource) +
        '/' +
        encodeURIComponent(action) +
        '/execute',
      { target: { id }, parameters },
    );
  }
  private records(resource: string, id?: Scalar): string {
    return (
      P.records +
      '/' +
      encodeURIComponent(resource) +
      (id === undefined
        ? ''
        : '/' + encodeURIComponent(id instanceof ExactNumber ? id.text : String(id)))
    );
  }
  private request(
    method: string,
    path: string,
    body?: unknown,
    etag?: string | null,
    params?: HttpParams,
  ) {
    const key = this.key();
    if (!key)
      return throwError(() => new RuntimeFailure(HttpStatusCode.Unauthorized, 'unauthorized'));
    let headers = new HttpHeaders({
      [USER_HTTP.authorization]:
        USER_HTTP.bearer + ' ' + this.session.tokenFor(this.backend.selected().id),
      [USER_HTTP.accept]: USER_HTTP.json,
    });
    if (body !== undefined) headers = headers.set(USER_HTTP.contentType, USER_HTTP.json);
    if (etag) headers = headers.set(P.conditional, etag);
    return this.http
      .request(method, this.backend.selected().proxyBaseUrl + path, {
        headers,
        params,
        body: body === undefined ? undefined : stringifyExact(body),
        observe: 'response',
        responseType: 'text',
      })
      .pipe(
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotModified
            ? of(
                new HttpResponse<string>({
                  status: HttpStatusCode.NotModified,
                  headers: error.headers,
                }),
              )
            : throwError(() => error),
        ),
        takeUntil(this.reset),
        map((response) => {
          if (key !== this.key()) throw new Error('Context changed');
          if (
            response.status !== HttpStatusCode.NoContent &&
            response.status !== HttpStatusCode.NotModified &&
            response.headers.get(USER_HTTP.contentType)?.split(';')[0]?.trim() !== USER_HTTP.json
          )
            throw new Error('Invalid media type');
          return response;
        }),
        catchError((error: unknown) => {
          const failure = translateFailure(error);
          if (failure.status === HttpStatusCode.Unauthorized) this.session.clear();
          return throwError(() => failure);
        }),
      );
  }
}
