import { Directive, input } from '@angular/core';
import { ShellSlot } from './shell-extensions';

export interface NavigationEntry {
  readonly id: string;
  readonly label: string;
  readonly href: string;
}
export const STRUCTURE_BINDINGS = { navigation: 'navigation', items: 'items' } as const;
@Directive()
export abstract class ShellBase {
  readonly navigation = input<readonly NavigationEntry[]>([]);
  readonly slots = ShellSlot;
}
@Directive()
export abstract class NavigationBase {
  readonly items = input<readonly NavigationEntry[]>([]);
}
