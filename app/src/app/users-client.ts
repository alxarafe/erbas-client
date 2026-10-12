import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

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
  challenge: 'WWW-Authenticate',
} as const;

export const USER_PASSWORD_LENGTH = { minimum: 12, maximum: 256 } as const;
export interface CreateUserRequest {
  readonly email: string;
  readonly password: string;
  readonly admin: boolean;
}
const USER_PROTECTED_ERRORS = {
  [HttpStatusCode.BadRequest]: 'invalid_request',
  [HttpStatusCode.Unauthorized]: 'unauthorized',
  [HttpStatusCode.Forbidden]: 'forbidden',
} as const;
export const USER_CREATE_ERRORS = {
  ...USER_PROTECTED_ERRORS,
  [HttpStatusCode.Conflict]: 'email_conflict',
} as const;
const CREATE_FIELDS: readonly (keyof CreateUserRequest)[] = ['email', 'password', 'admin'];
export interface UpdateUserRequest {
  readonly enabled?: boolean;
  readonly admin?: boolean;
}
const USER_UPDATE_FIELDS: readonly (keyof UpdateUserRequest)[] = ['enabled', 'admin'];
export const USER_UPDATE_ERRORS = {
  ...USER_PROTECTED_ERRORS,
  [HttpStatusCode.NotFound]: 'user_not_found',
  [HttpStatusCode.Conflict]: 'last_admin',
} as const;
export function isUpdateUserRequest(value: unknown): value is UpdateUserRequest {
  if (!object(value)) return false;
  const fields = Object.keys(value);
  return (
    fields.length > 0 &&
    fields.length <= USER_UPDATE_FIELDS.length &&
    fields.every(
      (field) =>
        USER_UPDATE_FIELDS.includes(field as keyof UpdateUserRequest) &&
        typeof value[field] === 'boolean',
    )
  );
}
const ERROR_FIELDS = ['code'];

export function isCreateUserRequest(value: unknown): value is CreateUserRequest {
  if (
    !object(value) ||
    !keys(value, CREATE_FIELDS) ||
    typeof value['email'] !== 'string' ||
    value['email'].length === 0 ||
    typeof value['password'] !== 'string' ||
    typeof value['admin'] !== 'boolean'
  )
    return false;
  const length = Array.from(value['password']).length;
  return length >= USER_PASSWORD_LENGTH.minimum && length <= USER_PASSWORD_LENGTH.maximum;
}

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

function validHttp(
  response: HttpResponse<unknown> | HttpErrorResponse,
  status = HttpStatusCode.Ok,
): boolean {
  return (
    response.status === status &&
    response.headers.get(USER_HTTP.contentType)?.split(';')[0]?.trim().toLowerCase() ===
      USER_HTTP.json &&
    response.headers.get(USER_HTTP.cacheControl)?.trim().toLowerCase() === USER_HTTP.noStore
  );
}
function validProtectedError(error: HttpErrorResponse, code: string): boolean {
  return (
    validHttp(error, error.status) &&
    object(error.error) &&
    keys(error.error, ERROR_FIELDS) &&
    error.error['code'] === code &&
    (error.status !== HttpStatusCode.Unauthorized ||
      error.headers.get(USER_HTTP.challenge) === USER_HTTP.bearer) &&
    (error.status !== HttpStatusCode.Forbidden || !error.headers.has(USER_HTTP.challenge))
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

  create(baseUrl: string, bearer: string, request: CreateUserRequest): Observable<User> {
    if (!isCreateUserRequest(request)) throw new RangeError('Invalid create-user request');
    // Capture only public expectations; never retain the password in response validation.
    const { email, admin } = request;
    return this.http
      .post<unknown>(
        `${baseUrl}${USERS_ENDPOINT}`,
        { email, password: request.password, admin },
        {
          headers: { ...headers(bearer), [USER_HTTP.contentType]: USER_HTTP.json },
          observe: 'response',
        },
      )
      .pipe(
        map((response) => {
          if (response.status !== HttpStatusCode.Created && response.status !== HttpStatusCode.Ok)
            throw new HttpErrorResponse({ status: response.status });
          if (
            !validHttp(response, HttpStatusCode.Created) ||
            !isUser(response.body) ||
            !response.body.enabled ||
            response.body.email !== email ||
            response.body.admin !== admin
          )
            throw new InvalidUsersResponseError();
          return response.body;
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            const code = USER_CREATE_ERRORS[error.status as keyof typeof USER_CREATE_ERRORS];
            if (
              error.status === HttpStatusCode.Created ||
              (code !== undefined && !validProtectedError(error, code))
            )
              return throwError(() => new InvalidUsersResponseError());
          }
          return throwError(() => error);
        }),
      );
  }

  update(
    baseUrl: string,
    bearer: string,
    id: string,
    request: UpdateUserRequest,
  ): Observable<User> {
    if (typeof id !== 'string' || id.length === 0) throw new RangeError('User ID must be nonempty');
    if (!isUpdateUserRequest(request)) throw new RangeError('Invalid update-user request');
    const body = { ...request };
    return this.http
      .patch<unknown>(`${baseUrl}${USERS_ENDPOINT}/${encodeURIComponent(id)}`, body, {
        headers: {
          ...headers(bearer),
          [USER_HTTP.contentType]: USER_HTTP.json,
        },
        observe: 'response',
      })
      .pipe(
        map((response) => {
          const user = response.body;
          if (
            !validHttp(response) ||
            !isUser(user) ||
            user.id !== id ||
            USER_UPDATE_FIELDS.some(
              (field) => Object.hasOwn(body, field) && user[field] !== body[field],
            )
          )
            throw new InvalidUsersResponseError();
          return user;
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            const code = USER_UPDATE_ERRORS[error.status as keyof typeof USER_UPDATE_ERRORS];
            if (
              error.status === HttpStatusCode.Ok ||
              (code !== undefined && !validProtectedError(error, code))
            )
              return throwError(() => new InvalidUsersResponseError());
          }
          return throwError(() => error);
        }),
      );
  }

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
