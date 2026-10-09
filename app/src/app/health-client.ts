import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, timeout } from 'rxjs';

export interface HealthResponse {
  readonly status: 'ok';
}

@Injectable({ providedIn: 'root' })
export class HealthClient {
  private readonly http = inject(HttpClient);

  check(baseUrl: string): Observable<HealthResponse> {
    return this.http
      .get<unknown>(`${baseUrl}/health`, {
        headers: { Accept: 'application/json' },
        observe: 'response',
      })
      .pipe(
        timeout(7000),
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
            !('status' in body) ||
            body.status !== 'ok'
          ) {
            throw new Error('Invalid health response');
          }
          return { status: 'ok' };
        }),
      );
  }
}
