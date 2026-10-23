import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Subscription, finalize } from 'rxjs';
import { BACKENDS } from './backends';
import { BackendSelection } from './backend-selection';
import { HealthClient } from './health-client';
import { AuthClient, InvalidLoginResponseError } from './auth-client';
import { AuthSession } from './auth-session';
import {
  AI_ASSISTANT_FAILURES,
  AI_ASSISTANT_MESSAGE_MAXIMUM,
  AiAssistantClient,
  AiAssistantFailureError,
  InvalidAiAssistantResponseError,
  isAiAssistantInvocationRequest,
} from './ai-assistant-client';
import { AiAssistantState } from './ai-assistant-state';
import {
  UsersClient,
  User,
  UsersCollection,
  InvalidUsersResponseError,
  USERS_PAGE_SIZE,
  USER_PASSWORD_LENGTH,
  isCreateUserRequest,
  UpdateUserRequest,
} from './users-client';
import { UserReadState } from './user-read-state';
import { UserUpdateState } from './user-update-state';
import { UserCreateState } from './user-create-state';
import { DemoDefaults, parseDemoDefaults } from './demo-defaults';

const ADMINISTRATOR_REQUIRED_MESSAGE =
  'User administration requires an administrator. Your session remains authenticated.';
const SESSION_UNUSABLE_MESSAGE = 'Your session is no longer usable. Sign in again.';

type HealthState = 'checking' | 'online' | 'error';
type LoginState =
  | 'idle'
  | 'submitting'
  | 'authenticated'
  | 'invalid-credentials'
  | 'invalid-request'
  | 'unavailable'
  | 'invalid-response';

@Component({
  selector: 'app-root',
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly backends = BACKENDS;
  readonly demoDefaults = signal<DemoDefaults | null>(null);
  readonly selection = inject(BackendSelection);
  readonly state = signal<HealthState>('checking');
  readonly lastChecked = signal<Date | null>(null);
  readonly duration = signal<number | null>(null);
  readonly session = inject(AuthSession);
  readonly authenticated = computed(
    () => this.session.tokenFor(this.selection.selected().id) !== null,
  );
  readonly loginState = signal<LoginState>('idle');
  readonly loginMessages: Record<LoginState, string> = {
    idle: 'Enter your credentials to sign in.',
    submitting: 'Signing in…',
    authenticated: 'Authenticated',
    'invalid-credentials': 'Invalid email or password.',
    'invalid-request': 'The login request is invalid.',
    unavailable: 'Authentication service unavailable.',
    'invalid-response': 'The backend returned an invalid login response.',
  };
  private readonly auth = inject(AuthClient);
  readonly assistantStates = AiAssistantState;
  readonly assistantMaximum = AI_ASSISTANT_MESSAGE_MAXIMUM;
  readonly assistantState = signal<AiAssistantState>(AiAssistantState.Idle);
  readonly assistantAnswer = signal<string | null>(null);
  readonly assistantMessages: Record<AiAssistantState, string> = {
    [AiAssistantState.Idle]: 'Ask the assistant about your effective READ data.',
    [AiAssistantState.Submitting]: 'The assistant is working…',
    [AiAssistantState.Answered]: 'The assistant answered.',
    [AiAssistantState.InvalidRequest]: `Enter a nonempty message of at most ${AI_ASSISTANT_MESSAGE_MAXIMUM} Unicode scalar values without NUL or unpaired surrogates.`,
    [AiAssistantState.Unauthorized]: SESSION_UNUSABLE_MESSAGE,
    [AiAssistantState.Forbidden]:
      'Your account is not allowed to use the AI assistant on the selected backend.',
    [AiAssistantState.Unsupported]: 'The AI assistant is not available on the selected backend.',
    [AiAssistantState.ExecutionFailed]: 'The assistant could not complete the request.',
    [AiAssistantState.ModuleDisabled]: 'The AI assistant is disabled on the selected backend.',
    [AiAssistantState.Unavailable]: 'The AI assistant is temporarily unavailable. Try again.',
    [AiAssistantState.InvalidResponse]: 'The backend returned an invalid assistant response.',
  };
  private readonly assistantClient = inject(AiAssistantClient);
  private assistantRequest?: Subscription;
  readonly users = signal<UsersCollection | null>(null);
  readonly userStates = UserReadState;
  readonly usersState = signal<UserReadState>(UserReadState.Idle);
  readonly usersMessages: Partial<Record<UserReadState, string>> = {
    [UserReadState.Idle]: 'Sign in, then load the users collection.',
    [UserReadState.Loading]: 'Loading users…',
    [UserReadState.Loaded]: 'Users loaded. Ordered by ID ascending.',
    [UserReadState.Unauthorized]: 'Your session is no longer usable. Sign in again to load users.',
    [UserReadState.Forbidden]: ADMINISTRATOR_REQUIRED_MESSAGE,
    [UserReadState.InvalidRequest]: 'The users pagination request is invalid.',
    [UserReadState.Unavailable]: 'The users service is unavailable. Try again.',
    [UserReadState.InvalidResponse]: 'The backend returned an invalid users response.',
  };
  readonly previousDisabled = computed(
    () => this.usersState() !== UserReadState.Loaded || this.users()!.offset === 0,
  );
  readonly nextDisabled = computed(
    () =>
      this.usersState() !== UserReadState.Loaded ||
      this.users()!.offset + this.users()!.limit >= this.users()!.total,
  );
  readonly currentUser = signal<User | null>(null);
  readonly profileState = signal<UserReadState>(UserReadState.Idle);
  readonly profileMessages: Partial<Record<UserReadState, string>> = {
    [UserReadState.Idle]: 'Sign in to load your current profile.',
    [UserReadState.Loading]: 'Loading your profile…',
    [UserReadState.Loaded]: 'Current profile loaded.',
    [UserReadState.Unauthorized]: SESSION_UNUSABLE_MESSAGE,
    [UserReadState.Unavailable]:
      'Your profile is unavailable. Try again; your session is retained.',
    [UserReadState.InvalidResponse]: 'The backend returned an invalid profile response.',
  };
  readonly administrator = computed(
    () => this.authenticated() && this.currentUser()?.admin === true,
  );
  readonly detailUser = signal<User | null>(null);
  readonly selectedUserId = signal<string | null>(null);
  readonly detailState = signal<UserReadState>(UserReadState.Idle);
  readonly detailMessages: Partial<Record<UserReadState, string>> = {
    [UserReadState.Idle]: 'Select View in the collection to inspect a user.',
    [UserReadState.Loading]: 'Loading user detail…',
    [UserReadState.Loaded]: 'User detail loaded.',
    [UserReadState.Unauthorized]: SESSION_UNUSABLE_MESSAGE,
    [UserReadState.Forbidden]: ADMINISTRATOR_REQUIRED_MESSAGE,
    [UserReadState.NotFound]: 'User not found.',
    [UserReadState.Unavailable]: 'User detail is unavailable. Try again.',
    [UserReadState.InvalidResponse]: 'The backend returned an invalid user detail response.',
  };
  readonly createStates = UserCreateState;
  readonly createState = signal<UserCreateState>(UserCreateState.Idle);
  readonly createdUser = signal<User | null>(null);
  readonly passwordLength = USER_PASSWORD_LENGTH;
  readonly createMessages: Record<UserCreateState, string> = {
    [UserCreateState.Idle]: 'Create an enabled user. Email and password are sent unchanged.',
    [UserCreateState.Submitting]: 'Creating user…',
    [UserCreateState.Created]: 'User created.',
    [UserCreateState.InvalidRequest]: `The creation request is invalid. Enter a nonempty email and a password of ${USER_PASSWORD_LENGTH.minimum}–${USER_PASSWORD_LENGTH.maximum} Unicode code points.`,
    [UserCreateState.Unauthorized]: SESSION_UNUSABLE_MESSAGE,
    [UserCreateState.Forbidden]: ADMINISTRATOR_REQUIRED_MESSAGE,
    [UserCreateState.EmailConflict]: 'That email already exists. Use a different email.',
    [UserCreateState.Unavailable]: 'The user creation service is unavailable.',
    [UserCreateState.InvalidResponse]: 'The backend returned an invalid creation response.',
  };
  readonly updateStates = UserUpdateState;
  readonly updateState = signal<UserUpdateState>(UserUpdateState.Idle);
  readonly updateEnabled = signal(false);
  readonly updateAdmin = signal(false);
  readonly updateMessages: Record<UserUpdateState, string> = {
    [UserUpdateState.Idle]: 'Change enabled or administrator status.',
    [UserUpdateState.Submitting]: 'Updating user…',
    [UserUpdateState.Updated]: 'User updated.',
    [UserUpdateState.NoChanges]: 'No changes to update.',
    [UserUpdateState.InvalidRequest]: 'The update request is invalid.',
    [UserUpdateState.Unauthorized]: SESSION_UNUSABLE_MESSAGE,
    [UserUpdateState.Forbidden]: ADMINISTRATOR_REQUIRED_MESSAGE,
    [UserUpdateState.NotFound]: 'The target user no longer exists. Reload users.',
    [UserUpdateState.LastAdmin]:
      'This operation would leave the system without an enabled administrator.',
    [UserUpdateState.Unavailable]: 'The user update service is unavailable.',
    [UserUpdateState.InvalidResponse]: 'The backend returned an invalid update response.',
  };
  private updateRequest?: Subscription;
  private createRequest?: Subscription;
  private readonly usersClient = inject(UsersClient);
  private profileRequest?: Subscription;
  private detailRequest?: Subscription;
  private usersRequest?: Subscription;
  private readonly health = inject(HealthClient);
  private request?: Subscription;
  private loginRequest?: Subscription;

  constructor() {
    const demoRequest = inject(HttpClient)
      .get('/demo/defaults.env', { responseType: 'text' })
      .subscribe({
        next: (text) => this.demoDefaults.set(parseDemoDefaults(text)),
        error: () => this.demoDefaults.set(null),
      });
    effect(() => this.check(this.selection.selected().proxyBaseUrl));
    inject(DestroyRef).onDestroy(() => {
      demoRequest.unsubscribe();
      this.request?.unsubscribe();
      this.loginRequest?.unsubscribe();
      this.assistantRequest?.unsubscribe();
      this.usersRequest?.unsubscribe();
      this.profileRequest?.unsubscribe();
      this.detailRequest?.unsubscribe();
      this.createRequest?.unsubscribe();
      this.updateRequest?.unsubscribe();
    });
  }

  select(event: Event): void {
    const previous = this.selection.selected();
    this.selection.select((event.target as HTMLSelectElement).value);
    if (this.selection.selected().id !== previous.id) this.clearSession();
  }

  login(event: Event, email: HTMLInputElement, password: HTMLInputElement): void {
    event.preventDefault();
    const backend = this.selection.selected();
    this.loginRequest?.unsubscribe();
    this.clearAssistant();
    this.clearProtectedData();
    this.session.clear();
    this.loginState.set('submitting');
    this.loginRequest = this.auth
      .login(backend.proxyBaseUrl, { email: email.value, password: password.value })
      .subscribe({
        next: (response) => {
          password.value = '';
          this.session.establish(backend.id, response.accessToken);
          this.loginState.set('authenticated');
          this.loadProfile();
        },
        error: (error: unknown) => {
          if (error instanceof InvalidLoginResponseError) {
            this.loginState.set('invalid-response');
          } else if (
            error instanceof HttpErrorResponse &&
            error.status === HttpStatusCode.Unauthorized
          ) {
            password.value = '';
            this.loginState.set('invalid-credentials');
          } else if (
            error instanceof HttpErrorResponse &&
            error.status === HttpStatusCode.BadRequest
          ) {
            this.loginState.set('invalid-request');
          } else {
            this.loginState.set('unavailable');
          }
        },
      });
  }

  clearSession(): void {
    this.loginRequest?.unsubscribe();
    this.clearAssistant();
    this.clearProtectedData();
    this.session.clear();
    this.loginState.set('idle');
  }

  private clearAssistant(): void {
    this.assistantRequest?.unsubscribe();
    this.assistantAnswer.set(null);
    this.assistantState.set(AiAssistantState.Idle);
  }

  private clearUsers(): void {
    this.usersRequest?.unsubscribe();
    this.users.set(null);
    this.usersState.set(UserReadState.Idle);
  }

  private clearUpdate(): void {
    this.updateRequest?.unsubscribe();
    this.updateState.set(UserUpdateState.Idle);
    this.updateEnabled.set(false);
    this.updateAdmin.set(false);
  }

  private clearDetail(): void {
    this.clearUpdate();
    this.detailRequest?.unsubscribe();
    this.detailUser.set(null);
    this.selectedUserId.set(null);
    this.detailState.set(UserReadState.Idle);
  }

  private clearProtectedData(): void {
    this.profileRequest?.unsubscribe();
    this.currentUser.set(null);
    this.profileState.set(UserReadState.Idle);
    this.clearUsers();
    this.clearDetail();
    this.createRequest?.unsubscribe();
    this.createdUser.set(null);
    this.createState.set(UserCreateState.Idle);
  }

  invokeAssistant(event: Event, message: HTMLTextAreaElement): void {
    event.preventDefault();
    const backend = this.selection.selected();
    const bearer = this.session.tokenFor(backend.id);
    this.assistantRequest?.unsubscribe();
    this.assistantAnswer.set(null);
    if (bearer === null) {
      this.assistantState.set(AiAssistantState.Idle);
      return;
    }
    const request = { message: message.value };
    if (!isAiAssistantInvocationRequest(request)) {
      this.assistantState.set(AiAssistantState.InvalidRequest);
      return;
    }
    this.assistantState.set(AiAssistantState.Submitting);
    this.assistantRequest = this.assistantClient
      .invoke(backend.proxyBaseUrl, bearer, request)
      .subscribe({
        next: (invocation) => {
          message.value = '';
          this.assistantAnswer.set(invocation.answer);
          this.assistantState.set(AiAssistantState.Answered);
        },
        error: (error: unknown) => {
          let state = AiAssistantState.Unavailable;
          if (error instanceof InvalidAiAssistantResponseError) {
            state = AiAssistantState.InvalidResponse;
          } else if (error instanceof AiAssistantFailureError) {
            switch (error.failure) {
              case AI_ASSISTANT_FAILURES.invalidRequest:
                state = AiAssistantState.InvalidRequest;
                break;
              case AI_ASSISTANT_FAILURES.unauthorized:
                this.clearSession();
                state = AiAssistantState.Unauthorized;
                break;
              case AI_ASSISTANT_FAILURES.forbidden:
                state = AiAssistantState.Forbidden;
                break;
              case AI_ASSISTANT_FAILURES.unsupported:
                state = AiAssistantState.Unsupported;
                break;
              case AI_ASSISTANT_FAILURES.executionFailed:
                state = AiAssistantState.ExecutionFailed;
                break;
              case AI_ASSISTANT_FAILURES.moduleDisabled:
                state = AiAssistantState.ModuleDisabled;
                break;
              case AI_ASSISTANT_FAILURES.unavailable:
                state = AiAssistantState.Unavailable;
                break;
            }
          }
          this.assistantState.set(state);
        },
      });
  }

  updateUser(event: Event): void {
    event.preventDefault();
    this.updateRequest?.unsubscribe();
    const user = this.detailUser();
    const backend = this.selection.selected();
    const bearer = this.session.tokenFor(backend.id);
    if (!user || bearer === null || !this.administrator()) return;
    const request: UpdateUserRequest = {
      ...(this.updateEnabled() !== user.enabled ? { enabled: this.updateEnabled() } : {}),
      ...(this.updateAdmin() !== user.admin ? { admin: this.updateAdmin() } : {}),
    };
    if (Object.keys(request).length === 0) {
      this.updateState.set(UserUpdateState.NoChanges);
      return;
    }
    this.updateState.set(UserUpdateState.Submitting);
    this.updateRequest = this.usersClient
      .update(backend.proxyBaseUrl, bearer, user.id, request)
      .subscribe({
        next: (updated) => {
          if (updated.id === this.currentUser()?.id) {
            if (!updated.enabled) {
              this.clearSession();
              return;
            }
            if (!updated.admin) {
              this.clearProtectedData();
              this.currentUser.set(updated);
              this.profileState.set(UserReadState.Loaded);
              return;
            }
            this.currentUser.set(updated);
          }
          this.detailUser.set(updated);
          this.updateEnabled.set(updated.enabled);
          this.updateAdmin.set(updated.admin);
          this.users.update((collection) =>
            collection
              ? {
                  ...collection,
                  items: collection.items.map((row) => (row.id === updated.id ? updated : row)),
                }
              : null,
          );
          this.updateState.set(UserUpdateState.Updated);
        },
        error: (error: unknown) => {
          let state = UserUpdateState.Unavailable;
          if (error instanceof InvalidUsersResponseError) state = UserUpdateState.InvalidResponse;
          else if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case HttpStatusCode.BadRequest:
                state = UserUpdateState.InvalidRequest;
                break;
              case HttpStatusCode.Unauthorized:
                this.clearSession();
                state = UserUpdateState.Unauthorized;
                break;
              case HttpStatusCode.Forbidden:
                state = UserUpdateState.Forbidden;
                break;
              case HttpStatusCode.NotFound:
                this.detailUser.set(null);
                this.detailState.set(UserReadState.NotFound);
                state = UserUpdateState.NotFound;
                break;
              case HttpStatusCode.Conflict:
                state = UserUpdateState.LastAdmin;
                break;
            }
          }
          this.updateState.set(state);
        },
      });
  }

  createUser(
    event: Event,
    email: HTMLInputElement,
    password: HTMLInputElement,
    admin: HTMLInputElement,
  ): void {
    event.preventDefault();
    const request = { email: email.value, password: password.value, admin: admin.checked };
    this.createRequest?.unsubscribe();
    this.createdUser.set(null);
    this.createState.set(UserCreateState.Idle);
    const backend = this.selection.selected();
    const bearer = this.session.tokenFor(backend.id);
    if (bearer === null || !this.administrator()) return;
    if (!isCreateUserRequest(request)) {
      this.createState.set(UserCreateState.InvalidRequest);
      return;
    }
    const reloadOffset = this.usersState() === UserReadState.Loaded ? this.users()!.offset : null;
    this.createState.set(UserCreateState.Submitting);
    this.createRequest = this.usersClient
      .create(backend.proxyBaseUrl, bearer, request)
      .pipe(
        finalize(() => {
          password.value = '';
        }),
      )
      .subscribe({
        next: (user) => {
          password.value = '';
          email.value = '';
          admin.checked = false;
          this.createdUser.set(user);
          this.createState.set(UserCreateState.Created);
          if (reloadOffset !== null) this.loadUsers(reloadOffset);
        },
        error: (error: unknown) => {
          password.value = '';
          let state = UserCreateState.Unavailable;
          if (error instanceof InvalidUsersResponseError) state = UserCreateState.InvalidResponse;
          else if (error instanceof HttpErrorResponse) {
            switch (error.status) {
              case HttpStatusCode.BadRequest:
                state = UserCreateState.InvalidRequest;
                break;
              case HttpStatusCode.Unauthorized:
                this.clearSession();
                state = UserCreateState.Unauthorized;
                break;
              case HttpStatusCode.Forbidden:
                state = UserCreateState.Forbidden;
                break;
              case HttpStatusCode.Conflict:
                state = UserCreateState.EmailConflict;
                break;
            }
          }
          this.createState.set(state);
        },
      });
  }

  loadProfile(): void {
    const backend = this.selection.selected();
    const bearer = this.session.tokenFor(backend.id);
    this.clearProtectedData();
    if (bearer === null) return;
    this.profileState.set(UserReadState.Loading);
    this.profileRequest = this.usersClient.current(backend.proxyBaseUrl, bearer).subscribe({
      next: (user) => {
        this.currentUser.set(user);
        this.profileState.set(UserReadState.Loaded);
      },
      error: (error: unknown) => {
        const state = this.readError(error);
        // /me does not define 403 or 404; do not invent authorization semantics.
        this.profileState.set(
          state === UserReadState.Forbidden || state === UserReadState.NotFound
            ? UserReadState.Unavailable
            : state,
        );
      },
    });
  }

  viewUser(id: string): void {
    const backend = this.selection.selected();
    const bearer = this.session.tokenFor(backend.id);
    this.clearDetail();
    if (bearer === null || !this.administrator()) return;
    this.selectedUserId.set(id);
    this.detailState.set(UserReadState.Loading);
    this.detailRequest = this.usersClient.detail(backend.proxyBaseUrl, bearer, id).subscribe({
      next: (user) => {
        this.detailUser.set(user);
        this.updateEnabled.set(user.enabled);
        this.updateAdmin.set(user.admin);
        this.detailState.set(UserReadState.Loaded);
      },
      error: (error: unknown) => this.detailState.set(this.readError(error)),
    });
  }

  private readError(error: unknown): UserReadState {
    if (
      error instanceof InvalidUsersResponseError ||
      (error instanceof HttpErrorResponse && error.status === HttpStatusCode.Ok)
    )
      return UserReadState.InvalidResponse;
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case HttpStatusCode.Unauthorized:
          this.clearSession();
          return UserReadState.Unauthorized;
        case HttpStatusCode.Forbidden:
          return UserReadState.Forbidden;
        case HttpStatusCode.NotFound:
          return UserReadState.NotFound;
      }
    }
    return UserReadState.Unavailable;
  }

  loadUsers(offset = this.users()?.offset ?? 0): void {
    const backend = this.selection.selected();
    const bearer = this.session.tokenFor(backend.id);
    this.clearUsers();
    this.clearDetail();
    if (bearer === null || !this.administrator()) return;
    this.usersState.set(UserReadState.Loading);
    this.usersRequest = this.usersClient
      .list(backend.proxyBaseUrl, bearer, offset, USERS_PAGE_SIZE)
      .subscribe({
        next: (collection) => {
          this.users.set(collection);
          this.usersState.set(UserReadState.Loaded);
        },
        error: (error: unknown) => {
          if (
            error instanceof InvalidUsersResponseError ||
            (error instanceof HttpErrorResponse && error.status === HttpStatusCode.Ok)
          ) {
            this.usersState.set(UserReadState.InvalidResponse);
          } else if (
            error instanceof HttpErrorResponse &&
            error.status === HttpStatusCode.Unauthorized
          ) {
            this.clearSession();
            this.usersState.set(UserReadState.Unauthorized);
          } else if (
            error instanceof HttpErrorResponse &&
            error.status === HttpStatusCode.Forbidden
          ) {
            this.usersState.set(UserReadState.Forbidden);
          } else if (
            error instanceof HttpErrorResponse &&
            error.status === HttpStatusCode.BadRequest
          ) {
            this.usersState.set(UserReadState.InvalidRequest);
          } else {
            this.usersState.set(UserReadState.Unavailable);
          }
        },
      });
  }

  previousUsers(): void {
    if (!this.previousDisabled())
      this.loadUsers(Math.max(0, this.users()!.offset - this.users()!.limit));
  }

  nextUsers(): void {
    if (!this.nextDisabled()) this.loadUsers(this.users()!.offset + this.users()!.limit);
  }

  check(baseUrl = this.selection.selected().proxyBaseUrl): void {
    this.request?.unsubscribe();
    this.state.set('checking');
    this.lastChecked.set(null);
    this.duration.set(null);
    const started = performance.now();
    const finish = (state: HealthState) => {
      this.state.set(state);
      this.lastChecked.set(new Date());
      this.duration.set(Math.round(performance.now() - started));
    };
    this.request = this.health.check(baseUrl).subscribe({
      next: () => finish('online'),
      error: () => finish('error'),
    });
  }
}
