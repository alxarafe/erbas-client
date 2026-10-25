import {
  InjectionToken,
  Injectable,
  Provider,
  Type,
  inject,
  reflectComponentType,
} from '@angular/core';

export const ShellSlot = {
  TopbarStart: 'topbar-start',
  TopbarActions: 'topbar-actions',
  NavigationBefore: 'navigation-before',
  NavigationAfter: 'navigation-after',
  ContentBefore: 'content-before',
  ContentAfter: 'content-after',
  ContextualActions: 'contextual-actions',
  FloatingActions: 'floating-actions',
  Footer: 'footer',
} as const;
export type ShellSlot = (typeof ShellSlot)[keyof typeof ShellSlot];
export const SHELL_SLOTS: readonly ShellSlot[] = Object.freeze(Object.values(ShellSlot));
export interface ShellExtensionDefinition {
  readonly id: string;
  readonly slot: ShellSlot;
  readonly component: Type<unknown>;
  readonly priority: number;
}
const SHELL_EXTENSIONS = new InjectionToken<readonly ShellExtensionDefinition[]>(
  'Shell extensions',
  { providedIn: 'root', factory: () => [] },
);
const EXTENSION_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
@Injectable({ providedIn: 'root' })
export class ShellExtensionRegistry {
  private readonly entries: readonly ShellExtensionDefinition[];
  constructor() {
    const seen = new Set<string>();
    this.entries = Object.freeze(
      inject(SHELL_EXTENSIONS)
        .map((entry) => {
          if (
            !EXTENSION_ID.test(entry.id) ||
            seen.has(entry.id) ||
            !SHELL_SLOTS.includes(entry.slot) ||
            !Number.isSafeInteger(entry.priority) ||
            !reflectComponentType(entry.component)?.isStandalone
          )
            throw new Error('Invalid or duplicate shell extension');
          seen.add(entry.id);
          return Object.freeze({ ...entry });
        })
        .sort((a, b) => a.priority - b.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    );
  }
  forSlot(slot: ShellSlot): readonly ShellExtensionDefinition[] {
    if (!SHELL_SLOTS.includes(slot)) throw new Error('Unknown shell slot');
    return this.entries.filter((entry) => entry.slot === slot);
  }
}
export function provideShellExtensions(entries: readonly ShellExtensionDefinition[]): Provider {
  return { provide: SHELL_EXTENSIONS, useValue: entries };
}
