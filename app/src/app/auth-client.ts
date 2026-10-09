import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

export interface LoginCredentials {
  readonly email: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly accessToken: string;
}

export class InvalidLoginResponseError extends Error {
  constructor() {
    super('Invalid login response');
    this.name = 'InvalidLoginResponseError';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthClient {
  private readonly http = inject(HttpClient);

  login(baseUrl: string, credentials: LoginCredentials): Observable<LoginResponse> {
    return this.http
      .post<unknown>(
        `${baseUrl}/api/auth/login`,
        { email: credentials.email, password: credentials.password },
        {
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          observe: 'response',
        },
      )
      .pipe(
        map((response) => {
          const body = response.body;
          const contentType = response.headers
            .get('Content-Type')
            ?.split(';')[0]
            ?.trim()
            .toLowerCase();
          if (
            response.status !== 200 ||
            contentType !== 'application/json' ||
            typeof body !== 'object' ||
            body === null ||
            Array.isArray(body) ||
            Object.keys(body).length !== 1 ||
            !('accessToken' in body) ||
            typeof body.accessToken !== 'string' ||
            body.accessToken.length === 0
          ) {
            throw new InvalidLoginResponseError();
          }
          return { accessToken: body.accessToken };
        }),
      );
  }
}
