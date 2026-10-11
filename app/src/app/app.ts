import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { BACKENDS } from './backends';
import { BackendSelection } from './backend-selection';
import { HealthClient } from './health-client';
import { AuthClient, InvalidLoginResponseError } from './auth-client';
import { AuthSession } from './auth-session';
import {
  UsersClient,
  User,
  UsersCollection,
  InvalidUsersResponseError,
  USERS_PAGE_SIZE,
} from './users-client';
import { UserReadState } from './user-read-state';
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
      this.usersRequest?.unsubscribe();
      this.profileRequest?.unsubscribe();
      this.detailRequest?.unsubscribe();
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
    this.clearProtectedData();
    this.session.clear();
    this.loginState.set('idle');
  }

  private clearUsers(): void {
    this.usersRequest?.unsubscribe();
    this.users.set(null);
    this.usersState.set(UserReadState.Idle);
  }

  private clearDetail(): void {
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
