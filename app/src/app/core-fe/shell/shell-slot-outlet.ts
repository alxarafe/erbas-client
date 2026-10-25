import { NgComponentOutlet } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { ShellExtensionRegistry, ShellSlot } from './shell-extensions';

@Component({
  selector: 'core-fe-shell-slot',
  imports: [NgComponentOutlet],
  templateUrl: './shell-slot-outlet.html',
  host: { '[attr.data-shell-slot]': 'slot()' },
})
export class ShellSlotOutlet {
  readonly slot = input.required<ShellSlot>();
  private readonly registry = inject(ShellExtensionRegistry);
  readonly entries = computed(() => this.registry.forSlot(this.slot()));
}
