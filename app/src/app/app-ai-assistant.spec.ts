import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpStatusCode, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { AuthSession } from './auth-session';
import {
  AI_ASSISTANT_ENDPOINT,
  AI_ASSISTANT_ERROR_CODES,
  AI_ASSISTANT_HTTP,
  AI_ASSISTANT_MESSAGE_MAXIMUM,
  AiAssistantInvocation,
} from './ai-assistant-client';
import { AiAssistantState } from './ai-assistant-state';
import { CURRENT_USER_ENDPOINT, USER_HTTP } from './users-client';

describe('AI assistant UI', () => {
  let fixture: ComponentFixture<App>;
  let page: HTMLElement;
  let http: HttpTestingController;
  let session: AuthSession;
  const token = 'opaque-assistant-token';
  const admin = {
    id: 'opaque-admin',
    email: 'admin@example.test',
    enabled: true,
    admin: true,
  };
  const headers = {
    [AI_ASSISTANT_HTTP.contentType]: AI_ASSISTANT_HTTP.json,
    [AI_ASSISTANT_HTTP.cacheControl]: AI_ASSISTANT_HTTP.noStore,
  };
  const success: AiAssistantInvocation = {
    invocationId: 'opaque-ai-invocation',
    answer: 'First line.\nSecond line.',
    toolsUsed: [{ capabilityId: 'wms.uoms.list', invocationId: 'opaque-core-invocation' }],
  };
  const app = () => fixture.componentInstance;
  const backend = () => app().selection.selected().id;
  const assistant = (selected = 'java') =>
    http.expectOne(`/backends/${selected}${AI_ASSISTANT_ENDPOINT}`);
  const textarea = () => page.querySelector<HTMLTextAreaElement>('#assistant-message')!;
  const submit = (value: string) => {
    textarea().value = value;
    page.querySelector('#assistant-form')!.dispatchEvent(new Event('submit', { cancelable: true }));
  };
  const health = (selected: string) =>
    http
      .expectOne(`/backends/${selected}/health`)
      .flush({ status: 'ok' }, { headers: { 'Content-Type': 'application/json' } });
  const switchTo = async (selected: string) => {
    const select = page.querySelector<HTMLSelectElement>('#backend')!;
    select.value = selected;
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    health(selected);
    await fixture.whenStable();
  };
  const login = async (selected = 'java', profile = admin) => {
    page.querySelector<HTMLInputElement>('#email')!.value = profile.email;
    page.querySelector<HTMLInputElement>('#password')!.value = 'fictitious-password';
    page.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    http
      .expectOne(`/backends/${selected}/api/auth/login`)
      .flush({ accessToken: token }, { headers });
    http.expectOne(`/backends/${selected}${CURRENT_USER_ENDPOINT}`).flush(profile, {
      headers: {
        [USER_HTTP.contentType]: USER_HTTP.json,
        [USER_HTTP.cacheControl]: USER_HTTP.noStore,
      },
    });
    await fixture.whenStable();
  };
  const fail = (
    status: HttpStatusCode,
    code: string,
    selected = backend(),
    body: unknown = { code, errors: [{ code }] },
  ) =>
    assistant(selected).flush(body as object | string | null, {
      status,
      statusText: 'Failure',
      headers: {
        ...headers,
        ...(status === HttpStatusCode.Unauthorized
          ? { [AI_ASSISTANT_HTTP.challenge]: AI_ASSISTANT_HTTP.bearer }
          : {}),
      },
    });

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSession);
    fixture = TestBed.createComponent(App);
    page = fixture.nativeElement;
    await fixture.whenStable();
    http.expectOne('/demo/defaults.env').flush('', { status: 404, statusText: 'Not Found' });
    health('java');
    await fixture.whenStable();
  });
  afterEach(() => http.verify());

  it('renders the unauthenticated assistant without a form or protected request', () => {
    expect(page.querySelector('#assistant-heading')?.textContent).toBe('ERBAS Assistant');
    expect(page.textContent).toContain(
      'The assistant answers using the effective READ capabilities available to your account.',
    );
    expect(page.textContent).toContain('Authentication is required to use the ERBAS Assistant');
    expect(page.querySelector('#assistant-form')).toBeNull();
    expect(page.querySelector('label[for="assistant-message"]')).toBeNull();
    http.expectNone((req) => req.url.endsWith(AI_ASSISTANT_ENDPOINT));
  });

  it.each(['java', 'dotnet'])(
    'sends the exact message with the %s bearer and renders only the answer',
    async (selected) => {
      if (selected !== 'java') await switchTo(selected);
      await login(selected);
      expect(page.querySelector('label[for="assistant-message"]')?.textContent).toBe(
        'What do you need?',
      );
      expect(textarea().rows).toBe(4);
      expect(page.textContent).toContain(`Up to ${AI_ASSISTANT_MESSAGE_MAXIMUM} Unicode`);
      submit('  List the available units.\nKeep this spacing.  ');
      await fixture.whenStable();
      expect(app().assistantState()).toBe(AiAssistantState.Submitting);
      expect(page.querySelector<HTMLButtonElement>('#assistant-form button')!.disabled).toBe(true);
      expect(page.querySelector('#assistant-form')!.getAttribute('aria-busy')).toBe('true');
      const request = assistant(selected);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({
        message: '  List the available units.\nKeep this spacing.  ',
      });
      expect(request.request.headers.get(AI_ASSISTANT_HTTP.accept)).toBe(AI_ASSISTANT_HTTP.json);
      expect(request.request.headers.get(AI_ASSISTANT_HTTP.contentType)).toBe(
        AI_ASSISTANT_HTTP.json,
      );
      expect(request.request.headers.get(AI_ASSISTANT_HTTP.authorization)).toBe(
        `${AI_ASSISTANT_HTTP.bearer} ${token}`,
      );
      request.flush(success, { headers });
      await fixture.whenStable();
      expect(app().assistantState()).toBe(AiAssistantState.Answered);
      expect(app().assistantAnswer()).toBe(success.answer);
      expect(page.querySelector('.assistant-answer')?.textContent).toBe(success.answer);
      expect(textarea().value).toBe('');
      expect(page.textContent).not.toContain(token);
      expect(page.textContent).not.toContain('wms.uoms.list');
      expect(page.textContent).not.toContain('opaque-core-invocation');
      expect(session.tokenFor(selected)).toBe(token);
    },
  );

  it('rejects invalid messages locally and preserves them for correction', async () => {
    await login();
    for (const value of [
      '',
      ' \t\n ',
      'a\u0000b',
      '\ud800',
      'a'.repeat(AI_ASSISTANT_MESSAGE_MAXIMUM + 1),
    ]) {
      submit(value);
      await fixture.whenStable();
      expect(app().assistantState()).toBe(AiAssistantState.InvalidRequest);
      expect(app().assistantAnswer()).toBeNull();
      expect(textarea().value).toBe(value);
      expect(page.textContent).toContain('Enter a nonempty message');
      http.expectNone((req) => req.url.endsWith(AI_ASSISTANT_ENDPOINT));
    }
  });

  it.each([
    [
      HttpStatusCode.BadRequest,
      AI_ASSISTANT_ERROR_CODES.invalidRequest,
      AiAssistantState.InvalidRequest,
      true,
    ],
    [
      HttpStatusCode.Unauthorized,
      AI_ASSISTANT_ERROR_CODES.unauthorized,
      AiAssistantState.Unauthorized,
      false,
    ],
    [
      HttpStatusCode.Forbidden,
      AI_ASSISTANT_ERROR_CODES.forbidden,
      AiAssistantState.Forbidden,
      true,
    ],
    [HttpStatusCode.NotFound, 'not-a-contractual-404', AiAssistantState.Unsupported, true],
    [
      HttpStatusCode.InternalServerError,
      AI_ASSISTANT_ERROR_CODES.executionFailed,
      AiAssistantState.ExecutionFailed,
      true,
    ],
    [
      HttpStatusCode.ServiceUnavailable,
      AI_ASSISTANT_ERROR_CODES.moduleDisabled,
      AiAssistantState.ModuleDisabled,
      true,
    ],
    [
      HttpStatusCode.ServiceUnavailable,
      AI_ASSISTANT_ERROR_CODES.unavailable,
      AiAssistantState.Unavailable,
      true,
    ],
  ] as const)(
    'maps %s to safe %s feedback while authenticated=%s',
    async (status, code, state, authenticated) => {
      await login();
      submit('private user message');
      await fixture.whenStable();
      const body =
        status === HttpStatusCode.NotFound
          ? 'private-backend-detail'
          : { code, errors: [{ code }] };
      fail(status, code, 'java', body);
      await fixture.whenStable();
      expect(app().assistantState()).toBe(state);
      expect(app().assistantAnswer()).toBeNull();
      expect(session.authenticated()).toBe(authenticated);
      if (authenticated) {
        expect(session.tokenFor('java')).toBe(token);
        expect(app().currentUser()).toEqual(admin);
        expect(textarea().value).toBe('private user message');
      } else {
        expect(session.tokenFor('java')).toBeNull();
        expect(app().currentUser()).toBeNull();
        expect(page.querySelector('#assistant-form')).toBeNull();
        expect(page.querySelector('#assistant-message')).toBeNull();
      }
      expect(page.textContent).not.toContain('private-backend-detail');
      expect(page.textContent).not.toContain(code);
    },
  );

  it('reports a malformed success as invalid response without retaining details', async () => {
    await login();
    submit('Answer this.');
    await fixture.whenStable();
    assistant().flush({ ...success, private: 'private-backend-detail' }, { headers });
    await fixture.whenStable();
    expect(app().assistantState()).toBe(AiAssistantState.InvalidResponse);
    expect(app().assistantAnswer()).toBeNull();
    expect(textarea().value).toBe('Answer this.');
    expect(page.textContent).toContain('invalid assistant response');
    expect(page.textContent).not.toContain('private-backend-detail');
    expect(session.authenticated()).toBe(true);
  });

  it('reports transport failure as temporarily unavailable and permits retry', async () => {
    await login();
    submit('Answer this.');
    await fixture.whenStable();
    assistant().error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(app().assistantState()).toBe(AiAssistantState.Unavailable);
    expect(session.authenticated()).toBe(true);
    expect(textarea().value).toBe('Answer this.');
    submit('Answer this.');
    await fixture.whenStable();
    assistant().flush(success, { headers });
    await fixture.whenStable();
    expect(app().assistantState()).toBe(AiAssistantState.Answered);
  });

  it('cancels a previous submission and rejects its stale response', async () => {
    await login();
    submit('First question.');
    await fixture.whenStable();
    const first = assistant();
    submit('Second question.');
    await fixture.whenStable();
    expect(first.cancelled).toBe(true);
    expect(() => first.flush(success, { headers })).toThrow('cancelled');
    const second = assistant();
    expect(second.request.body).toEqual({ message: 'Second question.' });
    second.flush({ ...success, answer: 'Second answer.' }, { headers });
    await fixture.whenStable();
    expect(app().assistantAnswer()).toBe('Second answer.');
    expect(app().assistantState()).toBe(AiAssistantState.Answered);
  });

  it.each(['answer', 'pending'])(
    'backend switch cancels %s state and requires a new session',
    async (phase) => {
      await login();
      if (phase === 'answer') {
        submit('First question.');
        await fixture.whenStable();
        assistant().flush(success, { headers });
        await fixture.whenStable();
        expect(app().assistantAnswer()).toBe(success.answer);
      } else {
        submit('Pending question.');
        await fixture.whenStable();
      }
      const pending = phase === 'pending' ? assistant() : null;
      await switchTo('dotnet');
      if (pending) expect(pending.cancelled).toBe(true);
      expect(session.authenticated()).toBe(false);
      expect(app().assistantAnswer()).toBeNull();
      expect(app().assistantState()).toBe(AiAssistantState.Idle);
      expect(page.querySelector('#assistant-form')).toBeNull();
      expect(page.textContent).not.toContain(success.answer);
    },
  );

  it('clear session cancels a pending assistant request and discards its answer', async () => {
    await login();
    submit('First question.');
    await fixture.whenStable();
    assistant().flush(success, { headers });
    await fixture.whenStable();
    submit('Pending question.');
    await fixture.whenStable();
    const pending = assistant();
    [...page.querySelectorAll('button')]
      .find((button) => button.textContent === 'Clear session')!
      .click();
    await fixture.whenStable();
    expect(pending.cancelled).toBe(true);
    expect(() => pending.flush(success, { headers })).toThrow('cancelled');
    expect(session.authenticated()).toBe(false);
    expect(app().assistantAnswer()).toBeNull();
    expect(app().assistantState()).toBe(AiAssistantState.Idle);
    expect(page.querySelector('#assistant-form')).toBeNull();
  });

  it('application destruction cancels a pending assistant request', async () => {
    await login();
    submit('Pending question.');
    await fixture.whenStable();
    const pending = assistant();
    fixture.destroy();
    expect(pending.cancelled).toBe(true);
  });

  it('replacement login clears the previous answer before using the new session', async () => {
    await login();
    submit('First question.');
    await fixture.whenStable();
    assistant().flush(success, { headers });
    await fixture.whenStable();
    expect(app().assistantAnswer()).toBe(success.answer);
    await login();
    expect(app().assistantAnswer()).toBeNull();
    expect(app().assistantState()).toBe(AiAssistantState.Idle);
  });
});
