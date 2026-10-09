import { Injectable, computed, signal } from '@angular/core';

interface Session {
  readonly backendId: string;
  readonly accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthSession {
  private readonly session = signal<Session | null>(null);
  readonly authenticated = computed(() => this.session() !== null);
  readonly backendId = computed(() => this.session()?.backendId ?? null);

  establish(backendId: string, accessToken: string): void {
    if (accessToken.length === 0) {
      throw new Error('Cannot establish a session with an empty token');
    }
    this.session.set({ backendId, accessToken });
  }

  clear(): void {
    this.session.set(null);
  }

  tokenFor(backendId: string): string | null {
    const session = this.session();
    return session?.backendId === backendId ? session.accessToken : null;
  }
}
