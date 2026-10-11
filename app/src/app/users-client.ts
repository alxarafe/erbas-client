import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { Observable, map } from 'rxjs';

// Shared protected-user protocol values; neither IDs nor bearers are interpreted.
export const USERS_ENDPOINT = '/api/users';
export const CURRENT_USER_ENDPOINT = '/api/auth/me';
export const USERS_PAGE_SIZE = 50;
export const USERS_MAX_LIMIT = 100;
export const USER_HTTP = {
  accept: 'Accept',
  authorization: 'Authorization',
  contentType: 'Content-Type',
  cacheControl: 'Cache-Control',
  json: 'application/json',
  noStore: 'no-store',
  bearer: 'Bearer',
} as const;

export interface User {
  readonly id: string;
  readonly email: string;
  readonly enabled: boolean;
  readonly admin: boolean;
}
const USER_FIELDS: readonly (keyof User)[] = ['id', 'email', 'enabled', 'admin'];
const COLLECTION_FIELDS = ['items', 'offset', 'limit', 'total', 'order'];
const ORDER_FIELDS = ['field', 'direction'];
const USER_ORDER = { field: 'id', direction: 'asc' } as const;

export interface UsersCollection {
  readonly items: readonly User[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly order: readonly (typeof USER_ORDER)[];
}

export class InvalidUsersResponseError extends Error {
  constructor() {
    super('Invalid users response');
    this.name = 'InvalidUsersResponseError';
  }
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

export function isUser(value: unknown): value is User {
  return (
    object(value) &&
    keys(value, USER_FIELDS) &&
    typeof value['id'] === 'string' &&
    value['id'].length > 0 &&
    typeof value['email'] === 'string' &&
    value['email'].length > 0 &&
    typeof value['enabled'] === 'boolean' &&
    typeof value['admin'] === 'boolean'
  );
}

function pagination(offset: unknown, limit: unknown): boolean {
  return (
    typeof offset === 'number' &&
    Number.isInteger(offset) &&
    offset >= 0 &&
    typeof limit === 'number' &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= USERS_MAX_LIMIT
  );
}

function collection(body: unknown, offset: number, limit: number): body is UsersCollection {
  if (
    !object(body) ||
    !keys(body, COLLECTION_FIELDS) ||
    !pagination(body['offset'], body['limit']) ||
    body['offset'] !== offset ||
    body['limit'] !== limit ||
    typeof body['total'] !== 'number' ||
    !Number.isInteger(body['total']) ||
    body['total'] < 0 ||
    !Array.isArray(body['items']) ||
    !Array.isArray(body['order']) ||
    body['order'].length !== 1
  )
    return false;
  const order = body['order'][0];
  return (
    object(order) &&
    keys(order, ORDER_FIELDS) &&
    order['field'] === USER_ORDER.field &&
    order['direction'] === USER_ORDER.direction &&
    body['items'].length === Math.min(limit, Math.max(0, body['total'] - offset)) &&
    body['items'].every(isUser)
  );
}

function validHttp(response: HttpResponse<unknown>): boolean {
  return (
    response.status === HttpStatusCode.Ok &&
    response.headers.get(USER_HTTP.contentType)?.split(';')[0]?.trim().toLowerCase() ===
      USER_HTTP.json &&
    response.headers.get(USER_HTTP.cacheControl)?.trim().toLowerCase() === USER_HTTP.noStore
  );
}
function headers(bearer: string): Record<string, string> {
  return {
    [USER_HTTP.accept]: USER_HTTP.json,
    [USER_HTTP.authorization]: `${USER_HTTP.bearer} ${bearer}`,
  };
}

@Injectable({ providedIn: 'root' })
export class UsersClient {
  private readonly http = inject(HttpClient);

  current(baseUrl: string, bearer: string): Observable<User> {
    return this.readUser(`${baseUrl}${CURRENT_USER_ENDPOINT}`, bearer);
  }

  detail(baseUrl: string, bearer: string, id: string): Observable<User> {
    if (id.length === 0) throw new RangeError('User ID must be nonempty');
    // encodeURIComponent keeps the opaque ID in one path segment, including /, ? and #.
    return this.readUser(`${baseUrl}${USERS_ENDPOINT}/${encodeURIComponent(id)}`, bearer);
  }

  private readUser(url: string, bearer: string): Observable<User> {
    return this.http.get<unknown>(url, { headers: headers(bearer), observe: 'response' }).pipe(
      map((response) => {
        if (!validHttp(response) || !isUser(response.body)) throw new InvalidUsersResponseError();
        return response.body;
      }),
    );
  }

  list(
    baseUrl: string,
    bearer: string,
    offset: number,
    limit: number,
  ): Observable<UsersCollection> {
    if (!pagination(offset, limit)) throw new RangeError('Invalid users pagination');
    return this.http
      .get<unknown>(`${baseUrl}${USERS_ENDPOINT}`, {
        params: { offset, limit },
        headers: headers(bearer),
        observe: 'response',
      })
      .pipe(
        map((response) => {
          if (!validHttp(response) || !collection(response.body, offset, limit))
            throw new InvalidUsersResponseError();
          return response.body;
        }),
      );
  }
}
