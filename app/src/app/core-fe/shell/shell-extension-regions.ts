import { Component, TemplateRef, computed, inject, viewChildren } from '@angular/core';
import { ThemeRegions } from '@alxarafe/ui-runtime';
import { SHELL_SLOTS, ShellExtensionRegistry } from './shell-extensions';
import { ShellSlotOutlet } from './shell-slot-outlet';

// ERBAS owns contribution discovery and ordering; the runtime owns projection.
@Component({
  selector: 'app-shell-extension-regions',
  exportAs: 'shellRegions',
  imports: [ShellSlotOutlet],
  template: `@for (slot of slots; track slot) {
    <ng-template #region><core-fe-shell-slot [slot]="slot" /></ng-template>
  }`,
})
export class ShellExtensionRegions {
  private readonly registry = inject(ShellExtensionRegistry);
  readonly slots = SHELL_SLOTS.filter((slot) => this.registry.forSlot(slot).length > 0);
  private readonly templates = viewChildren<TemplateRef<unknown>>('region');
  readonly regions = computed<ThemeRegions>(() =>
    Object.fromEntries(this.templates().map((template, index) => [this.slots[index]!, template])),
  );
}
