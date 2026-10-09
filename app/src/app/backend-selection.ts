import { Injectable, signal } from '@angular/core';
import { BACKENDS, Backend } from './backends';

export const SELECTION_KEY = 'erbas.backend';

@Injectable({ providedIn: 'root' })
export class BackendSelection {
  private readonly selection = signal<Backend>(this.restore());
  readonly selected = this.selection.asReadonly();

  select(id: string): void {
    const backend = BACKENDS.find((entry) => entry.id === id);
    if (!backend) return;
    this.selection.set(backend);
    try {
      localStorage.setItem(SELECTION_KEY, id);
    } catch {
      /* Storage may be disabled. */
    }
  }

  private restore(): Backend {
    let id: string | null = null;
    try {
      id = localStorage.getItem(SELECTION_KEY);
    } catch {
      /* Use the default. */
    }
    return BACKENDS.find((entry) => entry.id === id) ?? BACKENDS[0]!;
  }
}
