import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpResponse, HttpStatusCode } from '@angular/common/http';
import { Observable, catchError, map, throwError } from 'rxjs';

export const AI_ASSISTANT_ENDPOINT = '/api/ai/assistant/invocations';
export const AI_ASSISTANT_MESSAGE_MAXIMUM = 4000;
export const AI_ASSISTANT_HTTP = {
  accept: 'Accept',
  authorization: 'Authorization',
  contentType: 'Content-Type',
  cacheControl: 'Cache-Control',
  challenge: 'WWW-Authenticate',
  json: 'application/json',
  noStore: 'no-store',
  bearer: 'Bearer',
} as const;

export const AI_ASSISTANT_ERROR_CODES = {
  invalidRequest: 'invalid_request',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  executionFailed: 'assistant_execution_failed',
  moduleDisabled: 'module_disabled',
  unavailable: 'assistant_unavailable',
} as const;

export const AI_ASSISTANT_FAILURES = {
  invalidRequest: 'invalid-request',
  unauthorized: 'unauthorized',
  forbidden: 'forbidden',
  unsupported: 'unsupported',
  executionFailed: 'execution-failed',
  moduleDisabled: 'module-disabled',
  unavailable: 'unavailable',
} as const;

export type AiAssistantFailure = (typeof AI_ASSISTANT_FAILURES)[keyof typeof AI_ASSISTANT_FAILURES];

export interface AiAssistantInvocationRequest {
  readonly message: string;
}

export interface AiAssistantToolUsage {
  readonly capabilityId: string;
  readonly invocationId: string;
}

export interface AiAssistantInvocation {
  readonly invocationId: string;
  readonly answer: string;
  readonly toolsUsed: readonly AiAssistantToolUsage[];
}

export class InvalidAiAssistantResponseError extends Error {
  constructor() {
    super('Invalid AI assistant response');
    this.name = 'InvalidAiAssistantResponseError';
  }
}

export class AiAssistantFailureError extends Error {
  constructor(readonly failure: AiAssistantFailure) {
    super(`AI assistant failure: ${failure}`);
    this.name = 'AiAssistantFailureError';
  }
}

const REQUEST_FIELDS = ['message'];
const INVOCATION_FIELDS = ['invocationId', 'answer', 'toolsUsed'];
const TOOL_FIELDS = ['capabilityId', 'invocationId'];
const ERROR_FIELDS = ['code', 'errors'];
const ERROR_DETAIL_OPTIONAL_FIELDS = ['resource', 'resourceId', 'path'];
const CAPABILITY_ID_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?![\s\S])/;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return (
    Object.keys(value).length === expected.length &&
    expected.every((key) => Object.hasOwn(value, key))
  );
}

function nonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function validMessage(message: string): boolean {
  let scalars = 0;
  for (let index = 0; index < message.length; index++) {
    const unit = message.charCodeAt(index);
    if (unit === 0) return false;
    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = message.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      index++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) return false;
    if (++scalars > AI_ASSISTANT_MESSAGE_MAXIMUM) return false;
  }
  return /\S/u.test(message);
}

export function isAiAssistantInvocationRequest(
  value: unknown,
): value is AiAssistantInvocationRequest {
  return (
    object(value) &&
    keys(value, REQUEST_FIELDS) &&
    typeof value['message'] === 'string' &&
    validMessage(value['message'])
  );
}

function validToolUsage(value: unknown): value is AiAssistantToolUsage {
  return (
    object(value) &&
    keys(value, TOOL_FIELDS) &&
    typeof value['capabilityId'] === 'string' &&
    CAPABILITY_ID_PATTERN.test(value['capabilityId']) &&
    nonemptyString(value['invocationId'])
  );
}

function validInvocation(value: unknown): value is AiAssistantInvocation {
  return (
    object(value) &&
    keys(value, INVOCATION_FIELDS) &&
    nonemptyString(value['invocationId']) &&
    nonemptyString(value['answer']) &&
    Array.isArray(value['toolsUsed']) &&
    value['toolsUsed'].every(validToolUsage)
  );
}

function validErrorDetail(value: unknown, code: string): boolean {
  if (!object(value) || value['code'] !== code) return false;
  const fields = Object.keys(value);
  return (
    fields.every((field) => field === 'code' || ERROR_DETAIL_OPTIONAL_FIELDS.includes(field)) &&
    fields.every((field) => field === 'code' || typeof value[field] === 'string')
  );
}

function validErrorBody(value: unknown, code: string): boolean {
  return (
    object(value) &&
    keys(value, ERROR_FIELDS) &&
    value['code'] === code &&
    Array.isArray(value['errors']) &&
    value['errors'].length === 1 &&
    validErrorDetail(value['errors'][0], code)
  );
}

function validHttp(
  response: HttpResponse<unknown> | HttpErrorResponse,
  status = HttpStatusCode.Ok,
): boolean {
  return (
    response.status === status &&
    response.headers.get(AI_ASSISTANT_HTTP.contentType)?.split(';')[0]?.trim().toLowerCase() ===
      AI_ASSISTANT_HTTP.json &&
    response.headers.get(AI_ASSISTANT_HTTP.cacheControl)?.trim().toLowerCase() ===
      AI_ASSISTANT_HTTP.noStore &&
    (status === HttpStatusCode.Unauthorized
      ? response.headers.get(AI_ASSISTANT_HTTP.challenge) === AI_ASSISTANT_HTTP.bearer
      : !response.headers.has(AI_ASSISTANT_HTTP.challenge))
  );
}

function validError(error: HttpErrorResponse, code: string): boolean {
  return validHttp(error, error.status) && validErrorBody(error.error, code);
}

function invalidResponse(): Observable<never> {
  return throwError(() => new InvalidAiAssistantResponseError());
}

function failure(kind: AiAssistantFailure): Observable<never> {
  return throwError(() => new AiAssistantFailureError(kind));
}

function headers(bearer: string): Record<string, string> {
  return {
    [AI_ASSISTANT_HTTP.accept]: AI_ASSISTANT_HTTP.json,
    [AI_ASSISTANT_HTTP.authorization]: `${AI_ASSISTANT_HTTP.bearer} ${bearer}`,
    [AI_ASSISTANT_HTTP.contentType]: AI_ASSISTANT_HTTP.json,
  };
}

@Injectable({ providedIn: 'root' })
export class AiAssistantClient {
  private readonly http = inject(HttpClient);

  invoke(
    baseUrl: string,
    bearer: string,
    request: AiAssistantInvocationRequest,
  ): Observable<AiAssistantInvocation> {
    if (!isAiAssistantInvocationRequest(request))
      throw new RangeError('Invalid AI assistant request');
    return this.http
      .post<unknown>(
        `${baseUrl}${AI_ASSISTANT_ENDPOINT}`,
        { message: request.message },
        {
          headers: headers(bearer),
          observe: 'response',
        },
      )
      .pipe(
        map((response) => {
          if (!validHttp(response) || !validInvocation(response.body))
            throw new InvalidAiAssistantResponseError();
          return response.body;
        }),
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse) {
            if (error.status === HttpStatusCode.Ok) return invalidResponse();
            if (error.status === HttpStatusCode.NotFound)
              return failure(AI_ASSISTANT_FAILURES.unsupported);
            switch (error.status) {
              case HttpStatusCode.BadRequest:
                return validError(error, AI_ASSISTANT_ERROR_CODES.invalidRequest)
                  ? failure(AI_ASSISTANT_FAILURES.invalidRequest)
                  : invalidResponse();
              case HttpStatusCode.Unauthorized:
                return validError(error, AI_ASSISTANT_ERROR_CODES.unauthorized)
                  ? failure(AI_ASSISTANT_FAILURES.unauthorized)
                  : invalidResponse();
              case HttpStatusCode.Forbidden:
                return validError(error, AI_ASSISTANT_ERROR_CODES.forbidden)
                  ? failure(AI_ASSISTANT_FAILURES.forbidden)
                  : invalidResponse();
              case HttpStatusCode.InternalServerError:
                return validError(error, AI_ASSISTANT_ERROR_CODES.executionFailed)
                  ? failure(AI_ASSISTANT_FAILURES.executionFailed)
                  : invalidResponse();
              case HttpStatusCode.ServiceUnavailable:
                if (validError(error, AI_ASSISTANT_ERROR_CODES.moduleDisabled))
                  return failure(AI_ASSISTANT_FAILURES.moduleDisabled);
                if (validError(error, AI_ASSISTANT_ERROR_CODES.unavailable))
                  return failure(AI_ASSISTANT_FAILURES.unavailable);
                return invalidResponse();
            }
          }
          return throwError(() => error);
        }),
      );
  }
}
