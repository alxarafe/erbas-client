import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpStatusCode,
  provideHttpClient,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { throwError } from 'rxjs';
import {
  AI_ASSISTANT_ENDPOINT,
  AI_ASSISTANT_ERROR_CODES,
  AI_ASSISTANT_FAILURES,
  AI_ASSISTANT_HTTP,
  AI_ASSISTANT_MESSAGE_MAXIMUM,
  AiAssistantClient,
  AiAssistantFailureError,
  InvalidAiAssistantResponseError,
  isAiAssistantInvocationRequest,
} from './ai-assistant-client';

describe('AI assistant client', () => {
  let client: AiAssistantClient;
  let http: HttpTestingController;
  const base = '/backends/any';
  const bearer = 'opaque.test/token==';
  const message = 'List the available units of measure.';
  const headers = {
    [AI_ASSISTANT_HTTP.contentType]: `${AI_ASSISTANT_HTTP.json}; charset=utf-8`,
    [AI_ASSISTANT_HTTP.cacheControl]: AI_ASSISTANT_HTTP.noStore,
  };
  const success = {
    invocationId: 'opaque-ai-invocation',
    answer: 'First line.\nSecond line.',
    toolsUsed: [{ capabilityId: 'wms.uoms.list', invocationId: 'opaque-core-invocation' }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(AiAssistantClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  const send = (body = { message }) => {
    const next = vi.fn();
    const error = vi.fn();
    client.invoke(base, bearer, body).subscribe({ next, error });
    return { next, error, req: http.expectOne(base + AI_ASSISTANT_ENDPOINT) };
  };

  it('posts exactly message with explicit JSON, bearer and Accept headers', () => {
    const { req, next } = send({ message });
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message });
    expect(Object.keys(req.request.body)).toEqual(['message']);
    expect(req.request.headers.get(AI_ASSISTANT_HTTP.accept)).toBe(AI_ASSISTANT_HTTP.json);
    expect(req.request.headers.get(AI_ASSISTANT_HTTP.contentType)).toBe(AI_ASSISTANT_HTTP.json);
    expect(req.request.headers.get(AI_ASSISTANT_HTTP.authorization)).toBe(
      `${AI_ASSISTANT_HTTP.bearer} ${bearer}`,
    );
    expect(req.request.urlWithParams).not.toContain(bearer);
    expect(req.request.urlWithParams).not.toContain(message);
    req.flush(success, { headers });
    expect(next).toHaveBeenCalledExactlyOnceWith(success);
  });

  it.each([
    { ...success, toolsUsed: [] },
    success,
    {
      ...success,
      toolsUsed: [
        { capabilityId: 'wms.uoms.list', invocationId: 'core-one' },
        { capabilityId: 'wms.storage-attributes.list', invocationId: 'core-two' },
      ],
    },
  ])('accepts closed success with any valid tool count %#', (body) => {
    const { req, next } = send();
    req.flush(body, { headers });
    expect(next).toHaveBeenCalledExactlyOnceWith(body);
  });

  it('accepts the DEMO-E2E-001 HTTP 200 READ primitive provenance', () => {
    const body = {
      invocationId: 'debaee97224c4d34a1637667773dab89',
      answer: 'Tenemos 8 portátiles',
      toolsUsed: [
        { primitiveId: 'assets.asset-type.list', invocationId: '0fd215f3e83942ec8bde99c036248bec' },
        { primitiveId: 'assets.asset.list', invocationId: '3db791537f4f46f9817da3013be6f30c' },
      ],
    };
    const { req, next, error } = send();
    req.flush(body, { headers, status: 200, statusText: 'OK' });
    expect(next).toHaveBeenCalledExactlyOnceWith(body);
    expect(error).not.toHaveBeenCalled();
  });

  it('accepts mixed capability and primitive provenance entries', () => {
    const body = {
      ...success,
      toolsUsed: [
        ...success.toolsUsed,
        { primitiveId: 'assets.asset.list', invocationId: 'primitive-one' },
      ],
    };
    const { req, next } = send();
    req.flush(body, { headers });
    expect(next).toHaveBeenCalledExactlyOnceWith(body);
  });

  it.each([
    { primitiveId: 'assets.asset.list' },
    { primitiveId: 'assets.asset.list', invocationId: '' },
    { primitiveId: 'assets.asset.list', invocationId: null },
    { primitiveId: 'assets.asset.list', invocationId: 1 },
    { primitiveId: null, invocationId: 'primitive' },
    { primitiveId: 1, invocationId: 'primitive' },
    { primitiveId: '', invocationId: 'primitive' },
    { primitiveId: 'Assets.asset.list', invocationId: 'primitive' },
    { primitiveId: 'assets..list', invocationId: 'primitive' },
    { primitiveId: 'assets.asset', invocationId: 'primitive' },
    { primitiveId: 'assets.asset.list.extra', invocationId: 'primitive' },
    { primitiveId: 'assets.asset.list\n', invocationId: 'primitive' },
    { primitiveId: 'assets.asset.list', invocationId: 'primitive', extra: true },
    { primitiveId: 'assets.asset.list', capabilityId: 'wms.uoms.list', invocationId: 'both' },
    { primitiveId: 'assets.asset.list', capabilityId: null, invocationId: 'primitive' },
    { capabilityId: 'wms.uoms.list', primitiveId: null, invocationId: 'capability' },
    { capabilityId: null, invocationId: 'capability' },
    { capabilityId: 1, invocationId: 'capability' },
    { capabilityId: 'wms.uoms.list', invocationId: null },
    { capabilityId: 'wms.uoms.list', invocationId: 1 },
  ])('rejects malformed or ambiguous tool provenance %#', (tool) => {
    const { req, next, error } = send();
    req.flush({ ...success, toolsUsed: [tool] }, { headers });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it.each([
    null,
    [],
    'private-detail',
    {},
    { ...success, answer: undefined },
    { ...success, invocationId: undefined },
    { ...success, invocationId: '' },
    { ...success, invocationId: 1 },
    { ...success, answer: '' },
    { ...success, answer: 1 },
    { ...success, extra: 'private-detail' },
    { ...success, toolsUsed: null },
    { ...success, toolsUsed: [null] },
    { ...success, toolsUsed: [{}] },
    { ...success, toolsUsed: [{ capabilityId: 'wms.uoms.list' }] },
    { ...success, toolsUsed: [{ invocationId: 'core' }] },
    {
      ...success,
      toolsUsed: [{ capabilityId: 'wms.uoms.list', invocationId: '' }],
    },
    {
      ...success,
      toolsUsed: [{ capabilityId: 'wms.uoms.list', invocationId: 'core', extra: true }],
    },
    {
      ...success,
      toolsUsed: [{ capabilityId: 'WMS.uoms.list', invocationId: 'core' }],
    },
    {
      ...success,
      toolsUsed: [{ capabilityId: 'wms..list', invocationId: 'core' }],
    },
    {
      ...success,
      toolsUsed: [{ capabilityId: 'wms.uoms', invocationId: 'core' }],
    },
  ])('rejects non-contractual success body %# without partial data', (body) => {
    const { req, next, error } = send();
    req.flush(body, { headers });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it.each([
    { [AI_ASSISTANT_HTTP.contentType]: 'text/plain', [AI_ASSISTANT_HTTP.cacheControl]: 'no-store' },
    { [AI_ASSISTANT_HTTP.contentType]: AI_ASSISTANT_HTTP.json },
    {
      [AI_ASSISTANT_HTTP.contentType]: AI_ASSISTANT_HTTP.json,
      [AI_ASSISTANT_HTTP.cacheControl]: 'public',
    },
    {
      ...headers,
      [AI_ASSISTANT_HTTP.challenge]: AI_ASSISTANT_HTTP.bearer,
    },
  ])('rejects invalid successful HTTP metadata %#', (responseHeaders) => {
    const { req, error } = send();
    req.flush(success, { headers: responseHeaders as Record<string, string> });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it('rejects a successful status other than 200', () => {
    const { req, error } = send();
    req.flush(success, { status: HttpStatusCode.Created, statusText: 'Created', headers });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it('classifies an Angular JSON parse error at status 200 as invalid response', () => {
    const failure = new HttpErrorResponse({
      status: HttpStatusCode.Ok,
      headers: new HttpHeaders(headers),
      error: { error: new SyntaxError(), text: '{bad json' },
    });
    const httpClient = TestBed.inject(HttpClient);
    vi.spyOn(httpClient, 'post').mockReturnValue(throwError(() => failure));
    const error = vi.fn();
    client.invoke(base, bearer, { message }).subscribe({ error });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it.each([
    [
      HttpStatusCode.BadRequest,
      AI_ASSISTANT_ERROR_CODES.invalidRequest,
      AI_ASSISTANT_FAILURES.invalidRequest,
    ],
    [
      HttpStatusCode.Unauthorized,
      AI_ASSISTANT_ERROR_CODES.unauthorized,
      AI_ASSISTANT_FAILURES.unauthorized,
    ],
    [HttpStatusCode.Forbidden, AI_ASSISTANT_ERROR_CODES.forbidden, AI_ASSISTANT_FAILURES.forbidden],
    [
      HttpStatusCode.InternalServerError,
      AI_ASSISTANT_ERROR_CODES.executionFailed,
      AI_ASSISTANT_FAILURES.executionFailed,
    ],
    [
      HttpStatusCode.ServiceUnavailable,
      AI_ASSISTANT_ERROR_CODES.moduleDisabled,
      AI_ASSISTANT_FAILURES.moduleDisabled,
    ],
    [
      HttpStatusCode.ServiceUnavailable,
      AI_ASSISTANT_ERROR_CODES.unavailable,
      AI_ASSISTANT_FAILURES.unavailable,
    ],
  ] as const)('preserves validated %s %s semantics', (status, code, failure) => {
    const { req, error } = send();
    req.flush(
      { code, errors: [{ code }] },
      {
        status,
        statusText: 'Failure',
        headers: {
          ...headers,
          ...(status === HttpStatusCode.Unauthorized
            ? { [AI_ASSISTANT_HTTP.challenge]: AI_ASSISTANT_HTTP.bearer }
            : {}),
        },
      },
    );
    expect(error).toHaveBeenCalledWith(expect.any(AiAssistantFailureError));
    expect((error.mock.calls[0][0] as AiAssistantFailureError).failure).toBe(failure);
  });

  it.each([
    [HttpStatusCode.BadRequest, { code: AI_ASSISTANT_ERROR_CODES.invalidRequest }],
    [HttpStatusCode.BadRequest, { code: AI_ASSISTANT_ERROR_CODES.invalidRequest, errors: [] }],
    [
      HttpStatusCode.BadRequest,
      {
        code: AI_ASSISTANT_ERROR_CODES.invalidRequest,
        errors: [{ code: AI_ASSISTANT_ERROR_CODES.invalidRequest }],
        extra: true,
      },
    ],
    [
      HttpStatusCode.Forbidden,
      {
        code: AI_ASSISTANT_ERROR_CODES.forbidden,
        errors: [{ code: AI_ASSISTANT_ERROR_CODES.forbidden, private: true }],
      },
    ],
    [
      HttpStatusCode.InternalServerError,
      {
        code: AI_ASSISTANT_ERROR_CODES.forbidden,
        errors: [{ code: AI_ASSISTANT_ERROR_CODES.forbidden }],
      },
    ],
    [
      HttpStatusCode.ServiceUnavailable,
      {
        code: 'private-detail',
        errors: [{ code: 'private-detail' }],
      },
    ],
  ])('rejects malformed expected status %s body %#', (status, body) => {
    const { req, error } = send();
    req.flush(body, { status, statusText: 'Failure', headers });
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it.each([
    [HttpStatusCode.Unauthorized, undefined],
    [HttpStatusCode.Unauthorized, 'Basic'],
    [HttpStatusCode.Forbidden, AI_ASSISTANT_HTTP.bearer],
    [HttpStatusCode.ServiceUnavailable, AI_ASSISTANT_HTTP.bearer],
  ] as const)('rejects an invalid challenge for status %s', (status, challenge) => {
    const code =
      status === HttpStatusCode.Unauthorized
        ? AI_ASSISTANT_ERROR_CODES.unauthorized
        : status === HttpStatusCode.Forbidden
          ? AI_ASSISTANT_ERROR_CODES.forbidden
          : AI_ASSISTANT_ERROR_CODES.unavailable;
    const { req, error } = send();
    req.flush(
      { code, errors: [{ code }] },
      {
        status,
        statusText: 'Failure',
        headers: {
          ...headers,
          ...(challenge === undefined ? {} : { [AI_ASSISTANT_HTTP.challenge]: challenge }),
        },
      },
    );
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it.each([
    { [AI_ASSISTANT_HTTP.contentType]: 'text/plain', [AI_ASSISTANT_HTTP.cacheControl]: 'no-store' },
    { [AI_ASSISTANT_HTTP.contentType]: AI_ASSISTANT_HTTP.json },
    {
      [AI_ASSISTANT_HTTP.contentType]: AI_ASSISTANT_HTTP.json,
      [AI_ASSISTANT_HTTP.cacheControl]: 'public',
    },
  ])('rejects invalid expected-error HTTP metadata %#', (responseHeaders) => {
    const { req, error } = send();
    req.flush(
      {
        code: AI_ASSISTANT_ERROR_CODES.executionFailed,
        errors: [{ code: AI_ASSISTANT_ERROR_CODES.executionFailed }],
      },
      {
        status: HttpStatusCode.InternalServerError,
        statusText: 'Failure',
        headers: responseHeaders as Record<string, string>,
      },
    );
    expect(error).toHaveBeenCalledWith(expect.any(InvalidAiAssistantResponseError));
  });

  it('treats 404 as unsupported without interpreting a body', () => {
    const { req, error } = send();
    req.flush('private-detail', {
      status: HttpStatusCode.NotFound,
      statusText: 'Not Found',
      headers: { [AI_ASSISTANT_HTTP.contentType]: 'text/plain' },
    });
    expect(error).toHaveBeenCalledWith(expect.any(AiAssistantFailureError));
    expect((error.mock.calls[0][0] as AiAssistantFailureError).failure).toBe(
      AI_ASSISTANT_FAILURES.unsupported,
    );
  });

  it.each([
    HttpStatusCode.BadGateway,
    HttpStatusCode.TooManyRequests,
    HttpStatusCode.NotAcceptable,
  ])('preserves unexpected status %s as an HTTP failure', (status) => {
    const { req, error } = send();
    req.flush({ code: 'private-detail' }, { status, statusText: 'Failure' });
    expect(error).toHaveBeenCalledWith(expect.any(HttpErrorResponse));
    expect((error.mock.calls[0][0] as HttpErrorResponse).status).toBe(status);
  });

  it('preserves transport failures without inventing semantics', () => {
    const { req, error } = send();
    req.error(new ProgressEvent('error'));
    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).not.toBeInstanceOf(AiAssistantFailureError);
    expect(error.mock.calls[0][0]).not.toBeInstanceOf(InvalidAiAssistantResponseError);
  });

  it.each([
    '',
    ' ',
    ' \t\r\n ',
    'a\u0000b',
    '\ud800',
    '\udc00',
    '\ud800a',
    'a\udc00',
    'a'.repeat(AI_ASSISTANT_MESSAGE_MAXIMUM + 1),
    '😀'.repeat(AI_ASSISTANT_MESSAGE_MAXIMUM + 1),
  ])('rejects invalid message %# before HTTP', (invalid) => {
    expect(() => client.invoke(base, bearer, { message: invalid })).toThrow(RangeError);
    http.expectNone(() => true);
  });

  it.each([null, [], {}, { message: 42 }, { message, history: [] }])(
    'rejects invalid request shape %# before HTTP',
    (body) => {
      expect(() => client.invoke(base, bearer, body as never)).toThrow(RangeError);
      http.expectNone(() => true);
    },
  );

  it.each([
    'a'.repeat(AI_ASSISTANT_MESSAGE_MAXIMUM),
    '😀'.repeat(AI_ASSISTANT_MESSAGE_MAXIMUM),
    '  Preserve this whitespace.\nAnd this line.  ',
  ])('accepts message boundaries and preserves content %#', (valid) => {
    const { req } = send({ message: valid });
    expect(req.request.body).toEqual({ message: valid });
    req.flush({ ...success, toolsUsed: [] }, { headers });
  });

  it('recognizes only the closed request shape', () => {
    expect(isAiAssistantInvocationRequest({ message })).toBe(true);
    expect(isAiAssistantInvocationRequest({ message: ' ' })).toBe(false);
    expect(isAiAssistantInvocationRequest({ message, extra: true })).toBe(false);
  });
});
