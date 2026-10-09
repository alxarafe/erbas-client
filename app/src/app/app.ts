import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { BACKENDS } from './backends';
import { BackendSelection } from './backend-selection';
import { HealthClient } from './health-client';

type HealthState = 'checking' | 'online' | 'error';

@Component({
  selector: 'app-root',
  imports: [DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly backends = BACKENDS;
  readonly selection = inject(BackendSelection);
  readonly state = signal<HealthState>('checking');
  readonly lastChecked = signal<Date | null>(null);
  readonly duration = signal<number | null>(null);
  private readonly health = inject(HealthClient);
  private request?: Subscription;

  constructor() {
    effect(() => this.check(this.selection.selected().proxyBaseUrl));
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  select(event: Event): void {
    this.selection.select((event.target as HTMLSelectElement).value);
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
