import { Injectable, computed, signal } from '@angular/core';

interface Session {
  readonly backendId: string;
  readonly accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthSession {
  readonly contextReady = signal(false);
  readonly contextEpoch = signal(0);
  contextChanged(): void {
    this.contextEpoch.update((value) => value + 1);
  }
  markContextReady(): void {
    this.contextReady.set(true);
  }
  private readonly session = signal<Session | null>(null);
  readonly authenticated = computed(() => this.session() !== null);
  readonly backendId = computed(() => this.session()?.backendId ?? null);

  establish(backendId: string, accessToken: string): void {
    if (accessToken.length === 0) {
      throw new Error('Cannot establish a session with an empty token');
    }
    this.contextReady.set(false);
    this.contextChanged();
    this.session.set({ backendId, accessToken });
  }

  clear(): void {
    this.contextReady.set(false);
    this.contextChanged();
    this.session.set(null);
  }

  tokenFor(backendId: string): string | null {
    const session = this.session();
    return session?.backendId === backendId ? session.accessToken : null;
  }
}
