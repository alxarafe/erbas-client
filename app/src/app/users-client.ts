import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface User {
  readonly id: string;
  readonly email: string;
  readonly enabled: boolean;
  readonly admin: boolean;
}

export interface UsersCollection {
  readonly items: readonly User[];
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly order: readonly { readonly field: 'id'; readonly direction: 'asc' }[];
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

function pagination(offset: unknown, limit: unknown): boolean {
  return (
    typeof offset === 'number' &&
    Number.isInteger(offset) &&
    offset >= 0 &&
    typeof limit === 'number' &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= 100
  );
}

function collection(body: unknown, offset: number, limit: number): body is UsersCollection {
  if (
    !object(body) ||
    !keys(body, ['items', 'offset', 'limit', 'total', 'order']) ||
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
    keys(order, ['field', 'direction']) &&
    order['field'] === 'id' &&
    order['direction'] === 'asc' &&
    body['items'].length === Math.min(limit, Math.max(0, body['total'] - offset)) &&
    body['items'].every(
      (user: unknown) =>
        object(user) &&
        keys(user, ['id', 'email', 'enabled', 'admin']) &&
        typeof user['id'] === 'string' &&
        user['id'].length > 0 &&
        typeof user['email'] === 'string' &&
        user['email'].length > 0 &&
        typeof user['enabled'] === 'boolean' &&
        typeof user['admin'] === 'boolean',
    )
  );
}

@Injectable({ providedIn: 'root' })
export class UsersClient {
  private readonly http = inject(HttpClient);

  list(
    baseUrl: string,
    bearer: string,
    offset: number,
    limit: number,
  ): Observable<UsersCollection> {
    if (!pagination(offset, limit)) throw new RangeError('Invalid users pagination');
    return this.http
      .get<unknown>(`${baseUrl}/api/users`, {
        params: { offset, limit },
        headers: { Accept: 'application/json', Authorization: `Bearer ${bearer}` },
        observe: 'response',
      })
      .pipe(
        map((response) => {
          const contentType = response.headers
            .get('Content-Type')
            ?.split(';')[0]
            ?.trim()
            .toLowerCase();
          if (
            response.status !== 200 ||
            contentType !== 'application/json' ||
            response.headers.get('Cache-Control')?.trim().toLowerCase() !== 'no-store' ||
            !collection(response.body, offset, limit)
          )
            throw new InvalidUsersResponseError();
          return response.body;
        }),
      );
  }
}
