import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { BACKENDS } from './backends';
import { BackendSelection } from './backend-selection';
import { HealthClient } from './health-client';
import { AuthClient, InvalidLoginResponseError } from './auth-client';
import { AuthSession } from './auth-session';
import { UsersClient, UsersCollection, InvalidUsersResponseError } from './users-client';
import { DemoDefaults, parseDemoDefaults } from './demo-defaults';

type HealthState = 'checking' | 'online' | 'error';
type UsersState =
  | 'idle'
  | 'loading'
  | 'loaded'
  | 'unauthorized'
  | 'forbidden'
  | 'invalid-request'
  | 'unavailable'
  | 'invalid-response';
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
  readonly usersState = signal<UsersState>('idle');
  readonly usersMessages: Record<UsersState, string> = {
    idle: 'Sign in, then load the users collection.',
    loading: 'Loading users…',
    loaded: 'Users loaded. Ordered by ID ascending.',
    unauthorized: 'Your session is no longer usable. Sign in again to load users.',
    forbidden: 'User administration requires an administrator. Your session remains authenticated.',
    'invalid-request': 'The users pagination request is invalid.',
    unavailable: 'The users service is unavailable. Try again.',
    'invalid-response': 'The backend returned an invalid users response.',
  };
  readonly previousDisabled = computed(
    () => this.usersState() !== 'loaded' || this.users()!.offset === 0,
  );
  readonly nextDisabled = computed(
    () =>
      this.usersState() !== 'loaded' ||
      this.users()!.offset + this.users()!.limit >= this.users()!.total,
  );
  private readonly usersClient = inject(UsersClient);
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
    this.clearUsers();
    this.session.clear();
    this.loginState.set('submitting');
    this.loginRequest = this.auth
      .login(backend.proxyBaseUrl, { email: email.value, password: password.value })
      .subscribe({
        next: (response) => {
          password.value = '';
          this.session.establish(backend.id, response.accessToken);
          this.loginState.set('authenticated');
        },
        error: (error: unknown) => {
          if (error instanceof InvalidLoginResponseError) {
            this.loginState.set('invalid-response');
          } else if (error instanceof HttpErrorResponse && error.status === 401) {
            password.value = '';
            this.loginState.set('invalid-credentials');
          } else if (error instanceof HttpErrorResponse && error.status === 400) {
            this.loginState.set('invalid-request');
          } else {
            this.loginState.set('unavailable');
          }
        },
      });
  }

  clearSession(): void {
    this.loginRequest?.unsubscribe();
    this.clearUsers();
    this.session.clear();
    this.loginState.set('idle');
  }

  private clearUsers(): void {
    this.usersRequest?.unsubscribe();
    this.users.set(null);
    this.usersState.set('idle');
  }

  loadUsers(offset = this.users()?.offset ?? 0): void {
    const backend = this.selection.selected();
    const bearer = this.session.tokenFor(backend.id);
    this.clearUsers();
    if (bearer === null) return;
    this.usersState.set('loading');
    this.usersRequest = this.usersClient.list(backend.proxyBaseUrl, bearer, offset, 50).subscribe({
      next: (collection) => {
        this.users.set(collection);
        this.usersState.set('loaded');
      },
      error: (error: unknown) => {
        if (
          error instanceof InvalidUsersResponseError ||
          (error instanceof HttpErrorResponse && error.status === 200)
        ) {
          this.usersState.set('invalid-response');
        } else if (error instanceof HttpErrorResponse && error.status === 401) {
          this.clearSession();
          this.usersState.set('unauthorized');
        } else if (error instanceof HttpErrorResponse && error.status === 403) {
          this.usersState.set('forbidden');
        } else if (error instanceof HttpErrorResponse && error.status === 400) {
          this.usersState.set('invalid-request');
        } else {
          this.usersState.set('unavailable');
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
